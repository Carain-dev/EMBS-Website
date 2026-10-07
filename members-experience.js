/* ================================================================
   members-experience.js — IEEE EMBS KPRIET (members.html only)

   Presentation layer for Members. members-public.js still renders
   the advisors and the core team; this script only inserts the
   connector bus after the lead card (decoration, aria-hidden) so the
   team reads as one connected structure. The page's existing reveal
   (.mem-fade-in) and animations.js config are unchanged.
   ================================================================ */

(function (win, doc) {
  'use strict';

  var K = win.EMBSKit;
  if (!K) return;
  var q = K.q, qa = K.qa;

  function connect(grid) {
    var cards = qa('.cteam-card', grid);
    var bus = q('.mx-bus', grid);
    if (cards.length < 2) { if (bus) bus.remove(); return; }
    if (bus && bus.previousElementSibling === cards[0]) return;   /* already in place */
    if (!bus) {
      bus = doc.createElement('div');
      bus.className = 'mx-bus';
      bus.setAttribute('aria-hidden', 'true');
    }
    grid.insertBefore(bus, cards[0].nextSibling);
  }

  K.ready(function () {
    K.progress();
    K.magnetic(doc);
    K.onRender(q('.cteam-grid'), connect);
  });

}(window, document));
