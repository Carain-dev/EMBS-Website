/* ════════════════════════════════════════════════════════════════
   config.js — the ONE place the backend address is configured.

   Every public page and every admin page loads this file before its
   own scripts, so changing the line below repoints the entire site.

   Include no trailing slash. The path must end in /api.
   ════════════════════════════════════════════════════════════════ */

window.EMBS_API_BASE = 'https://embs-website-89fl.onrender.com/api';


/* ── Social links ────────────────────────────────────────────
   Fill these in with the chapter's real accounts. Any left empty
   is hidden from the footer rather than shown as a dead link. */

window.EMBS_SOCIAL = {
  linkedin:  '',
  instagram: '',
  twitter:   '',
  youtube:   '',
  spotify:   '',
};


/* ── Nothing below here needs editing ───────────────────────── */

/* Send the auth cookie with API requests.
 *
 * Logging in sets an httpOnly, Secure, SameSite=None cookie, which is a safer
 * place for a session than localStorage because scripts cannot read it. But a
 * cross-origin fetch only sends cookies when it opts in with
 * `credentials: 'include'`, and none of the admin scripts did, so that cookie
 * was never actually used and auth rested entirely on the readable token.
 *
 * Patching fetch here adds the opt-in for calls to our own API only, in one
 * place rather than at 26 separate call sites. Anything that sets
 * `credentials` explicitly is left alone. */
(function () {
  var nativeFetch = window.fetch;
  if (typeof nativeFetch !== 'function') return;

  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var base = window.EMBS_API_BASE || '';

    var isOurApi = base && url.indexOf(base) === 0;

    if (isOurApi && (!init || init.credentials === undefined)) {
      init = Object.assign({}, init, { credentials: 'include' });
    }

    return nativeFetch.call(this, input, init);
  };
})();

/* When the site is opened from a local server, prefer a same-origin
   /api path if one is being proxied. Harmless in production, where
   no such proxy exists and the value above is used unchanged. */
(function () {
  var host = window.location.hostname;
  var isLocal = host === 'localhost' || host === '127.0.0.1';

  if (isLocal && window.EMBS_LOCAL_API_PROXY) {
    window.EMBS_API_BASE = '/api';
  }
})();
