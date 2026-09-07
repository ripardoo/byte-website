/* Byte application form */
(function () {
  "use strict";

  var CFG   = window.BYTE_CONFIG || {};
  var form  = document.getElementById("form");
  if (!form) return;

  var elSubmit = document.getElementById("submit");
  var elSaved  = document.getElementById("saved");
  var elDone   = document.getElementById("done");
  var elErr    = document.getElementById("submitError");
  var elTopbar = document.getElementById("topbar");

  var KEY = "byte_application_v1";

  function store(){ try { return window.localStorage; } catch(e){ return null; } }

  function save() {
    var s = store(); if (!s) return;
    var data = {};
    collect(data, true);
    try {
      s.setItem(KEY, JSON.stringify({ data: data, at: Date.now() }));
      elSaved.textContent = "Saved";
      clearTimeout(save._t);
      save._t = setTimeout(function(){ elSaved.textContent = ""; }, 1800);
    } catch (e) {}
  }

  function restore() {
    var s = store(); if (!s) return;
    var raw;
    try { raw = s.getItem(KEY); } catch (e) { return; }
    if (!raw) return;
    var saved;
    try { saved = JSON.parse(raw); } catch (e) { return; }
    if (!saved || !saved.data) return;

    Object.keys(saved.data).forEach(function (name) {
      var val = saved.data[name];
      var nodes = form.querySelectorAll('[name="' + name + '"]');
      if (!nodes.length) return;
      if (nodes[0].type === "radio") {
        Array.prototype.forEach.call(nodes, function (n) { n.checked = (n.value === val); });
      } else if (nodes[0].type === "checkbox") {
        nodes[0].checked = !!val;
      } else {
        nodes[0].value = val;
      }
    });
  }

  function clearSaved(){ var s = store(); if (s) { try { s.removeItem(KEY); } catch(e){} } }

  function collect(into, includeEmpty) {
    var seen = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.name === "website") return;
      if (el.type === "radio") {
        if (el.checked) into[el.name] = el.value;
        else if (includeEmpty && !(el.name in into) && !seen[el.name]) { seen[el.name] = 1; }
      } else if (el.type === "checkbox") {
        into[el.name] = el.checked ? "yes" : "";
      } else {
        into[el.name] = el.value.trim();
      }
    });
    return into;
  }

  function ageAt(dobStr, atStr) {
    if (!dobStr) return "";
    var d = new Date(dobStr), a = new Date(atStr || CFG.AGE_AT || Date.now());
    if (isNaN(d.getTime()) || isNaN(a.getTime())) return "";
    var age = a.getFullYear() - d.getFullYear();
    var m = a.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && a.getDate() < d.getDate())) age--;
    return age >= 0 && age < 120 ? String(age) : "";
  }

  function syncConditionals() {
    form.querySelectorAll("[data-showif]").forEach(function (node) {
      var spec  = node.getAttribute("data-showif").split("=");
      var name  = spec[0];
      var wants = (spec[1] || "").split(",");
      var el    = form.querySelector('[name="' + name + '"]:checked') ||
                  form.querySelector('select[name="' + name + '"]');
      var val   = el ? el.value : "";
      var show  = wants.indexOf(val) !== -1;
      node.classList.toggle("hide", !show);
      var input = node.querySelector("input,textarea,select");
      if (input) {
        if (show) input.setAttribute("data-required", "1");
        else { input.removeAttribute("data-required"); node.classList.remove("invalid"); }
      }
    });
  }

  function fieldOf(el){ return el.closest(".field"); }

  function validateField(el) {
    var wrap = fieldOf(el);
    if (!wrap || wrap.classList.contains("hide")) return true;

    var required = el.hasAttribute("required") || el.hasAttribute("data-required");
    var ok = true;

    if (el.type === "radio" || el.type === "checkbox") {
      var group = form.querySelectorAll('[name="' + el.name + '"]');
      var any = Array.prototype.some.call(group, function (n) { return n.checked; });
      ok = required ? any : true;
    } else {
      var v = (el.value || "").trim();
      if (required && !v) ok = false;
      else if (v && el.type === "email") ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      else if (v && el.type === "tel") ok = v.replace(/[^0-9]/g, "").length >= 6;
      else if (v && el.minLength > 0) ok = v.length >= el.minLength;
    }

    wrap.classList.toggle("invalid", !ok);
    return ok;
  }

  function validateAll() {
    var ok = true;
    var firstBad = null;
    var checkedGroups = {};
    form.querySelectorAll("input,textarea,select").forEach(function (el) {
      if (!el.name || el.name === "website") return;
      if (el.type === "radio") {
        if (checkedGroups[el.name]) return;
        checkedGroups[el.name] = 1;
      }
      if (!validateField(el)) {
        ok = false;
        if (!firstBad) firstBad = fieldOf(el);
      }
    });
    if (firstBad) {
      var y = firstBad.getBoundingClientRect().top + window.pageYOffset - (elTopbar.offsetHeight + 24);
      window.scrollTo({ top: y, behavior: "smooth" });
    }
    return ok;
  }

  form.querySelectorAll("textarea[data-soft]").forEach(function (ta) {
    var soft = parseInt(ta.getAttribute("data-soft"), 10);
    var out  = ta.parentNode.querySelector(".counter");
    function upd() {
      if (!out) return;
      var n = ta.value.length;
      out.textContent = n ? n + (n > soft ? " / " + soft + " suggested" : "") : "";
      out.style.color = n > soft ? "#9a9a9a" : "";
    }
    ta.addEventListener("input", upd);
    upd();
  });

  form.addEventListener("input", function (e) {
    if (e.target.name) {
      if (fieldOf(e.target) && fieldOf(e.target).classList.contains("invalid")) validateField(e.target);
      clearTimeout(form._save);
      form._save = setTimeout(save, 500);
    }
  });

  form.addEventListener("change", function (e) {
    if (e.target.name) {
      validateField(e.target);
      syncConditionals();
      save();
    }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    elErr.style.display = "none";

    if (!validateAll()) return;

    if (form.elements.website && form.elements.website.value) return;

    var data = collect({}, false);
    data.submitted_at    = new Date().toISOString();
    data.age_at_deadline = ageAt(data.date_of_birth, CFG.AGE_AT);
    data.user_agent      = navigator.userAgent.slice(0, 200);

    elSubmit.disabled = true;
    elSubmit.textContent = "Sending…";

    var endpoint = CFG.ENDPOINT || "";
    if (!endpoint || endpoint.indexOf("PASTE_YOUR") === 0) {
      fail("The application form is not connected yet. Please email guidebyte@gmail.com — we'll sort it out immediately.");
      return;
    }

    fetch(endpoint, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data)
    })
      .then(function (r) { return r.text().then(function (t) { return { ok: r.ok, t: t }; }); })
      .then(function (res) {
        var okFlag = res.ok && res.t.indexOf('"ok":true') !== -1;
        if (!okFlag) throw new Error(res.t || "bad response");
        clearSaved();
        form.classList.add("hide");
        elTopbar.classList.add("hide");
        elDone.classList.remove("hide");
        window.scrollTo({ top: 0 });
      })
      .catch(function () {
        fail("Something went wrong sending your application. Your answers are still saved in this browser — try again in a moment, or email guidebyte@gmail.com and we'll take it by email.");
      });

    function fail(msg) {
      elErr.textContent = msg;
      elErr.style.display = "block";
      elSubmit.disabled = false;
      elSubmit.textContent = "Send application";
    }
  });

  (function deadlineGuard() {
    if (!CFG.DEADLINE) return;
    var end = new Date(CFG.DEADLINE + "T23:59:59+03:00");
    if (isNaN(end.getTime()) || Date.now() <= end.getTime()) return;
    form.classList.add("hide");
    elTopbar.classList.add("hide");
    elDone.classList.remove("hide");
    elDone.querySelector("h1").textContent = "Applications are closed.";
    elDone.querySelectorAll("p").forEach(function (p, i) { if (i) p.remove(); });
    elDone.querySelector("p").innerHTML =
      'Applications for this round closed on 21 September 2026. Byte runs once a year — email ' +
      '<a href="mailto:guidebyte@gmail.com">guidebyte@gmail.com</a> and we\'ll tell you when the next one opens.';
  })();

  restore();
  syncConditionals();
})();
