/* ================================================================
   gallery-experience.js — IEEE EMBS KPRIET (gallery.html only)

   Presentation layer for the Gallery. gallery-public.js still owns
   the photographs, albums, filters, videos, its own scroll reveal and
   the lightbox; this script only reads what it rendered and:
     • tells the CSS how many photographs there are (data-count), so
       the grid is composed for the real collection size
     • lights the hero with the first photograph and the closing panel
       with the last (decoration, alt="" — the grid carries them)
   No animation lives here: the reveal classes stay gallery-public.js's.
   ================================================================ */

(function (win, doc) {
  'use strict';

  var K = win.EMBSKit;
  if (!K) return;
  var q = K.q, qa = K.qa;

  function photoSrc(item) {
    var im = q('img', item);
    return im ? K.safeUrl(im.getAttribute('src')) : '';
  }

  function light(src) {
    var box = q('.glx-backdrop');
    if (!box || !src) return;
    var im = q('img', box);
    var url = K.img(src, 1800) || src;
    if (im.getAttribute('src') === url) return;
    im.onload = function () { box.classList.add('has-img'); };
    im.src = url;
  }

  function finalFrame(src) {
    var cta = doc.getElementById('gal-cta');
    if (!cta || !src) return;
    var url = (K.img(src, 1800) || src).replace(/["\\\n\r]/g, '');
    cta.style.setProperty('--glx-final', 'url("' + url + '")');
  }

  function onGrid(grid) {
    var items = qa('.gal-photo-item', grid);
    if (!items.length) { grid.removeAttribute('data-count'); return; }
    grid.setAttribute('data-count', String(Math.min(items.length, 7) === items.length ? items.length : 'many'));
    var first = photoSrc(items[0]);
    var last = photoSrc(items[items.length - 1]);
    light(first);
    finalFrame(last || first);
  }

  K.ready(function () {
    K.progress();
    K.magnetic(doc);
    K.onRender(doc.getElementById('galPhotoGrid'), onGrid);
  });

}(window, document));
