/**
 * Byte 3 interview booking backend (Google Apps Script, bound to a Google Sheet).
 *
 * Sheet tabs (created by setup()):
 *   Availability  – one row per free window, Finnish time: Date | From | To
 *                   e.g. 2026-09-26 | 10:00 | 12:00  → eight 15-min slots
 *   Bookings      – written by the script; set status to "cancelled" to free a slot
 *
 * Each booking creates a Google Calendar event (with a Meet link) on the
 * deploying account's calendar and emails invites to the candidate + interviewers.
 */

var CONFIG = {
  TZ: "Europe/Helsinki",
  SLOT_MINUTES: 15,
  MIN_NOTICE_MINUTES: 120,          // hide slots starting sooner than this
  INTERVIEWERS: ["robin@wave.ventures", "oona.kuoppa@gmail.com"],
  TITLE: "Byte 3 interview",
  CALENDAR_ID: "primary",
  ADD_MEET: true,
  ONE_BOOKING_PER_EMAIL: true
};

var AVAIL = "Availability";
var BOOK = "Bookings";
var BOOK_COLS = ["booked_at", "slot_start", "slot_label", "name", "email", "event_id", "meet_link", "status"];

/* ---------- one-time setup: run this once from the editor ---------- */

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty("SHEET_ID", ss.getId());

  var a = ss.getSheetByName(AVAIL) || ss.insertSheet(AVAIL);
  if (a.getLastRow() === 0) {
    a.appendRow(["Date (YYYY-MM-DD)", "From (HH:MM)", "To (HH:MM)", "Note"]);
    a.setFrozenRows(1);
  }
  a.getRange("A:C").setNumberFormat("@");

  var b = ss.getSheetByName(BOOK) || ss.insertSheet(BOOK);
  if (b.getLastRow() === 0) {
    b.appendRow(BOOK_COLS);
    b.setFrozenRows(1);
  }
  b.getRange("A:H").setNumberFormat("@");

  // Touch the Calendar API so the authorisation prompt covers it.
  Calendar.Events.list(CONFIG.CALENDAR_ID, { maxResults: 1 });
}

/* ---------- helpers ---------- */

function sheet_(name) {
  var id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function pad_(n) { return (n < 10 ? "0" : "") + n; }

// Accepts 2026-09-26, 26.9.2026, 26/9/2026
function normDate_(s) {
  s = String(s || "").trim();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return m[1] + "-" + pad_(+m[2]) + "-" + pad_(+m[3]);
  m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  if (m) return m[3] + "-" + pad_(+m[2]) + "-" + pad_(+m[1]);
  return null;
}

// Accepts 10:00, 10.00, 10
function normTime_(s) {
  s = String(s || "").trim();
  var m = s.match(/^(\d{1,2})(?:[:.](\d{2}))?$/);
  if (!m) return null;
  var h = +m[1], mi = +(m[2] || 0);
  if (h > 24 || mi > 59) return null;
  return pad_(h) + ":" + pad_(mi);
}

function toDate_(d, t) {
  return Utilities.parseDate(d + " " + t, CONFIG.TZ, "yyyy-MM-dd HH:mm");
}

function label_(date) {
  return Utilities.formatDate(date, CONFIG.TZ, "EEEE d MMMM, HH:mm");
}

// All configured slots (ms since epoch), deduped, sorted.
function allSlots_() {
  var sh = sheet_(AVAIL);
  var out = {};
  if (!sh || sh.getLastRow() < 2) return [];
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getDisplayValues();
  var step = CONFIG.SLOT_MINUTES * 60000;
  rows.forEach(function (r) {
    var d = normDate_(r[0]), f = normTime_(r[1]), t = normTime_(r[2]);
    if (!d || !f || !t) return;
    var start = toDate_(d, f).getTime(), end = toDate_(d, t).getTime();
    for (var s = start; s + step <= end; s += step) out[s] = true;
  });
  return Object.keys(out).map(Number).sort(function (a, b) { return a - b; });
}

function activeBookings_() {
  var sh = sheet_(BOOK);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, BOOK_COLS.length).getValues()
    .filter(function (r) { return String(r[7]).toLowerCase() !== "cancelled"; });
}

function freeSlots_() {
  var taken = {};
  activeBookings_().forEach(function (r) { taken[new Date(String(r[1])).getTime()] = true; });
  var earliest = Date.now() + CONFIG.MIN_NOTICE_MINUTES * 60000;
  return allSlots_().filter(function (s) { return s >= earliest && !taken[s]; });
}

/* ---------- web endpoints ---------- */

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || "";
    if (action === "slots") {
      return json_({
        ok: true,
        tz: CONFIG.TZ,
        minutes: CONFIG.SLOT_MINUTES,
        slots: freeSlots_().map(function (s) { return new Date(s).toISOString(); })
      });
    }
    return json_({ ok: true, status: "Byte interview backend is running." });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var data = JSON.parse(e.postData.contents || "{}");
    if (data.website) return json_({ ok: true }); // honeypot

    var name = String(data.name || "").trim().slice(0, 120);
    var email = String(data.email || "").trim().toLowerCase().slice(0, 200);
    var slot = new Date(String(data.slot || "")).getTime();

    if (!name) return json_({ ok: false, code: "invalid", error: "Name is required." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json_({ ok: false, code: "invalid", error: "Email looks wrong." });
    if (isNaN(slot)) return json_({ ok: false, code: "invalid", error: "No time selected." });

    lock.waitLock(25000);

    if (CONFIG.ONE_BOOKING_PER_EMAIL) {
      var existing = activeBookings_().filter(function (r) { return String(r[4]).toLowerCase() === email; })[0];
      if (existing) {
        return json_({ ok: false, code: "already", error: "You already have an interview booked: " + existing[2] + ". Email guidebyte@gmail.com if you need to change it." });
      }
    }

    if (freeSlots_().indexOf(slot) === -1) {
      return json_({ ok: false, code: "taken", error: "Someone just took that time. Please pick another." });
    }

    var start = new Date(slot);
    var end = new Date(slot + CONFIG.SLOT_MINUTES * 60000);
    var guests = [email].concat(CONFIG.INTERVIEWERS.filter(function (x) { return x.toLowerCase() !== email; }));

    var ev = {
      summary: CONFIG.TITLE + " – " + name,
      description: "Byte 3 interview (" + CONFIG.SLOT_MINUTES + " min).\n\nCandidate: " + name + " <" + email + ">\n\nNeed to reschedule? Email guidebyte@gmail.com.",
      start: { dateTime: start.toISOString(), timeZone: CONFIG.TZ },
      end: { dateTime: end.toISOString(), timeZone: CONFIG.TZ },
      attendees: guests.map(function (g) { return { email: g }; }),
      guestsCanModify: false,
      guestsCanInviteOthers: false
    };
    if (CONFIG.ADD_MEET) {
      ev.conferenceData = { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: "hangoutsMeet" } } };
    }

    var created = Calendar.Events.insert(ev, CONFIG.CALENDAR_ID, { conferenceDataVersion: 1, sendUpdates: "all" });
    var lbl = label_(start);

    sheet_(BOOK).appendRow([
      new Date().toISOString(), start.toISOString(), lbl, name, email,
      created.id || "", created.hangoutLink || "", "booked"
    ]);
    SpreadsheetApp.flush();

    return json_({ ok: true, start: start.toISOString(), label: lbl, meet: created.hangoutLink || "" });
  } catch (err) {
    return json_({ ok: false, code: "error", error: String(err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}
