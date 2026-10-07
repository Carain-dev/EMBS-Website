/* ================================================================
   podcast-experience.js — IEEE EMBS KPRIET (podcast.html only)

   Presentation layer for the EMBS Podcast. podcast-public.js still
   owns the episodes, featured card, guests, topic filter and the
   Spotify player; this script only:
     • puts the podcast's real cover art (site settings) into the hero,
       and uses it where an episode has no artwork of its own — in
       place of the generic fallback image podcast-public.js uses
     • shows a guest count, counted from the guests podcast-public.js
       rendered (the markup's placeholder figures stay hidden)
   Motion: motion.js reveals episodes and guests; animations.js the
   headings. The pulses and waveform are CSS.
   ================================================================ */

(function (win, doc) {
  'use strict';

  var K = win.EMBSKit;
  if (!K) return;
  var q = K.q, qa = K.qa;
  var FALLBACK = /bg-image-embs\/bluebg\.jpeg$/;
  var cover = '';

  function useCover(img) {
    if (!cover || !img || img._pdx) return;
    var src = img.getAttribute('src') || '';
    if (src && !FALLBACK.test(src)) return;
    img._pdx = true;
    img.src = cover;
  }

  function heroArt() {
    var box = q('.pod-hero-illus');
    if (!box || !cover || q('.pdx-cover-art', box)) return;
    var im = new Image();
    im.className = 'pdx-cover-art';
    im.alt = '';
    im.decoding = 'async';
    im.onload = function () { box.classList.add('has-art'); };
    im.src = cover;
    box.appendChild(im);
  }

  function applyCover() {
    heroArt();
    useCover(q('.pod-feat-thumb-img'));
    qa('.pod-ep-thumb').forEach(useCover);
  }

  function guestCount(grid) {
    var n = qa('.pod-guest-card', grid).length;
    var section = doc.getElementById('pod-guests');
    var item = qa('.pod-hero-meta-item')[1];
    if (!item) return;
    /* only after podcast-public.js has replaced the sample guests */
    if (!grid._pdxSeen) { grid._pdxSeen = true; return; }
    if (n && section && section.style.display !== 'none') {
      var num = q('.pod-hero-meta-num', item), label = q('.pod-hero-meta-label', item);
      if (num) num.textContent = String(n);
      if (label) label.textContent = n === 1 ? 'Guest' : 'Guests';
      item.classList.add('is-real');
    }
  }

  K.ready(function () {
    K.progress();
    K.magnetic(doc);

    var epGrid = q('#pod-latest .pod-ep-grid');
    var guests = q('.pod-guests-grid');
    K.onRender(epGrid, function (g) { qa('.pod-ep-thumb', g).forEach(useCover); });
    K.onRender(guests, guestCount);
    if (win.EMBSMotion) {
      win.EMBSMotion.watch(epGrid, '.pod-ep-card', { variant: 'fade' });
      win.EMBSMotion.watch(guests, '.pod-guest-card', { variant: 'fade' });
    }
    var topicGrid = doc.getElementById('pod-topic-ep-grid');
    K.onRender(topicGrid, function (g) { qa('.pod-ep-thumb', g).forEach(useCover); });

    /* the featured thumbnail is set by podcast-public.js after its fetch */
    var feat = q('.pod-feat-thumb-img');
    if (feat) new MutationObserver(function () { feat._pdx = false; useCover(feat); })
      .observe(feat, { attributes: true, attributeFilter: ['src'] });

    K.settings().then(function (s) {
      cover = K.img(s.podcastCoverUrl, 900);
      applyCover();
    });
  });

}(window, document));
