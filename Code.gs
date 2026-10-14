
var SHEET_ID = "1InpMhSblpJvz1LogFvvqEv4-YXaiPoQmSn_7bNZvais";

// Application form (Byte 3). Goes to the first tab of the sheet.
var COLUMNS = [
  "submitted_at",
  "full_name",
  "email",
  "phone",
  "date_of_birth",
  "age_at_deadline",
  "location",
  "eligibility_fi",
  "problems",
  "future",
  "blocker",
  "main_link",
  "main_link_why",
  "other_links",
  "who_to_meet",
  "success",
  "commitment",
  "commitment_detail",
  "passport_valid",
  "us_entry",
  "source",
  "source_detail",
  "referral",
  "gdpr_consent",
  "future_contact",
  "user_agent"
];

// Blurb form (joinbyte.so/blurb). Goes to the "Blurbs" tab, created on first use.
// The team publishes a blurb on joinbyte.so/batch by typing "yes" in its `publish` column.
var BLURB_SHEET = "Blurbs";
var BLURB_COLUMNS = [
  "submitted_at",
  "display_name",
  "full_name",
  "email",
  "age",
  "blurb",
  "highlight_1",
  "highlight_2",
  "highlight_3",
  "linkedin",
  "github",
  "website",
  "publish_consent",
  "user_agent",
  "publish",
  "order"
];
// Only these fields are ever returned by the public batch feed (never email).
var BLURB_PUBLIC = [
  "display_name", "age", "blurb", "highlight_1", "highlight_2", "highlight_3",
  "linkedin", "github", "website"
];

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function blurbSheet_() {
  var book = SpreadsheetApp.openById(SHEET_ID);
  var sheet = book.getSheetByName(BLURB_SHEET);
  if (!sheet) sheet = book.insertSheet(BLURB_SHEET);
  if (sheet.getLastRow() === 0) sheet.appendRow(BLURB_COLUMNS);
  return sheet;
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.form === "blurb") {
      var bs = blurbSheet_();
      data.publish = "";
      data.order = "";
      bs.appendRow(BLURB_COLUMNS.map(function (col) {
        return data[col] !== undefined ? String(data[col]) : "";
      }));
      return json_({ ok: true });
    }

    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(COLUMNS);
    }

    var row = COLUMNS.map(function (col) {
      return data[col] !== undefined ? String(data[col]) : "";
    });

    sheet.appendRow(row);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action === "batch") {
    try {
      var values = blurbSheet_().getDataRange().getValues();
      var head = values.shift();
      var idx = {};
      head.forEach(function (h, i) { idx[h] = i; });

      // Keep the latest submission per person, then only rows the team marked publish = yes.
      var latest = {};
      values.forEach(function (r) {
        var key = String(r[idx.email] || r[idx.full_name] || "").trim().toLowerCase();
        if (key) latest[key] = r;
      });

      var people = Object.keys(latest).map(function (k) { return latest[k]; })
        .filter(function (r) { return String(r[idx.publish]).trim().toLowerCase() === "yes"; })
        .sort(function (a, b) {
          var oa = Number(a[idx.order]) || 999, ob = Number(b[idx.order]) || 999;
          return oa - ob || String(a[idx.display_name]).localeCompare(String(b[idx.display_name]));
        })
        .map(function (r) {
          var o = {};
          BLURB_PUBLIC.forEach(function (c) { o[c] = r[idx[c]] === undefined ? "" : String(r[idx[c]]); });
          return o;
        });

      return json_({ ok: true, people: people });
    } catch (err) {
      return json_({ ok: false, error: err.message });
    }
  }

  return json_({ ok: true, status: "Byte form backend is running." });
}
