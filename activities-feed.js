/* ================================================================
   activities-feed.js — IEEE EMBS KPRIET (activities.html only)

   Read-only presentation of existing public CMS content. Uses the
   same public GET endpoints the rest of the site already uses; it
   never writes, never asks for drafts and adds no API surface.

     GET /events                 featured event, chronology, hero "next"
     GET /projects               research section
     GET /blogs                  knowledge section
     GET /podcasts               episode list
     GET /gallery?type=gallery   moments
     GET /site-settings/public   podcast cover

   Every container keeps a stable footprint while loading and ends in
   one of data-state="ready" | "empty" | "error"; each finished section
   announces itself with an `act:feed` event so the motion engine can
   animate what arrived. All CMS text is escaped; only http(s) URLs
   are used for links and images.
   ================================================================ */

(function (win, doc) {
  'use strict';

  var API = win.EMBS_API_BASE;

  /* ── helpers ─────────────────────────────────────────────────── */

  function $(id) { return doc.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function safeUrl(u) {
    u = String(u || '').trim();
    return /^https?:\/\//i.test(u) ? u : '';
  }

  /* Cloudinary delivery: ask for a right-sized, auto-format copy.
     Only applied to untransformed upload URLs (…/upload/v123/…). */
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

  /* "2026-08-13" is a calendar date: read it as local, never shift by timezone */
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
      year: String(d.getFullYear()),
      iso: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
      full: d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear()
    };
  }

  function daysUntil(d) {
    if (!d) return null;
    var t = new Date();
    var today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    return Math.round((d - today) / 86400000);
  }

  function list(path) {
    return fetch(API + path).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      if (Array.isArray(j)) return j;
      return j && Array.isArray(j.data) ? j.data : [];
    });
  }

  function settings() {
    return fetch(API + '/site-settings/public').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) { return (j && j.data) || {}; });
  }

  function announce(key) {
    var ev;
    try { ev = new CustomEvent('act:feed', { detail: { key: key } }); }
    catch (e) { ev = doc.createEvent('CustomEvent'); ev.initCustomEvent('act:feed', false, false, { key: key }); }
    doc.dispatchEvent(ev);
  }

  function settle(el, state, html, key) {
    if (!el) return;
    el.innerHTML = html;
    el.setAttribute('data-state', state);
    el.removeAttribute('aria-busy');
    announce(key);
  }

  function note(text, href, label, ink) {
    return '<div class="act-note' + (ink ? ' act-note--ink' : '') + '">' +
      '<span class="act-note-mark" aria-hidden="true"></span>' +
      '<p>' + esc(text) + '</p>' +
      (href ? '<a class="act-link' + (ink ? ' act-link--ink' : '') + '" href="' + esc(href) + '">' + esc(label) + ' <span aria-hidden="true">&rarr;</span></a>' : '') +
      '</div>';
  }

  function count(key, n) {
    var el = doc.querySelector('[data-act-count="' + key + '"]');
    if (!el || !(n > 0)) return;
    var words = { events: ['event', 'events'], projects: ['project', 'projects'], blogs: ['article', 'articles'],
                  podcasts: ['episode', 'episodes'], gallery: ['photograph', 'photographs'] }[key];
    el.textContent = n + ' ' + (n === 1 ? words[0] : words[1]);
  }

  var ARROW = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><polyline points="13,6 19,12 13,18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ── events ──────────────────────────────────────────────────── */

  function eventUrl(ev) { return 'event.html?id=' + encodeURIComponent(ev._id || ''); }

  function isUpcoming(ev) {
    var s = String(ev.status || '').toLowerCase();
    return s === 'upcoming' || s === 'ongoing';
  }

  function pickFeatured(evs) {
    var upcoming = evs.filter(isUpcoming).sort(function (a, b) { return (a._d || 0) - (b._d || 0); });
    var byLatest = evs.slice().sort(function (a, b) { return (b._d || 0) - (a._d || 0); });
    return upcoming.filter(function (e) { return e.featured; })[0] || upcoming[0] ||
           byLatest.filter(function (e) { return e.featured; })[0] || byLatest[0];
  }

  function kickerFor(ev) {
    var s = String(ev.status || '').toLowerCase();
    if (s === 'ongoing') return 'Happening now';
    if (s === 'upcoming') return 'Next up';
    return ev.featured ? 'Featured' : 'Most recent';
  }

  function whenLabel(ev) {
    if (!isUpcoming(ev)) return '';
    var n = daysUntil(ev._d);
    if (n === null || n < 0) return '';
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    return 'In ' + n + ' days';
  }

  function typeLabel(ev) {
    var t = plain(ev.type);
    return t && t.toLowerCase() !== 'other' ? t : '';
  }

  function renderFeature(ev) {
    var dp = dateParts(ev._d);
    var reg = safeUrl(ev.registrationLink);
    var thumb = img(ev.thumbnail, 900);
    var meta = [];
    if (typeLabel(ev)) meta.push(['Format', typeLabel(ev)]);
    if (ev.mode) meta.push(['Mode', cap(ev.mode)]);
    if (ev.venue) meta.push(['Venue', plain(ev.venue)]);
    if (ev.time) meta.push(['Time', plain(ev.time)]);
    if (ev.speaker) meta.push(['Speaker', plain(ev.speaker)]);
    var when = whenLabel(ev);

    return '<article class="act-feature-card' + (isUpcoming(ev) ? ' is-upcoming' : '') + '">' +
      '<a class="act-feature-media" href="' + eventUrl(ev) + '" tabindex="-1" aria-hidden="true">' +
        (thumb ? '<img src="' + esc(thumb) + '" alt="" loading="lazy" decoding="async" />'
               : '<span class="act-feature-media-fallback"></span>') +
        '<span class="act-feature-media-edge"></span>' +
      '</a>' +
      '<div class="act-feature-body">' +
        '<div class="act-feature-top">' +
          '<span class="act-feature-kicker">' + (isUpcoming(ev) ? '<span class="act-live" aria-hidden="true"></span>' : '') + esc(kickerFor(ev)) + '</span>' +
          (when ? '<span class="act-feature-when">' + esc(when) + '</span>' : '') +
        '</div>' +
        (dp ? '<time class="act-feature-date" datetime="' + dp.iso + '"><span class="act-feature-day">' + dp.day + '</span>' +
              '<span class="act-feature-my">' + dp.mon + '<br>' + dp.year + '</span></time>' : '') +
        '<h3 class="act-feature-title"><a href="' + eventUrl(ev) + '">' + esc(plain(ev.title)) + '</a></h3>' +
        (ev.description ? '<p class="act-feature-desc">' + esc(excerpt(ev.description, 260)) + '</p>' : '') +
        (meta.length ? '<dl class="act-spec">' + meta.map(function (m) {
          return '<div><dt>' + esc(m[0]) + '</dt><dd>' + esc(m[1]) + '</dd></div>';
        }).join('') + '</dl>' : '') +
        '<div class="act-feature-actions">' +
          (reg ? '<a class="act-btn act-btn--primary mo-sheen xp-magnetic" href="' + esc(reg) + '" target="_blank" rel="noopener noreferrer">Register ' + ARROW + '</a>' : '') +
          '<a class="act-btn' + (reg ? '' : ' act-btn--primary mo-sheen xp-magnetic') + '" href="' + eventUrl(ev) + '">View details ' + ARROW + '</a>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function renderFlowItem(ev, i) {
    var dp = dateParts(ev._d);
    var thumb = img(ev.thumbnail, 520);
    var bits = [typeLabel(ev), cap(ev.mode)].filter(Boolean).join(' · ');
    var up = isUpcoming(ev);
    return '<li class="act-flow-item' + (up ? ' is-upcoming' : '') + '">' +
      '<a class="act-flow-card mo-hover-glow" href="' + eventUrl(ev) + '">' +
        '<span class="act-flow-node" aria-hidden="true"></span>' +
        '<span class="act-flow-idx" aria-hidden="true">' + String(i + 1).padStart(2, '0') + '</span>' +
        (dp ? '<time class="act-flow-date" datetime="' + dp.iso + '"><b>' + dp.day + '</b> ' + dp.mon + ' ' + dp.year + '</time>' : '') +
        '<span class="act-flow-media">' + (thumb ? '<img src="' + esc(thumb) + '" alt="" loading="lazy" decoding="async" />' : '') + '</span>' +
        (bits || up ? '<span class="act-flow-type">' + (up ? '<span class="act-flow-flag">' + esc(kickerFor(ev)) + '</span>' : '') + esc(bits) + '</span>' : '') +
        '<span class="act-flow-name">' + esc(plain(ev.title)) + '</span>' +
      '</a>' +
    '</li>';
  }

  function renderHeroNext(ev) {
    var a = $('actHeroNext');
    if (!a || !ev) return;
    var dp = dateParts(ev._d);
    a.href = eventUrl(ev);
    a.querySelector('.act-next-k').textContent = isUpcoming(ev) ? 'Next up' : 'Latest';
    a.querySelector('.act-next-t').textContent = plain(ev.title);
    a.querySelector('.act-next-d').textContent = dp ? dp.full : '';
    if (!isUpcoming(ev)) a.classList.add('is-past');
    a.hidden = false;
    announce('next');
  }

  function loadEvents() {
    var feat = $('actEventFeature');
    var flow = $('actFlowList');
    return list('/events').then(function (evs) {
      evs = evs.filter(function (e) { return e && e.title; });
      evs.forEach(function (e) { e._d = parseDate(e.date); });
      count('events', evs.length);
      if (!evs.length) {
        settle(feat, 'empty', note('No events have been published yet. New events will appear here as they are announced.', 'events.html', 'Events page'), 'feature');
        settle(flow, 'empty', '', 'flow');
        return;
      }
      var f = pickFeatured(evs);
      renderHeroNext(f);
      settle(feat, 'ready', renderFeature(f), 'feature');
      var chron = evs.slice().sort(function (a, b) { return (a._d || 0) - (b._d || 0); });
      settle(flow, 'ready', chron.map(renderFlowItem).join(''), 'flow');
    }).catch(function (err) {
      console.warn('activities-feed: events unavailable —', err.message);
      settle(feat, 'error', note('Events could not be loaded right now.', 'events.html', 'Open the events page'), 'feature');
      settle(flow, 'error', '', 'flow');
    });
  }

  /* ── projects ────────────────────────────────────────────────── */

  function projectUrl(p) { return 'project.html?id=' + encodeURIComponent(p._id || ''); }

  function code(i) { return 'P—' + String(i + 1).padStart(2, '0'); }

  function renderProjects(ps) {
    var lead = ps.filter(function (p) { return p.featured; })[0] || ps[0];
    var rest = ps.filter(function (p) { return p !== lead; }).slice(0, 4);
    var thumb = img(lead.thumbnail, 900);
    var spec = [];
    if (lead.category) spec.push(['Field', plain(lead.category)]);
    if (lead.status) spec.push(['Status', cap(lead.status)]);
    if (lead.mentor) spec.push(['Mentor', plain(lead.mentor)]);
    var team = Array.isArray(lead.teamMembers) ? lead.teamMembers.filter(Boolean).length : 0;
    if (team) spec.push(['Team', team + (team === 1 ? ' member' : ' members')]);
    var links = [];
    [['repoUrl', 'Repository'], ['paperUrl', 'Paper'], ['liveUrl', 'Live']].forEach(function (k) {
      var u = safeUrl(lead[k[0]]);
      if (u) links.push('<a class="act-btn" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + k[1] + ' ' + ARROW + '</a>');
    });

    var html = '<article class="act-rx-lead">' +
      '<div class="act-rx-plate">' +
        (thumb ? '<img src="' + esc(thumb) + '" alt="" loading="lazy" decoding="async" />' :
          '<span class="act-rx-plate-code" aria-hidden="true">' + code(ps.indexOf(lead)) + '</span>') +
        '<span class="act-rx-plate-scan" aria-hidden="true"></span>' +
        '<span class="act-rx-plate-corner act-rx-plate-corner--tl" aria-hidden="true"></span>' +
        '<span class="act-rx-plate-corner act-rx-plate-corner--br" aria-hidden="true"></span>' +
      '</div>' +
      '<div class="act-rx-body">' +
        '<div class="act-rx-top"><span class="act-rx-code">' + code(ps.indexOf(lead)) + '</span>' +
          (lead.featured ? '<span class="act-rx-flag">Featured</span>' : '') + '</div>' +
        '<h3 class="act-rx-title"><a href="' + projectUrl(lead) + '">' + esc(plain(lead.title)) + '</a></h3>' +
        (lead.description ? '<p class="act-rx-desc">' + esc(excerpt(lead.description, 280)) + '</p>' : '') +
        (spec.length ? '<dl class="act-spec act-spec--rx">' + spec.map(function (m) {
          return '<div><dt>' + esc(m[0]) + '</dt><dd>' + esc(m[1]) + '</dd></div>';
        }).join('') + '</dl>' : '') +
        '<div class="act-feature-actions">' +
          '<a class="act-btn act-btn--primary mo-sheen xp-magnetic" href="' + projectUrl(lead) + '">View project ' + ARROW + '</a>' +
          links.join('') +
        '</div>' +
      '</div>' +
    '</article>';

    if (rest.length) {
      html += '<ol class="act-rx-list">' + rest.map(function (p) {
        return '<li><a class="act-rx-row" href="' + projectUrl(p) + '">' +
          '<span class="act-rx-code">' + code(ps.indexOf(p)) + '</span>' +
          '<span class="act-rx-row-title">' + esc(plain(p.title)) + '</span>' +
          '<span class="act-rx-row-meta">' + esc([plain(p.category), cap(p.status)].filter(Boolean).join(' · ')) + '</span>' +
          '<span class="act-rx-row-go" aria-hidden="true">' + ARROW + '</span>' +
        '</a></li>';
      }).join('') + '</ol>';
    }
    return html;
  }

  function loadProjects() {
    var el = $('actResearch');
    return list('/projects').then(function (ps) {
      ps = ps.filter(function (p) { return p && p.title; });
      count('projects', ps.length);
      if (!ps.length) {
        settle(el, 'empty', note('No projects are listed yet. Student projects will appear here once they are published.', null, null), 'research');
        return;
      }
      settle(el, 'ready', renderProjects(ps), 'research');
    }).catch(function (err) {
      console.warn('activities-feed: projects unavailable —', err.message);
      settle(el, 'error', note('Projects could not be loaded right now.', 'projects.html', 'Open the projects page'), 'research');
    });
  }

  /* ── articles ────────────────────────────────────────────────── */

  function readingMinutes(content) {
    var words = String(content || '').trim().split(/\s+/).filter(Boolean).length;
    return words ? Math.max(1, Math.round(words / 200)) : 0;
  }

  function categoryOf(post) {
    if (post.category) return post.category;
    return Array.isArray(post.tags) && post.tags.length ? post.tags[0] : '';
  }

  function renderArticles(posts) {
    return '<ol class="act-kn-list">' + posts.slice(0, 4).map(function (p, i) {
      var href = 'post.html?id=' + encodeURIComponent(p._id || '');
      var dp = dateParts(parseDate(p.publishedAt || p.createdAt));
      var mins = readingMinutes(p.content);
      var meta = [plain(categoryOf(p)), dp ? dp.full : '', mins ? mins + ' min read' : ''].filter(Boolean).join(' · ');
      var thumb = i === 0 ? img(p.thumbnail || p.coverImage, 900) : '';
      var text = p.excerpt || p.content;
      return '<li class="act-kn-item' + (i === 0 ? ' act-kn-item--lead' : '') + '">' +
        '<a class="act-kn-link" href="' + href + '">' +
          (thumb ? '<span class="act-kn-media"><img src="' + esc(thumb) + '" alt="" loading="lazy" decoding="async" /></span>' : '') +
          '<span class="act-kn-no" aria-hidden="true">' + String(i + 1).padStart(2, '0') + '</span>' +
          (meta ? '<span class="act-kn-meta">' + esc(meta) + '</span>' : '') +
          '<span class="act-kn-title">' + esc(plain(p.title)) + '</span>' +
          (text ? '<span class="act-kn-desc">' + esc(excerpt(text, i === 0 ? 220 : 140)) + '</span>' : '') +
        '</a>' +
      '</li>';
    }).join('') + '</ol>';
  }

  /* With nothing published, the section is an index of what the blog
     covers (the existing description), not an empty box. */
  function renderArticlesEmpty() {
    var kinds = ['Research summaries', 'Biomedical trends', 'Tutorials', 'Event reports', 'Technical articles'];
    return '<div class="act-kn-empty">' +
      '<p class="act-kn-empty-k">What the blog covers</p>' +
      '<ol class="act-kn-kinds">' + kinds.map(function (k, i) {
        return '<li><span aria-hidden="true">' + String(i + 1).padStart(2, '0') + '</span>' + k + '</li>';
      }).join('') + '</ol>' +
      note('No articles have been published yet. New writing will appear here as it is released.', null, null, true) +
    '</div>';
  }

  function loadArticles() {
    var el = $('actKnowledge');
    return list('/blogs').then(function (posts) {
      posts = posts.filter(function (p) { return p && p.title; })
        .sort(function (a, b) { return (parseDate(b.publishedAt || b.createdAt) || 0) - (parseDate(a.publishedAt || a.createdAt) || 0); });
      count('blogs', posts.length);
      settle(el, posts.length ? 'ready' : 'empty', posts.length ? renderArticles(posts) : renderArticlesEmpty(), 'knowledge');
    }).catch(function (err) {
      console.warn('activities-feed: articles unavailable —', err.message);
      settle(el, 'error', renderArticlesEmpty(), 'knowledge');
    });
  }

  /* ── podcast ─────────────────────────────────────────────────── */

  function renderEpisodes(eps) {
    return '<ol class="act-pod-list">' + eps.slice(0, 4).map(function (ep) {
      var listen = safeUrl(ep.spotifyUrl) || safeUrl(ep.youtubeUrl);
      var no = ep.episodeNumber != null && ep.episodeNumber !== '' ? String(ep.episodeNumber).padStart(2, '0') : '—';
      var guest = [plain(ep.guestName), plain(ep.guestDesignation)].filter(Boolean).join(' · ');
      var label = 'Listen to ' + plain(ep.title) + (listen ? (safeUrl(ep.spotifyUrl) ? ' on Spotify' : ' on YouTube') : '');
      return '<li class="act-pod-ep">' +
        '<a class="act-pod-link" href="' + esc(listen || 'podcast.html') + '"' +
          (listen ? ' target="_blank" rel="noopener noreferrer"' : '') + ' aria-label="' + esc(label) + '">' +
          '<span class="act-pod-no"><small>EP</small>' + esc(no) + '</span>' +
          '<span class="act-pod-main">' +
            '<span class="act-pod-title">' + esc(plain(ep.title)) + '</span>' +
            (guest ? '<span class="act-pod-guest">' + esc(guest) + '</span>' : '') +
          '</span>' +
          (ep.duration ? '<span class="act-pod-dur">' + esc(plain(ep.duration)) + '</span>' : '') +
          '<span class="act-pod-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14"><polygon points="8,5 19,12 8,19" fill="currentColor"/></svg></span>' +
        '</a>' +
      '</li>';
    }).join('') + '</ol>';
  }

  function setCover(url) {
    var box = $('actPodCover');
    url = img(url, 700);
    if (!box || !url || box.querySelector('img')) return;
    var im = new Image();
    im.alt = '';
    im.decoding = 'async';
    im.onload = function () { box.classList.add('has-art'); announce('cover'); };
    im.src = url;
    box.appendChild(im);
  }

  function loadPodcast() {
    var el = $('actPodcast');
    var cover = settings().then(function (s) { return s.podcastCoverUrl || ''; }).catch(function () { return ''; });
    return list('/podcasts').then(function (eps) {
      eps = eps.filter(function (e) { return e && e.title && e.published !== false; })
        .sort(function (a, b) { return (+b.episodeNumber || 0) - (+a.episodeNumber || 0); });
      count('podcasts', eps.length);
      cover.then(function (u) {
        var withArt = eps.filter(function (e) { return safeUrl(e.thumbnail); })[0];
        setCover(u || (withArt && withArt.thumbnail));
      });
      if (!eps.length) {
        settle(el, 'empty', note('No episodes have been published yet. New episodes will appear here as they are released.', null, null), 'podcast');
        return;
      }
      settle(el, 'ready', renderEpisodes(eps), 'podcast');
    }).catch(function (err) {
      console.warn('activities-feed: podcasts unavailable —', err.message);
      cover.then(setCover);
      settle(el, 'error', note('Episodes could not be loaded right now.', 'podcast.html', 'Open the podcast page'), 'podcast');
    });
  }

  /* ── gallery ─────────────────────────────────────────────────── */

  function renderMoments(items) {
    var shown = items.slice(0, 7);
    return '<div class="act-mo-grid" data-count="' + shown.length + '">' + shown.map(function (g, i) {
      var src = img(g.imageUrl, i === 0 ? 1600 : 900);
      var title = plain(g.title);
      var caption = plain(g.caption);
      return '<figure class="act-moment">' +
        '<a class="act-moment-media" href="gallery.html" aria-label="' + esc('Open the gallery' + (title ? ': ' + title : '')) + '">' +
          '<img src="' + esc(src) + '" alt="' + esc(title || caption || 'IEEE EMBS chapter photograph') + '" loading="lazy" decoding="async" />' +
        '</a>' +
        (title || caption ? '<figcaption><span class="act-moment-no" aria-hidden="true">' + String(i + 1).padStart(2, '0') + '</span>' +
          (title ? '<span class="act-moment-title">' + esc(title) + '</span>' : '') +
          (caption && caption !== title ? '<span class="act-moment-cap">' + esc(caption) + '</span>' : '') +
        '</figcaption>' : '') +
      '</figure>';
    }).join('') + '</div>';
  }

  function loadGallery() {
    var el = $('actMoments');
    return list('/gallery?type=gallery').then(function (items) {
      items = items.filter(function (g) { return g && safeUrl(g.imageUrl) && g.published !== false; })
        .sort(function (a, b) { return (+a.order || 0) - (+b.order || 0); });
      count('gallery', items.length);
      if (!items.length) {
        settle(el, 'empty', note('No photographs have been published yet.', null, null, true), 'moments');
        return;
      }
      settle(el, 'ready', renderMoments(items), 'moments');
    }).catch(function (err) {
      console.warn('activities-feed: gallery unavailable —', err.message);
      settle(el, 'error', note('Photographs could not be loaded right now.', 'gallery.html', 'Open the gallery', true), 'moments');
    });
  }

  /* ── boot ────────────────────────────────────────────────────── */

  function init() {
    if (!API) {
      ['actEventFeature', 'actFlowList', 'actResearch', 'actKnowledge', 'actPodcast', 'actMoments'].forEach(function (id) {
        var el = $(id);
        if (el) { el.setAttribute('data-state', 'error'); el.removeAttribute('aria-busy'); }
      });
      return;
    }
    loadEvents();
    loadProjects();
    loadArticles();
    loadPodcast();
    loadGallery();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();

}(window, document));
