(function () {
  'use strict';

  /*
   * announceBar.js — Live Updates Ticker
   *
   * Fetches GET /api/updates (the unified cross-CMS updates endpoint)
   * and populates the .announce-track element with a smooth CSS marquee.
   *
   * Each item is rendered as a clickable link so visitors can navigate
   * to the underlying content page.
   *
   * Seamless loop: TWO identical copies of the content are injected.
   * The CSS animates translateX(0) → translateX(-50%), scrolling the
   * first copy off-screen while the second copy seamlessly takes its place.
   * The duration is calculated from content width ÷ scroll speed so the
   * ticker always moves at a consistent reading speed.
   *
   * Empty state   → track stays empty; CSS :empty rule stops the animation.
   * API failure   → silent; track stays empty; page unaffected.
   * reduced-motion→ animation paused (CSS media query in navbar.css).
   */

  var API_BASE = window.EMBS_API_BASE;

  /* Reading speed: pixels per second. 80 px/s is comfortable for a ticker. */
  var SCROLL_SPEED = 80;

  /* Floor duration so very short content isn't unreadable. */
  var MIN_SECS = 12;

  /* Separator between items. */
  var SEP = '<span class="announce-sep" aria-hidden="true">&#8212;</span>';

  /* Sanitise against XSS — titles come from the admin CMS but we still
     escape so no injected markup can reach the DOM. */
  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildHTML(items) {
    return items.map(function (item) {
      var href = item.url ? esc(item.url) : '#';
      return '<a class="announce-item" href="' + href + '">' +
               esc(item.title) +
             '</a>';
    }).join(SEP);
  }

  async function load() {
    var track = document.querySelector('.announce-track');
    if (!track || !API_BASE) return;

    try {
      var res  = await fetch(API_BASE + '/updates');
      var json = await res.json();
      var items = Array.isArray(json && json.data) ? json.data
                : Array.isArray(json) ? json : [];

      if (!items.length) return; /* leave track empty — CSS :empty stops animation */

      var oneSetHTML = buildHTML(items);

      /* Inject one copy to measure its pixel width */
      track.innerHTML = oneSetHTML;

      /* Wait for layout before measuring */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          var w = track.scrollWidth;

          /* Two copies for seamless loop */
          track.innerHTML = oneSetHTML + SEP + oneSetHTML;

          /* Duration based on content length */
          var dur = Math.max(MIN_SECS, Math.round(w / SCROLL_SPEED));
          track.style.setProperty('--marquee-duration', dur + 's');
          if (track.parentElement) {
            track.parentElement.style.setProperty('--marquee-duration', dur + 's');
          }
        });
      });

    } catch (err) {
      console.warn('[announceBar] Could not load updates:', err.message);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }

})();
