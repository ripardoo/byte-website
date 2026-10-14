/* Byte blurb form (joinbyte.so/blurb) */
(function () {
  "use strict";

  var CFG    = window.BYTE_CONFIG || {};
  var form   = document.getElementById("form");
  if (!form) return;

  var elSubmit = document.getElementById("submit");
  var elSaved  = document.getElementById("saved");
  var elDone   = document.getElementById("done");
  var elIntro  = document.getElementById("intro");
  var elErr    = document.getElementById("submitError");
  var elTopbar = document.getElementById("topbar");
  var KEY = "byte_blurb_v1";

  function store() { try { return window.localStorage; } catch (e) { return null; } }

  function collect() {
    var d = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.name === "website_hp") return;
      d[el.name] = el.value.trim();
    });
    return d;
  }

  function save() {
    var s = store(); if (!s) return;
    try {
      s.setItem(KEY, JSON.stringify(collect()));
      elSaved.textContent = "Saved";
      clearTimeout(save._t);
      save._t = setTimeout(function () { elSaved.textContent = ""; }, 1800);
    } catch (e) {}
  }

  function restore() {
    var s = store(); if (!s) return;
    var d;
    try { d = JSON.parse(s.getItem(KEY) || "null"); } catch (e) { return; }
    if (!d) return;
    Object.keys(d).forEach(function (k) {
      var el = form.elements[k];
      if (!el) return;
      el.value = d[k];
    });
  }

  function fieldOf(el) { return el.closest(".field"); }

  function validate(el) {
    var wrap = fieldOf(el);
    if (!wrap) return true;
    var v = (el.value || "").trim();
    var ok = true;
    if (el.required && !v) ok = false;
    else if (v && el.minLength > 0) ok = v.length >= el.minLength;
    wrap.classList.toggle("invalid", !ok);
    return ok;
  }

  function validateAll() {
    var first = null, ok = true;
    form.querySelectorAll("input,textarea").forEach(function (el) {
      if (!el.name || el.name === "website_hp") return;
      if (!validate(el)) { ok = false; if (!first) first = fieldOf(el); }
    });
    if (first) {
      var y = first.getBoundingClientRect().top + window.pageYOffset - (elTopbar.offsetHeight + 24);
      window.scrollTo({ top: y, behavior: "smooth" });
    }
    return ok;
  }

  var ta = document.getElementById("blurb");
  var counter = ta.parentNode.querySelector(".counter");
  var soft = parseInt(ta.getAttribute("data-soft"), 10);
  function count() {
    var n = ta.value.length;
    counter.textContent = n ? n + (n > soft ? " / " + soft + " suggested" : "") : "";
  }
  ta.addEventListener("input", count);

  form.addEventListener("input", function (e) {
    if (fieldOf(e.target) && fieldOf(e.target).classList.contains("invalid")) validate(e.target);
    clearTimeout(form._s);
    form._s = setTimeout(save, 500);
  });
  form.addEventListener("change", function (e) { validate(e.target); save(); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    elErr.style.display = "none";
    if (!validateAll()) return;
    if (form.elements.website_hp && form.elements.website_hp.value) return;

    var data = collect();
    data.form = "blurb";
    data.submitted_at = new Date().toISOString();
    data.user_agent = navigator.userAgent.slice(0, 200);

    elSubmit.disabled = true;
    elSubmit.textContent = "Sending…";

    fetch(CFG.ENDPOINT, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data)
    })
      .then(function (r) { return r.text().then(function (t) { return { ok: r.ok, t: t }; }); })
      .then(function (res) {
        if (!(res.ok && res.t.indexOf('"ok":true') !== -1)) throw new Error(res.t);
        try { store() && store().removeItem(KEY); } catch (e) {}
        form.classList.add("hide");
        elIntro.classList.add("hide");
        elDone.classList.remove("hide");
        window.scrollTo({ top: 0 });
      })
      .catch(function () {
        elErr.textContent = "Something went wrong sending your blurb. It's still saved in this browser, so try again in a moment, or email it to guidebyte@gmail.com.";
        elErr.style.display = "block";
        elSubmit.disabled = false;
        elSubmit.textContent = "Send blurb";
      });
  });

  restore();
  count();
})();
