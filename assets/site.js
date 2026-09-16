/* ==========================================================================
   site.js — shared behaviour for every Shell Key page.
   Mobile nav · fullscreen image viewer · request form.
   Each block checks its elements exist first, so one file serves all pages.
   ========================================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------------------
     Mobile nav
     --------------------------------------------------------------- */
  var navToggle = document.getElementById("navToggle");
  var navLinks = document.getElementById("navLinks");

  if (navToggle && navLinks) {
    var closeMenu = function () {
      navLinks.classList.remove("open");
      navToggle.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    };

    navToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      var isOpen = navLinks.classList.toggle("open");
      navToggle.classList.toggle("open", isOpen);
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    document.querySelectorAll(".nav-link").forEach(function (a) {
      a.addEventListener("click", closeMenu);
    });

    document.addEventListener("click", function (e) {
      if (!e.target.closest(".nav")) closeMenu();
    });
  }

  /* ---------------------------------------------------------------
     Fullscreen image viewer — pinch zoom and drag
     --------------------------------------------------------------- */
  var viewer = document.getElementById("viewer");

  if (viewer) {
    var viewerImg = document.getElementById("viewerImg");
    var viewerBackdrop = document.getElementById("viewerBackdrop");
    var viewerClose = document.getElementById("viewerClose");
    var viewerOpenNew = document.getElementById("viewerOpenNew");
    var viewerReset = document.getElementById("viewerReset");
    var stage = document.getElementById("viewerStage");

    var scale = 1, translateX = 0, translateY = 0, maxScale = 6;

    var applyTransform = function () {
      viewerImg.style.transform =
        "translate(" + translateX + "px," + translateY + "px) scale(" + scale + ")";
    };
    var resetTransform = function () {
      scale = 1; translateX = 0; translateY = 0; applyTransform();
    };

    // Never display an image larger than its own pixels. Stretching a
    // 1520px screenshot across a 1900px window softens it before the user
    // has zoomed at all — that upscale is what reads as "fuzzy".
    var fitToNativeSize = function () {
      var nw = viewerImg.naturalWidth, nh = viewerImg.naturalHeight;
      if (!nw || !nh) return;
      var capW = Math.min(window.innerWidth * 0.94, nw);
      var capH = Math.min(window.innerHeight * 0.88, nh);
      viewerImg.style.maxWidth = capW + "px";
      viewerImg.style.maxHeight = capH + "px";

      // Allow zooming to twice native resolution for reading small labels,
      // but no further — past that there is no detail left to reveal.
      var shown = Math.min(capW, nw * (capH / nh));
      maxScale = Math.max(2, Math.min(6, (nw / shown) * 2));
    };

    viewerImg.addEventListener("load", fitToNativeSize);
    window.addEventListener("resize", function () {
      if (viewer.classList.contains("open")) fitToNativeSize();
    });

    var openViewer = function (src) {
      viewerImg.removeAttribute("style");
      viewerImg.src = src;
      viewerOpenNew.href = src;
      resetTransform();
      if (viewerImg.complete) fitToNativeSize();
      viewer.classList.add("open");
      viewer.setAttribute("aria-hidden", "false");
      document.body.classList.add("no-scroll");
    };
    var closeViewer = function () {
      viewer.classList.remove("open");
      viewer.setAttribute("aria-hidden", "true");
      document.body.classList.remove("no-scroll");
      viewerImg.src = "";
    };

    document.querySelectorAll(".zoomable").forEach(function (img) {
      img.addEventListener("click", function () {
        openViewer(img.getAttribute("data-full") || img.src);
      });
    });

    viewerBackdrop.addEventListener("click", closeViewer);
    viewerClose.addEventListener("click", closeViewer);
    viewerReset.addEventListener("click", resetTransform);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && viewer.classList.contains("open")) closeViewer();
    });

    var isDragging = false, startX = 0, startY = 0;
    var pinchStartDist = 0, pinchStartScale = 1;
    var dist = function (a, b) {
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };

    stage.addEventListener("touchstart", function (e) {
      if (!viewer.classList.contains("open")) return;
      if (e.touches.length === 2) {
        pinchStartDist = dist(e.touches[0], e.touches[1]);
        pinchStartScale = scale;
      } else if (e.touches.length === 1) {
        isDragging = true;
        startX = e.touches[0].clientX - translateX;
        startY = e.touches[0].clientY - translateY;
      }
    }, { passive: true });

    stage.addEventListener("touchmove", function (e) {
      if (!viewer.classList.contains("open")) return;
      if (e.touches.length === 2 && pinchStartDist) {
        scale = Math.min(maxScale, Math.max(1,
          pinchStartScale * (dist(e.touches[0], e.touches[1]) / pinchStartDist)));
        applyTransform();
      } else if (e.touches.length === 1 && isDragging) {
        translateX = e.touches[0].clientX - startX;
        translateY = e.touches[0].clientY - startY;
        applyTransform();
      }
    }, { passive: true });

    stage.addEventListener("touchend", function () {
      isDragging = false; pinchStartDist = 0;
    });

    stage.addEventListener("mousedown", function (e) {
      if (!viewer.classList.contains("open")) return;
      isDragging = true;
      startX = e.clientX - translateX;
      startY = e.clientY - translateY;
    });
    window.addEventListener("mousemove", function (e) {
      if (!isDragging) return;
      translateX = e.clientX - startX;
      translateY = e.clientY - startY;
      applyTransform();
    });
    window.addEventListener("mouseup", function () { isDragging = false; });

    stage.addEventListener("wheel", function (e) {
      if (!viewer.classList.contains("open")) return;
      e.preventDefault();
      scale = Math.min(maxScale, Math.max(1, scale + (e.deltaY < 0 ? 0.15 : -0.15)));
      applyTransform();
    }, { passive: false });
  }

  /* ---------------------------------------------------------------
     Visitor tracking — first-party, no cookies from third parties.
     One anonymous id per browser (localStorage), one page view per load,
     plus clicks on checkout buttons. Everything lands in the CRM.
     --------------------------------------------------------------- */
  var SK_API = "/api";
  var sid = null;
  try {
    sid = localStorage.getItem("sk_sid");
    if (!sid) {
      sid = "s_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("sk_sid", sid);
    }
  } catch (err) { sid = "s_anon"; }

  var track = function (type, extra) {
    try {
      var params = new URLSearchParams(window.location.search);
      var payload = Object.assign({
        sid: sid, type: type || "view",
        page: window.location.pathname, ref: document.referrer || "",
        utm_source: params.get("utm_source") || "", utm_campaign: params.get("utm_campaign") || "",
        w: window.innerWidth
      }, extra || {});
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(SK_API + "/track", new Blob([body], { type: "application/json" }));
      } else {
        fetch(SK_API + "/track", { method: "POST", body: body, keepalive: true,
          headers: { "Content-Type": "application/json" } }).catch(function () {});
      }
    } catch (err) { /* tracking must never break the page */ }
  };
  track("view");
  // Store cards: count one impression per card per visit when it scrolls into view
  var cards = document.querySelectorAll(".product-card[data-slug]");
  if (cards.length && "IntersectionObserver" in window) {
    var seen = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var slug = en.target.getAttribute("data-slug");
        if (en.isIntersecting && !seen[slug]) { seen[slug] = 1; track("impression", { item: slug }); io.unobserve(en.target); }
      });
    }, { threshold: 0.5 });
    cards.forEach(function (c) { io.observe(c); });
  }
  document.querySelectorAll("[data-track]").forEach(function (a) {
    a.addEventListener("click", function () {
      track(a.getAttribute("data-track"), { item: a.getAttribute("data-item") || "" });
    });
  });

  /* ---------------------------------------------------------------
     Lead submission — POST to the CRM; fall back to the mail app if
     the API is unreachable (e.g. previewing the HTML from disk).
     --------------------------------------------------------------- */
  var submitLead = function (lead, mailtoSubject, mailtoBody, onOk, onErr) {
    lead.sid = sid;
    lead.page = window.location.pathname + window.location.search;
    fetch(SK_API + "/lead", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead)
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function () { onOk(); })
      .catch(function () {
        if (window.location.protocol === "file:" || !window.fetch) {
          window.location.href = "mailto:support@shellkey.company?subject=" +
            encodeURIComponent(mailtoSubject) + "&body=" + encodeURIComponent(mailtoBody);
          onOk();
        } else { onErr(); }
      });
  };

  var setBusy = function (form, busy) {
    var btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = busy;
    if (busy) { btn.dataset.label = btn.textContent; btn.textContent = "Sending…"; }
    else if (btn.dataset.label) { btn.textContent = btn.dataset.label; }
  };

  /* ---------------------------------------------------------------
     Index page "Quick Message" form
     --------------------------------------------------------------- */
  var contactForm = document.getElementById("contactForm");
  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; };
      var lead = { kind: "contact", name: v("qName"), email: v("qEmail"), company: v("qCompany"),
                   phone: v("qPhone"), interest: v("qInterest"), message: v("qMsg") };
      if (!lead.name && !lead.email && !lead.message) return;
      var body = ["Name: " + lead.name, "Email: " + lead.email, "", lead.message, "", "— Sent from shellkey.company"].join("\n");
      setBusy(contactForm, true);
      submitLead(lead, "Shell Key Website Inquiry", body, function () {
        setBusy(contactForm, false);
        contactForm.reset();
        var ok = document.getElementById("contactOk"); if (ok) ok.classList.add("show");
        var er = document.getElementById("contactErr"); if (er) er.classList.remove("show");
      }, function () {
        setBusy(contactForm, false);
        var er = document.getElementById("contactErr"); if (er) er.classList.add("show");
      });
    });
  }

  /* ---------------------------------------------------------------
     Request / quote form (request.html)
     --------------------------------------------------------------- */
  var requestForm = document.getElementById("requestForm");
  if (requestForm) {
    var itemSelect = document.getElementById("rItem");
    var qs = new URLSearchParams(window.location.search);
    var slug = qs.get("item");
    var rType = document.getElementById("rType");
    if (rType && qs.get("type")) {
      var want = qs.get("type").toLowerCase();
      Array.prototype.forEach.call(rType.options, function (o) { if (o.value.toLowerCase() === want) rType.value = o.value; });
    }
    if (slug && itemSelect) {
      var match = Array.prototype.find.call(itemSelect.options, function (o) { return o.value === slug; });
      if (match) itemSelect.value = slug;
    }

    requestForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var val = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; };
      var priority = !!(document.getElementById("rPriority") || {}).checked;
      var itemLabel = itemSelect && itemSelect.selectedIndex >= 0 ? itemSelect.options[itemSelect.selectedIndex].text : "";
      var lead = {
        kind: "request", item: itemSelect ? itemSelect.value : "", item_label: itemLabel,
        interest: val("rType"),
        priority: priority, name: val("rName"), company: val("rCompany"), email: val("rEmail"),
        phone: val("rPhone"), address: val("rAddress"), city: val("rCity"), zip: val("rZip"),
        message: val("rNeed"), timeframe: val("rWhen")
      };
      var subject = (priority ? "PRIORITY REQUEST: " : "Request: ") + val("rType") + " — " + itemLabel;
      var body = ["ITEM: " + itemLabel, "PRIORITY: " + (priority ? "YES" : "Standard"),
        "NAME: " + lead.name, "COMPANY: " + lead.company, "EMAIL: " + lead.email, "PHONE: " + lead.phone,
        "ADDRESS: " + lead.address + ", " + lead.city + " " + lead.zip, "WHEN: " + lead.timeframe, "",
        lead.message].join("\n");
      setBusy(requestForm, true);
      submitLead(lead, subject, body, function () {
        setBusy(requestForm, false);
        requestForm.reset();
        var ok = document.getElementById("formOk"); if (ok) ok.classList.add("show");
        var er = document.getElementById("formErr"); if (er) er.classList.remove("show");
        ok && ok.scrollIntoView({ behavior: "smooth", block: "center" });
      }, function () {
        setBusy(requestForm, false);
        var er = document.getElementById("formErr"); if (er) er.classList.add("show");
      });
    });
  }

  /* ---------------------------------------------------------------
     Demo frame (demo.html) — gate once, then load the product demo
     with Buy / Request / Customize always one click away.
     --------------------------------------------------------------- */
  var demoFrame = document.getElementById("demoFrame");
  if (demoFrame && window.SK_DEMOS) {
    var dq = new URLSearchParams(window.location.search);
    var dslug = dq.get("item") || "";
    var D = window.SK_DEMOS[dslug];
    var gate = document.getElementById("gate");
    if (!D) {
      gate.hidden = true; document.getElementById("missing").hidden = false;
    } else {
      document.title = "Free demo: " + D.name + " | Shell Key";
      document.getElementById("dName").textContent = D.name;
      document.getElementById("dPrice").textContent = D.price ? "· " + D.price + (D.note ? " " + D.note.replace(/&middot;/g, "·") : "") : "";
      var buy = document.getElementById("dBuy");
      if (D.buy) { buy.href = D.buy; buy.textContent = D.subscribe ? "Subscribe now" : "Buy now"; buy.setAttribute("data-track", "checkout"); buy.setAttribute("data-item", dslug); }
      else { buy.href = "request.html?item=" + dslug + "&type=Purchase"; buy.textContent = "Order by request"; }
      document.getElementById("dReq").href = "request.html?item=" + dslug + "&type=Purchase";
      document.getElementById("dCust").href = "request.html?item=" + dslug + "&type=Customization";
      document.getElementById("dOpen").href = D.demo;
      buy.addEventListener("click", function () { track("checkout", { item: dslug }); });

      var unlocked = false;
      try { unlocked = !!localStorage.getItem("sk_demo_ok"); } catch (err) {}
      var openDemo = function () {
        gate.hidden = true;
        demoFrame.src = D.demo;
        demoFrame.hidden = false;
        track("demo_open", { item: dslug });
      };
      if (unlocked) openDemo();

      var gateForm = document.getElementById("gateForm");
      gateForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; };
        var lead = { kind: "demo", name: v("gName"), company: v("gCompany"), email: v("gEmail"), phone: v("gPhone"),
                     item: dslug, item_label: D.name, interest: "Demo", message: "Opened the free demo of " + D.name };
        setBusy(gateForm, true);
        submitLead(lead, "Demo request: " + D.name, "Name: " + lead.name + "\nCompany: " + lead.company + "\nEmail: " + lead.email,
          function () { setBusy(gateForm, false); try { localStorage.setItem("sk_demo_ok", "1"); } catch (err) {} openDemo(); },
          function () { setBusy(gateForm, false); var er = document.getElementById("gateErr"); if (er) er.classList.add("show"); });
      });
    }
  }

  /* ---------------------------------------------------------------
     Real activity counters on product cards / pages.
     Views and demo starts: last 30 days. Sales: only shown once real.
     --------------------------------------------------------------- */
  var proofEls = document.querySelectorAll("[data-proof]");
  if (proofEls.length) {
    fetch(SK_API + "/stats").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.ok) return;
      var fmt = function (n) { return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n); };
      proofEls.forEach(function (el) {
        var slug = el.getAttribute("data-proof");
        var ref = el.getAttribute("data-ref") || "";
        var p = d.products[slug] || { views: 0, demos: 0 };
        var sold = 0;
        Object.keys(d.sales_by_ref || {}).forEach(function (k) { if (k && ref.indexOf(k) >= 0) sold += d.sales_by_ref[k]; });
        var parts = [];
        if (sold > 0) parts.push('<span class="sold"><b>' + fmt(sold) + '</b> ' + (sold === 1 ? "company subscribed" : "subscribed") + '</span>');
        if (p.demos > 0) parts.push('<span><b>' + fmt(p.demos) + '</b> ' + (p.demos === 1 ? "demo started" : "demos started") + ' this month</span>');
        if (p.views > 0) parts.push('<span><b>' + fmt(p.views) + '</b> ' + (p.views === 1 ? "view" : "views") + ' this month</span>');
        if (!parts.length) parts.push('<span>New this month</span>');
        el.innerHTML = parts.join("");
      });
    }).catch(function () {});
  }
})();
