/* Byte interview booking */
(function () {
  "use strict";

  var CFG = window.BYTE_CONFIG || {};
  var ENDPOINT = CFG.INTERVIEW_ENDPOINT || "";
  var TZ = "Europe/Helsinki";
  var MINUTES = 15;

  var elSlots = document.getElementById("slots");
  var form = document.getElementById("form");
  var elChosen = document.getElementById("chosen");
  var elSubmit = document.getElementById("submit");
  var elMsg = document.getElementById("msg");
  var selected = null;

  var fmtDay = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
  var fmtTime = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  var fmtKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

  function label(iso) {
    var s = new Date(iso), e = new Date(s.getTime() + MINUTES * 60000);
    return fmtDay.format(s) + ", " + fmtTime.format(s) + "–" + fmtTime.format(e);
  }

  // Prefill from ?name=&email= so personalised links work
  (function () {
    var p = new URLSearchParams(location.search);
    if (p.get("name")) form.elements.name.value = p.get("name");
    if (p.get("email")) form.elements.email.value = p.get("email");
  })();

  function empty(text) {
    elSlots.innerHTML = "";
    var p = document.createElement("p");
    p.className = "empty";
    p.innerHTML = text;
    elSlots.appendChild(p);
  }

  function render(slots) {
    elSlots.innerHTML = "";
    if (!slots.length) {
      empty('No times are open right now. Email <a href="mailto:guidebyte@gmail.com">guidebyte@gmail.com</a> and we\'ll find one.');
      form.classList.add("hide");
      return;
    }
    var days = {}, order = [];
    slots.forEach(function (iso) {
      var k = fmtKey.format(new Date(iso));
      if (!days[k]) { days[k] = []; order.push(k); }
      days[k].push(iso);
    });
    order.forEach(function (k) {
      var wrap = document.createElement("div");
      wrap.className = "day";
      var h = document.createElement("div");
      h.className = "day-name";
      h.textContent = fmtDay.format(new Date(days[k][0]));
      var grid = document.createElement("div");
      grid.className = "grid";
      days[k].forEach(function (iso) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "slot";
        b.textContent = fmtTime.format(new Date(iso));
        b.setAttribute("aria-pressed", iso === selected ? "true" : "false");
        b.setAttribute("aria-label", label(iso));
        b.addEventListener("click", function () { choose(iso); });
        grid.appendChild(b);
      });
      wrap.appendChild(h);
      wrap.appendChild(grid);
      elSlots.appendChild(wrap);
    });
    if (selected && slots.indexOf(selected) === -1) { selected = null; form.classList.add("hide"); }
  }

  function choose(iso) {
    selected = iso;
    elSlots.querySelectorAll(".slot").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("aria-label") === label(iso) ? "true" : "false");
    });
    elChosen.innerHTML = "";
    elChosen.appendChild(document.createTextNode(label(iso) + " "));
    var span = document.createElement("span");
    span.textContent = "(Finnish time)";
    elChosen.appendChild(span);
    elMsg.classList.add("hide");
    form.classList.remove("hide");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(function () {
      var f = !form.elements.name.value ? form.elements.name : (!form.elements.email.value ? form.elements.email : elSubmit);
      f.focus({ preventScroll: true });
    }, 300);
  }

  function load() {
    if (!ENDPOINT) {
      empty('Booking isn\'t open yet. Email <a href="mailto:guidebyte@gmail.com">guidebyte@gmail.com</a> to book.');
      return Promise.resolve();
    }
    return fetch(ENDPOINT + "?action=slots&t=" + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) throw new Error(d.error || "error");
        if (d.minutes) MINUTES = d.minutes;
        render(d.slots || []);
      })
      .catch(function () {
        empty('Couldn\'t load times. Refresh the page, or email <a href="mailto:guidebyte@gmail.com">guidebyte@gmail.com</a>.');
      });
  }

  function showMsg(t) { elMsg.textContent = t; elMsg.classList.remove("hide"); }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!selected) return;
    var name = form.elements.name.value.trim();
    var email = form.elements.email.value.trim();
    if (!name) { showMsg("Please add your name."); form.elements.name.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { showMsg("Please check your email address."); form.elements.email.focus(); return; }

    elSubmit.disabled = true;
    elSubmit.textContent = "Booking…";
    elMsg.classList.add("hide");

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ name: name, email: email, slot: selected, website: form.elements.website.value })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) {
          document.getElementById("picker").classList.add("hide");
          document.getElementById("doneWhen").textContent = label(d.start || selected) + " (Finnish time)";
          document.getElementById("done").classList.remove("hide");
          window.scrollTo({ top: 0 });
          return;
        }
        if (d.code === "taken") {
          selected = null;
          form.classList.add("hide");
          load().then(function () {
            var n = document.createElement("p");
            n.className = "msg";
            n.style.margin = "0 0 20px";
            n.textContent = d.error;
            elSlots.insertBefore(n, elSlots.firstChild);
            elSlots.scrollIntoView({ behavior: "smooth", block: "start" });
          });
          return;
        }
        showMsg(d.error || "Something went wrong. Please try again.");
      })
      .catch(function () {
        showMsg("Something went wrong. Please try again, or email guidebyte@gmail.com.");
      })
      .then(function () {
        elSubmit.disabled = false;
        elSubmit.textContent = "Book this time";
      });
  });

  load();
})();
