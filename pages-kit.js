/* ================================================================
   pages-kit.js — IEEE EMBS KPRIET
   Small shared toolkit for the redesigned content pages (Events,
   Projects, Blog, Podcast, Gallery). Vanilla, no dependencies.

   It is NOT an animation engine. Motion on these pages is owned by
   the existing systems:
     animations.js — hero + section headings (EMBS_ANIM_CONFIG)
     motion.js     — reveals of CMS-rendered cards, parallax, glow,
                     offscreen pausing
   This kit only adds what those lack: safe rendering helpers for
   read-only CMS presentation, a "rendered" hook for containers the
   page scripts fill, a page-progress hairline and magnetic CTAs.

   Exposes window.EMBSKit.
   ================================================================ */

(function (win, doc) {
  'use strict';

  var API = win.EMBS_API_BASE;
  var mqReduce = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var mqFine = win.matchMedia ? win.matchMedia('(hover: hover) and (pointer: fine)') : { matches: false };

  function q(sel, scope) { return (scope || doc).querySelector(sel); }
  function qa(sel, scope) { return Array.prototype.slice.call((scope || doc).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function safeUrl(u) {
    u = String(u || '').trim();
    return /^https?:\/\//i.test(u) ? u : '';
  }

  /* Right-sized Cloudinary delivery for untransformed upload URLs */
  function img(u, w) {
    u = safeUrl(u);
    if (!u) return '';
    return u.replace(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(v\d+\/)/,
      '$1f_auto,q_auto,c_limit,w_' + w + '/$2');
  }

  function plain(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  function excerpt(s, n) {
    s = plain(s);
    if (s.length <= n) return s;
    var cut = s.slice(0, n);
    var sp = cut.lastIndexOf(' ');
    return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:–—-]+$/, '') + '…';
  }

  function cap(s) { s = plain(s); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  /* "2026-08-13" is a calendar date: read as local, never shifted */
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    var d = new Date(s);
    return isNaN(d) ? null : d;
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function dateParts(d) {
    if (!d) return null;
    return {
      day: String(d.getDate()).padStart(2, '0'),
      mon: MONTHS[d.getMonth()],
      month: d.getMonth(),
      year: String(d.getFullYear()),
      iso: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
      full: d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear()
    };
  }

  function daysUntil(d) {
    if (!d) return null;
    var t = new Date();
    return Math.round((d - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000);
  }

  function list(path) {
    if (!API) return Promise.reject(new Error('no API base'));
    return fetch(API + path).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      if (Array.isArray(j)) return j;
      return j && Array.isArray(j.data) ? j.data : [];
    });
  }

  function settings() {
    if (!API) return Promise.resolve({});
    return fetch(API + '/site-settings/public')
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) { return (j && j.data) || {}; })
      .catch(function () { return {}; });
  }

  /* Run fn(container) now and whenever a page script re-renders the
     container's children (coalesced to one call per frame). */
  function onRender(container, fn) {
    if (!container) return;
    var queued = false;
    function run() { queued = false; fn(container); }
    new MutationObserver(function () {
      if (queued) return;
      queued = true;
      win.requestAnimationFrame(run);
    }).observe(container, { childList: true });
    fn(container);
  }

  /* Hand freshly inserted elements to motion.js so they reveal with
     the site's shared timing. */
  function reveal(els, variant) {
    var M = win.EMBSMotion;
    els = (els || []).filter(Boolean);
    if (!els.length) return;
    els.forEach(function (el) {
      if (!el.classList.contains('mo-reveal')) {
        el.classList.add('mo-reveal');
        if (variant) el.classList.add('mo-reveal--' + variant);
      }
    });
    if (M && M.refresh) M.refresh(els[0].parentNode || doc);
    else els.forEach(function (el) { el.classList.add('mo-done'); });
  }

  /* ── Page progress hairline ──────────────────────────────────── */
  function progress() {
    var bar = q('.xp-progress');
    if (!bar || mqReduce.matches) return;
    var pending = false;
    function paint() {
      pending = false;
      var max = Math.max(1, doc.documentElement.scrollHeight - win.innerHeight);
      bar.style.transform = 'scaleX(' + Math.min(1, Math.max(0, win.pageYOffset / max)).toFixed(4) + ')';
    }
    function req() { if (!pending) { pending = true; win.requestAnimationFrame(paint); } }
    win.addEventListener('scroll', req, { passive: true });
    win.addEventListener('resize', req, { passive: true });
    paint();
  }

  /* ── Magnetic CTAs (fine pointers only): gentle attraction, spring
     return (the spring lives in CSS: html.kit-mag .xp-magnetic) ── */
  function magnetic(scope) {
    if (mqReduce.matches || !mqFine.matches) return;
    doc.documentElement.classList.add('kit-mag');
    qa('.xp-magnetic', scope).forEach(function (btn) {
      if (btn._kitMag) return;
      btn._kitMag = true;
      var raf = 0, tx = 0, ty = 0;
      function apply() { raf = 0; btn.style.translate = tx.toFixed(1) + 'px ' + ty.toFixed(1) + 'px'; }
      btn.addEventListener('pointermove', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        var r = btn.getBoundingClientRect();
        tx = Math.max(-9, Math.min(9, (e.clientX - (r.left + r.width / 2)) * 0.26));
        ty = Math.max(-6, Math.min(6, (e.clientY - (r.top + r.height / 2)) * 0.34)) - 2;
        btn.classList.add('is-pulled');
        if (!raf) raf = win.requestAnimationFrame(apply);
      });
      btn.addEventListener('pointerleave', function () {
        btn.classList.remove('is-pulled');
        tx = 0; ty = 0;
        btn.style.translate = '';
      });
    });
  }

  function ready(fn) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  win.EMBSKit = {
    q: q, qa: qa, esc: esc, safeUrl: safeUrl, img: img, plain: plain, excerpt: excerpt, cap: cap,
    parseDate: parseDate, dateParts: dateParts, daysUntil: daysUntil, MONTHS: MONTHS,
    list: list, settings: settings, onRender: onRender, reveal: reveal,
    progress: progress, magnetic: magnetic, ready: ready,
    reduced: function () { return mqReduce.matches; }
  };

}(window, document));
