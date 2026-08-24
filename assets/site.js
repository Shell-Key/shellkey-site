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
     Index page "Quick Message" form (kept working)
     --------------------------------------------------------------- */
  var contactForm = document.getElementById("contactForm");
  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = function (id) {
        var el = document.getElementById(id);
        return el ? el.value.trim() : "";
      };
      var body = [
        "Hi Shell Key,", "",
        "I'd like to request a demo / ask a question:", "",
        "Name: " + (v("qName") || "(not provided)"),
        "Email: " + (v("qEmail") || "(not provided)"), "",
        "Message:", v("qMsg") || "(no message entered)", "",
        "— Sent from shellkey.company"
      ].join("\n");
      window.location.href =
        "mailto:support@shellkey.company?subject=" +
        encodeURIComponent("Shell Key Website Inquiry") +
        "&body=" + encodeURIComponent(body);
    });
  }

  /* ---------------------------------------------------------------
     Request / appointment form
     --------------------------------------------------------------- */
  var requestForm = document.getElementById("requestForm");
  if (requestForm) {
    var itemSelect = document.getElementById("rItem");

    // Pre-select whatever product sent them here (?item=slug).
    var slug = new URLSearchParams(window.location.search).get("item");
    if (slug && itemSelect) {
      var match = Array.prototype.find.call(itemSelect.options, function (o) {
        return o.value === slug;
      });
      if (match) itemSelect.value = slug;
    }

    requestForm.addEventListener("submit", function (e) {
      e.preventDefault();

      var val = function (id) {
        var el = document.getElementById(id);
        return el ? el.value.trim() : "";
      };
      var chosen = itemSelect.options[itemSelect.selectedIndex];
      var itemLabel = chosen ? chosen.text : "(not selected)";
      var priority = document.getElementById("rPriority").checked;

      var subject = (priority ? "PRIORITY REQUEST: " : "Request: ") + itemLabel;

      var body = [
        "Shell Key — information request",
        "==============================", "",
        "ITEM:        " + itemLabel,
        "PRIORITY:    " + (priority ? "YES — needed as soon as possible" : "Standard"),
        "TIMEFRAME:   " + val("rWhen"), "",
        "CONTACT",
        "-------",
        "Name:        " + val("rName"),
        "Company:     " + val("rCompany"),
        "Email:       " + val("rEmail"),
        "Phone:       " + (val("rPhone") || "(not provided)"), "",
        "ADDRESS",
        "-------",
        val("rAddress"),
        val("rCity") + (val("rZip") ? "  " + val("rZip") : ""), "",
        "WHAT THEY ARE LOOKING FOR",
        "-------------------------",
        val("rNeed"), "",
        "— Sent from shellkey.company/request.html"
      ].join("\n");

      window.location.href =
        "mailto:support@shellkey.company?subject=" +
        encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);

      var ok = document.getElementById("formOk");
      if (ok) ok.classList.add("show");
    });
  }
})();
