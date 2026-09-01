document.addEventListener("DOMContentLoaded", function () {

  /* ── Footer social links ───────────────────────────────────
     The markup ships four icons pointing at "#". Rather than leave
     dead links on every page, each is matched to its entry in
     window.EMBS_SOCIAL and hidden when no URL is configured. */
  (function wireSocialLinks() {
    var config = window.EMBS_SOCIAL || {};

    // Footer icons and the contact page's larger social buttons.
    var icons = document.querySelectorAll(".footer-social-icon, .contact-social-btn, [data-social]");

    icons.forEach(function (icon) {
      var key = icon.getAttribute("data-social") ||
                (icon.getAttribute("aria-label") || "").toLowerCase();

      // "Twitter / X" and similar labels need normalising to a config key.
      key = key.replace(/\s*\/\s*x$/, '').replace(/[^a-z]/g, '');

      var url = config[key];

      if (url) {
        icon.setAttribute("href", url);
        icon.setAttribute("target", "_blank");
        icon.setAttribute("rel", "noopener");
      } else {
        icon.hidden = true;
      }
    });
  })();

  /* Back to top. This lived in ten separate page scripts, so on the pages
     that load none of them (gallery, contact) the button did nothing. */
  (function wireBackToTop() {
    var btn = document.getElementById("backToTop");
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = "1";

    window.addEventListener("scroll", function () {
      btn.classList.toggle("visible", window.scrollY > 400);
    });

    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  })();

  var navbar    = document.getElementById("navbar");
  var hamburger = document.getElementById("hamburger");
  var navLinks  = document.getElementById("navLinks");

  if (!navbar || !hamburger || !navLinks) { return; }

  /* Announce the drawer's state to screen readers. Set here rather than in
     each page's markup so all 13 pages stay in sync automatically. */
  if (!navLinks.id) { navLinks.id = "navLinks"; }
  hamburger.setAttribute("aria-controls", navLinks.id);
  hamburger.setAttribute("aria-expanded", "false");

  function setMenu(open) {
    hamburger.classList.toggle("open", open);
    navLinks.classList.toggle("open", open);
    hamburger.setAttribute("aria-expanded", open ? "true" : "false");
    hamburger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }

  function closeAllDropdowns() {
    dropdowns.forEach(function (d) {
      d.classList.remove("open");
      var a = d.querySelector(".nav-dropdown-arrow");
      if (a) { a.setAttribute("aria-expanded", "false"); }
    });
  }

  /* Scroll */
  window.addEventListener("scroll", function () {
    navbar.classList.toggle("scrolled", window.scrollY > 20);
  });

  /* Hamburger toggle */
  hamburger.addEventListener("click", function (e) {
    e.stopPropagation();
    setMenu(!navLinks.classList.contains("open"));
  });

  /* Close menu on plain link click */
  navLinks.querySelectorAll("li:not(.nav-item-dropdown) .nav-link").forEach(function (link) {
    link.addEventListener("click", function () {
      setMenu(false);
    });
  });

  /* Dropdowns */
  var dropdowns = document.querySelectorAll(".nav-item-dropdown");

  dropdowns.forEach(function (dropdown) {
    var arrow = dropdown.querySelector(".nav-dropdown-arrow");
    var link  = dropdown.querySelector(".nav-link");
    var menu  = dropdown.querySelector(".nav-dropdown");

    if (arrow) {
      arrow.setAttribute("aria-expanded", "false");
      if (menu) {
        if (!menu.id) {
          menu.id = "navDropdown-" + Math.random().toString(36).slice(2, 8);
        }
        arrow.setAttribute("aria-controls", menu.id);
      }
    }

    function toggleDropdown(e) {
      e.stopPropagation();
      var isOpen = dropdown.classList.contains("open");
      closeAllDropdowns();
      if (!isOpen) {
        dropdown.classList.add("open");
        if (arrow) { arrow.setAttribute("aria-expanded", "true"); }
      }
    }

    if (arrow) {
      arrow.addEventListener("click", toggleDropdown);
    }

    /* "Community" has no page of its own (href="javascript:void(0)"), so its
       label has to act as the toggle. Labels that do point at a real page keep
       navigating -- the chevron beside them is what opens the submenu. Making
       every label toggle instead would leave activities.html unreachable on
       phones, since it is not repeated inside its own dropdown. */
    if (link) {
      var href = (link.getAttribute("href") || "").trim();
      var isPlaceholder = !href || href === "#" || href.indexOf("javascript:") === 0;

      if (isPlaceholder) {
        link.addEventListener("click", function (e) {
          e.preventDefault();
          toggleDropdown(e);
        });
      }
    }

    dropdown.querySelectorAll(".nav-dropdown-item").forEach(function (item) {
      item.addEventListener("click", function () {
        closeAllDropdowns();
        setMenu(false);
      });
    });
  });

  /* Outside click closes everything */
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".nav-item-dropdown")) {
      closeAllDropdowns();
    }
    if (!e.target.closest(".navbar")) {
      setMenu(false);
    }
  });

  /* Escape closes the drawer and returns focus to the toggle. */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") { return; }
    if (navLinks.classList.contains("open") ||
        document.querySelector(".nav-item-dropdown.open")) {
      closeAllDropdowns();
      setMenu(false);
      hamburger.focus();
    }
  });

  /* Leaving mobile width with the drawer open would otherwise strand the
     `open` class on the desktop layout. */
  var desktop = window.matchMedia("(min-width: 901px)");
  var onChange = function (ev) {
    if (ev.matches) {
      closeAllDropdowns();
      setMenu(false);
    }
  };
  if (desktop.addEventListener) { desktop.addEventListener("change", onChange); }
  else if (desktop.addListener) { desktop.addListener(onChange); }
});
