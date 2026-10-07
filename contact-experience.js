/* ================================================================
   contact-experience.js — IEEE EMBS KPRIET (contact.html only)

   Contact has no CMS content of its own to render. This only starts
   the shared page-progress hairline and magnetic CTA; motion.js
   reveals the blocks marked .mo-reveal. contactForm.js (sending) and
   navbar.js (CMS details, socials, map) are untouched.
   ================================================================ */

(function (win) {
  'use strict';
  var K = win.EMBSKit;
  if (!K) return;
  K.ready(function () {
    K.progress();
    K.magnetic(document);
  });
}(window));
