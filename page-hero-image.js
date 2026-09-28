(function () {
  'use strict';

  /* Applies page hero images from SiteSettings to the right-side hero
     image element on each public page.

     If a custom image URL is stored in SiteSettings:
       → show the uploaded image (hide placeholder)
     If the URL is empty or fetch fails:
       → leave the existing placeholder/default visible (no broken image)

     Each entry maps:
       selector  — CSS selector for the <img> element (or placeholder parent)
       urlKey    — SiteSettings field name
       type      — 'img' (has an <img>) | 'placeholder' (replace div with img)
       placeholderSel — selector for the placeholder div to hide
  */

  var API_BASE = window.EMBS_API_BASE;

  var PAGE_MAP = [
    /* activities.html */
    { imgSel: '.act-hero-img',   urlKey: 'activitiesHeroImageUrl', placeholderSel: null },
    /* blog.html */
    { imgSel: '.blog-hero-img',  urlKey: 'blogHeroImageUrl',       placeholderSel: null },
    /* members.html */
    { imgSel: '.mhero-img',      urlKey: 'membersHeroImageUrl',    placeholderSel: '.mhero-img-placeholder' },
    /* about.html */
    { imgSel: null,              urlKey: 'aboutHeroImageUrl',      placeholderSel: '.about-img-placeholder',
      createImg: { parentSel: '.about-embs-right', className: 'about-hero-img' } },
    /* projects.html */
    { imgSel: '.proj-hero-img',  urlKey: 'projectsHeroImageUrl',   placeholderSel: null },
  ];

  async function init() {
    if (!API_BASE) return;

    /* Only proceed if any of the mapped elements exist on this page */
    var active = PAGE_MAP.filter(function (m) {
      return (m.imgSel && document.querySelector(m.imgSel)) ||
             (m.placeholderSel && document.querySelector(m.placeholderSel)) ||
             (m.createImg && document.querySelector(m.createImg.parentSel));
    });
    if (!active.length) return;

    try {
      var res  = await fetch(API_BASE + '/site-settings/public');
      var json = await res.json();
      var data = (json && json.data) ? json.data : {};

      active.forEach(function (m) {
        var url = data[m.urlKey];
        if (!url) return; /* no custom image — leave existing placeholder */

        if (m.imgSel) {
          /* Page already has an <img> element — just set src */
          var img = document.querySelector(m.imgSel);
          if (!img) return;
          img.src               = url;
          img.style.objectFit   = 'cover';
          img.style.width       = '100%';
          img.style.height      = '100%';
          img.style.borderRadius = 'inherit';
          if (m.placeholderSel) {
            var ph = document.querySelector(m.placeholderSel);
            if (ph) ph.style.display = 'none';
          }
          img.style.display = 'block';

        } else if (m.createImg) {
          /* about.html: no <img> exists — create one inside the right panel */
          var parent = document.querySelector(m.createImg.parentSel);
          if (!parent) return;
          var placeholder = m.placeholderSel ? document.querySelector(m.placeholderSel) : null;

          var newImg = document.createElement('img');
          newImg.src          = url;
          newImg.alt          = 'Chapter / Lab Image';
          newImg.className    = m.createImg.className;
          newImg.style.cssText =
            'width:100%;height:100%;object-fit:cover;border-radius:20px;' +
            'display:block;position:absolute;inset:0;';

          if (placeholder) {
            placeholder.style.position = 'relative';
            placeholder.appendChild(newImg);
            /* Hide the "Chapter / Lab Image" text */
            var textSpan = placeholder.querySelector('span');
            if (textSpan) textSpan.style.display = 'none';
          } else {
            parent.insertBefore(newImg, parent.firstChild);
          }
        }
      });

    } catch (err) {
      console.warn('page-hero-image: could not load settings —', err.message);
      /* Silence — existing placeholders/defaults remain */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
