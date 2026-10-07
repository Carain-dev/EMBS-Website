// Browser suite — real pages from the static server (localhost:8765), every API
// call redirected to the verified isolated backend by lib/cdp.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { Browser, SITE } from './lib/cdp.mjs';
import { seedRealistic, seedXss } from './lib/dataset.mjs';
import { setSuite, check, record } from './lib/report.mjs';
import { http } from './lib/guard.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const ON = k => !process.env.SECTIONS || process.env.SECTIONS.split(',').includes(k);
const WIDTHS = [[360, 740], [390, 844], [768, 1024], [1024, 768], [1440, 900], [1680, 1000]];

/* In-page inspection used after every load. */
const INSPECT = `(()=>{
  const vis = e => { if (!e || e.closest('[hidden],[aria-hidden="true"],template,noscript')) return false; const s = getComputedStyle(e); if (s.display==='none'||s.visibility==='hidden') return false; const r = e.getBoundingClientRect(); return r.width>0 && r.height>0; };
  const main = document.querySelector('main') || document.body;
  const text = document.body.innerText || '';
  const artifacts = (text.match(/(^|[\\s>(:])(undefined|null|NaN|\\[object Object\\]|Invalid Date)(?=$|[\\s<).,:])/gm) || []).map(s=>s.trim()).slice(0,8);
  const rawErr = (text.match(/Unexpected token|is not valid JSON|SyntaxError|TypeError|Cannot read propert|Failed to fetch|Request failed \\(\\d+\\)|Cast to ObjectId|ECONNREFUSED/g) || []).slice(0,5);
  const stuck = [...document.querySelectorAll('body *')].filter(e => vis(e) && e.children.length===0 && /^\\s*(Loading|Fetching)\\b.{0,30}$/i.test(e.textContent)).map(e=>e.className||e.tagName).slice(0,6);
  const skeletons = [...document.querySelectorAll('[class*="skeleton"],[aria-busy="true"]')].filter(vis).map(e=>String(e.className).slice(0,40)).slice(0,6);
  const brokenImgs = [...document.images].filter(i => vis(i) && i.complete && i.naturalWidth===0 && i.getAttribute('src') && !/^x$|\\/x$/.test(i.getAttribute('src'))).map(i=>i.getAttribute('src').slice(0,80)).slice(0,6);
  const hiddenContent = [...main.querySelectorAll('h1,h2,h3,p,li,article,.card,[class*="-card"]')].filter(e => { if (e.closest('[hidden],[aria-hidden="true"],details:not([open]),dialog:not([open]),.pod-player,[role="tabpanel"][hidden]')) return false; const s=getComputedStyle(e); const r=e.getBoundingClientRect(); return (e.innerText||'').trim().length>2 && r.width>0 && r.height>0 && s.display!=='none' && (+s.opacity<0.05 || s.visibility==='hidden'); }).map(e=>(e.className||e.tagName)+':'+(e.innerText||'').trim().slice(0,30)).slice(0,6);
  const jsLinks = [...document.querySelectorAll('a[href],iframe[src],img[src],source[src],embed[src],object[data],form[action]')].filter(e=>!/^javascript:void\\(0\\);?$/i.test((e.getAttribute('href')||'').trim())).filter(e=>/^\\s*javascript:/i.test(e.getAttribute('href')||e.getAttribute('src')||e.getAttribute('data')||e.getAttribute('action')||'')).map(e=>e.tagName+':'+(e.getAttribute('href')||e.getAttribute('src')).slice(0,60));
  const handlers = [...document.querySelectorAll('*')].filter(e=>[...e.attributes].some(a=>/^on/i.test(a.name)&&/__x\\(/.test(a.value))).map(e=>e.tagName+'['+[...e.attributes].filter(a=>/^on/i.test(a.name)).map(a=>a.name).join(',')+']').slice(0,10);
  return { artifacts, rawErr, stuck, skeletons, brokenImgs, hiddenContent, jsLinks, handlers, xss: window.__xss.slice(), hOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), html: document.documentElement.innerHTML.length, cls: +(window.__cls||0).toFixed(4) };
})()`;

const htmlHas = s => `document.documentElement.innerHTML.includes(${JSON.stringify(s)})`;
const VISIBLE = sel => `[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e=>{if(e.hidden||e.closest('[hidden]'))return false;const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden')return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0})`;

function pageList(seed) {
  const E = seed.events, B = seed.blogs, P = seed.projects, Mm = seed.members;
  return [
    { url: 'index.html', expect: ['Audit Workshop on Biosignals', 'Audit Episode One', 'Audit Student Award', 'Audit Faculty Advisor'] },
    { url: 'about.html', expect: ['Audit Chapter Founded', 'Audit Faculty Advisor', 'Audit Chair Person', 'Audit vision.'] },
    { url: 'activities.html', expect: ['Audit Workshop on Biosignals'] },
    { url: 'events.html', expect: ['Audit Seminar on Imaging', 'Audit Guest Lecture Past', 'Audit Minimal Event'] },
    { url: 'projects.html', expect: ['Audit ECG Classifier', 'Audit Imaging Toolkit', 'Audit Minimal Project'] },
    { url: 'blog.html', expect: ['Audit Tutorial Post', 'Audit Event Report Post', 'Audit Minimal Post'] },
    { url: 'podcast.html', expect: ['Audit Episode One', 'Audit Episode Two', 'Audit Minimal Episode'] },
    { url: 'gallery.html', expect: ['Audit Photo One'] },
    { url: 'members.html', expect: ['Audit Chair Person', 'Audit Treasurer', 'Audit Faculty Advisor'] },
    { url: 'achievements.html', expect: ['Audit Student Award', 'Audit Publication', 'Audit Minimal Achievement'] },
    { url: 'announcements.html', expect: ['Audit Internship Call', 'Audit Competition Notice', 'Audit Minimal Notice'] },
    { url: 'contact.html', expect: ['chapter@example.test'] },
    { url: `event.html?id=${E[0]._id}`, expect: ['Audit Workshop on Biosignals'] },
    { url: `post.html?id=${B[0]._id}`, expect: ['Audit Tutorial Post', 'Paragraph two.'] },
    { url: `project.html?id=${P[0]._id}`, expect: ['Audit ECG Classifier', 'Audit Student A'] },
    { url: `student-profile.html?id=${Mm[0]._id}`, expect: ['Audit Chair Person'] },
    { url: '404.html', expect: [] },
  ];
}

export async function runBrowserSuite({ env, sink, out }) {
  fs.mkdirSync(path.join(out, 'shots'), { recursive: true });
  try { await fetch(SITE + '/index.html'); } catch { throw new Error('static site server on :8765 is not running'); }
  const seed = await seedRealistic(env);
  await env.restart();                                  // fresh rate-limit window
  const b = await new Browser({ out, mode: 'audit' }).launch();
  let used = 0;
  const budget = async (need = 60) => { if (b.forwarded - used + need > 520) { await env.restart(); used = b.forwarded; } };
  const pages = pageList(seed);
  const dup = {};
  const pageIssues = (r, extra = {}) => ({ exceptions: b.exceptions.slice(0, 4), console: b.logs.slice(0, 4), failed: b.failed.filter(f => !/\/x(\?|$)/.test(f)).slice(0, 4), blocked: b.blocked.slice(0, 3), ...extra, ...r });

  try {
    /* ── A. data flow per page (1440 desktop) ── */
    if (ON('A')) {
    setSuite('browser:pages');
    await b.viewport(1440, 900);
    for (const pg of pages) {
      await budget();
      const settled = pg.expect.length ? pg.expect.map(htmlHas).join('&&') : null;
      const ms = await b.goto(pg.url, { wait: 14000, settled });
      await b.scrollThrough(); await sleep(600);
      const r = await b.eval(INSPECT);
      const missing = [];
      for (const s of pg.expect) if (!(await b.eval(htmlHas(s)))) missing.push(s);
      const drafts = await b.eval(`(document.documentElement.innerHTML.match(/AUDIT-DRAFT-[A-Z]+/g)||[]).join(',')`);
      const apiFailed = b.api.filter(a => a.status >= 400);
      const counts = {}; for (const a of b.api.filter(a => a.method === 'GET')) counts[a.path] = (counts[a.path] || 0) + 1;
      const dups = Object.entries(counts).filter(([, n]) => n > 1).map(([p, n]) => `${p}×${n}`);
      dup[pg.url.split('?')[0]] = dups;
      const foreignApi = [...b.hosts].filter(h => /onrender|:5000$/.test(h));
      const name = pg.url.split('?')[0];
      check(`${name}: CMS data rendered`, missing.length === 0, 'all seeded items present', missing.length ? 'missing: ' + missing.join(' | ') : 'ok', 'GET page');
      check(`${name}: no draft/hidden content`, !drafts, 'none', drafts || 'none');
      check(`${name}: no console errors / exceptions`, !b.exceptions.length && !b.logs.length, 'none', JSON.stringify([...b.exceptions, ...b.logs]).slice(0, 220));
      check(`${name}: no failed requests`, !b.failed.filter(f => !/\/x(\?|$)/.test(f)).length && !apiFailed.length, 'none', JSON.stringify(b.failed).slice(0, 220));
      check(`${name}: no "undefined"/"null"/raw errors in UI`, !r.artifacts.length && !r.rawErr.length, 'none', JSON.stringify([...r.artifacts, ...r.rawErr]));
      check(`${name}: no stuck loading state`, !r.stuck.length && !r.skeletons.length, 'none', JSON.stringify([...r.stuck, ...r.skeletons]));
      check(`${name}: images resolve`, !r.brokenImgs.length, 'none broken', JSON.stringify(r.brokenImgs));
      check(`${name}: no content left hidden`, !r.hiddenContent.length, 'none', JSON.stringify(r.hiddenContent));
      check(`${name}: API base is the configured local API (no production host)`, !foreignApi.length || foreignApi.every(h => h === 'localhost:5000'), 'localhost:5000 only (rewritten)', [...b.hosts].join(','));
      record(`${name}: request profile`, { expected: 'info', actual: `${b.api.length} API calls in ${ms}ms; duplicates: ${dups.join(', ') || 'none'}`, pass: true });
      await b.shot(`page-${name.replace('.html', '')}`);
    }

    }
    /* ── B. filters / search ── */
    if (ON('B')) {
    setSuite('browser:filters');
    const chipTest = async (url, chipSel, cardSel, { settle, expectFor = {} } = {}) => {
      await budget();
      await b.goto(url, { wait: 12000, settled: settle });
      const total = await b.eval(`${VISIBLE(cardSel)}.length`);
      check(`${url}: cards rendered before filtering`, total > 0, '>0', total);
      const chips = await b.eval(`[...document.querySelectorAll(${JSON.stringify(chipSel)})].map(c=>c.getAttribute('data-filter')||c.getAttribute('data-topic'))`);
      for (const f of chips || []) {
        if (!f || f === 'all') continue;
        await b.eval(`(()=>{const c=[...document.querySelectorAll(${JSON.stringify(chipSel)})].find(c=>(c.getAttribute('data-filter')||c.getAttribute('data-topic'))===${JSON.stringify(f)});c.scrollIntoView({block:'center'});c.click();return 1})()`);
        await sleep(700);
        const res = await b.eval(`(()=>{const v=${VISIBLE(cardSel)};const f=${JSON.stringify(f)}.toLowerCase();const words=f.replace(/-/g,' ');return {n:v.length,bad:v.filter(c=>!((c.getAttribute('data-category')||'').toLowerCase()===f||(c.textContent||'').toLowerCase().includes(words)||(c.getAttribute('data-filter')||'').toLowerCase()===f)).map(c=>(c.textContent||'').trim().slice(0,30))}})()`);
        const want = expectFor[f];
        const okCount = want === undefined ? res.n <= total : res.n === want;
        check(`${url}: chip "${f}" filters correctly`, okCount && (!res.bad.length || want === undefined && res.n === 0), want === undefined ? `≤${total}, all matching` : `${want} matching`, `${res.n}${res.bad.length ? ' non-matching: ' + res.bad.join('|') : ''}`);
      }
      const allSel = await b.eval(`(()=>{const c=document.querySelector(${JSON.stringify(chipSel.replace(/\[data-[a-z]+\]$/, '') + '[data-filter="all"]')});if(c){c.click();return 1}const clr=document.getElementById('pod-topic-clear');if(clr){clr.click();return 2}return 0})()`);
      await sleep(700);
      const back = await b.eval(`${VISIBLE(cardSel)}.length`);
      if (allSel) check(`${url}: clearing filter restores all`, back === total, total, back);
    };
    await chipTest('events.html', '.filter-chip[data-filter]', '#eventsGrid .ev-card', { settle: htmlHas('Audit Seminar on Imaging'), expectFor: { workshop: undefined, seminar: undefined, 'signal-processing': 0 } });
    await chipTest('projects.html', '.filter-chip[data-filter]', '.proj-card', { settle: htmlHas('Audit ECG Classifier'), expectFor: { 'ai-healthcare': 1, 'medical-imaging': 1, bioinformatics: 0 } });
    await chipTest('blog.html', '.filter-chip[data-filter]', '#articlesGrid [data-category]', { settle: htmlHas('Audit Tutorial Post'), expectFor: { tutorials: 1, 'event-reports': 1, wearables: 0 } });
    await chipTest('achievements.html', '.ach-chip[data-filter]', '.ach-cards-grid .ach-card', { settle: htmlHas('Audit Student Award'), expectFor: { 'student-awards': 1, publications: 1, 'competition-wins': 1, certifications: 0 } });
    await chipTest('announcements.html', '.ann-chip[data-filter]', '.ann-cards-grid .ann-card', { settle: htmlHas('Audit Internship Call'), expectFor: { internships: 1, competitions: 1, scholarships: 1 } });
    await chipTest('gallery.html', '#galFiltersInner [data-filter]', '#galPhotoGrid .gal-photo-item', { settle: htmlHas('Audit Photo One') });
    // podcast topics (results grid)
    await budget();
    await b.goto('podcast.html', { wait: 12000, settled: htmlHas('Audit Episode One') });
    await b.eval(`(()=>{const c=document.querySelector('.pod-topic-chip[data-topic="Artificial Intelligence"]');c.scrollIntoView({block:'center'});c.click();return 1})()`); await sleep(700);
    const t1 = await b.eval(`(()=>{const g=document.getElementById('pod-topic-ep-grid');return {box:getComputedStyle(document.getElementById('pod-topic-results')).display!=='none', text:g?g.innerText:''}})()`);
    check('podcast.html: topic "Artificial Intelligence" shows the tagged episode only', t1.box && /Audit Episode One/.test(t1.text) && !/Audit Episode Two/.test(t1.text), 'Episode One only', t1.text.slice(0, 80));
    await b.eval(`(()=>{const c=document.querySelector('.pod-topic-chip[data-topic="Bioinformatics"]');c.click();return 1})()`); await sleep(500);
    const t2 = await b.eval(`document.getElementById('pod-topic-ep-grid').innerText`);
    check('podcast.html: topic with no episodes shows empty state', /No published episodes/i.test(t2), 'empty message', t2.slice(0, 80));
    await b.eval(`document.getElementById('pod-topic-clear').click()`); await sleep(400);
    const hiddenAfter = await b.eval(`getComputedStyle(document.getElementById('pod-topic-results')).display==='none'`);
    check('podcast.html: clearing topic hides results', hiddenAfter, true, hiddenAfter);
    // events search
    await budget();
    await b.goto('events.html', { wait: 12000, settled: htmlHas('Audit Seminar on Imaging') });
    const n0 = await b.eval(`${VISIBLE('#eventsGrid .ev-card')}.length`);
    const search = async q => { await b.eval(`(()=>{const i=document.getElementById('eventsSearch');i.value=${JSON.stringify(q)};i.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`); await sleep(700); return b.eval(`${VISIBLE('#eventsGrid .ev-card')}.map(c=>c.innerText.toLowerCase())`); };
    const s1 = await search('hackathon');
    check('events.html: search "hackathon" returns matching events only', s1.length >= 1 && s1.every(t => t.includes('hackathon')), '≥1, all matching', `${s1.length}`);
    const s2 = await search('zzqx-no-such-event');
    const emptyShown = await b.eval(`[...document.querySelectorAll('#eventsGridSection *')].some(e=>e.children.length===0&&/no (events|results|matching)/i.test(e.textContent)&&e.getBoundingClientRect().height>0)`);
    check('events.html: search with no match shows 0 cards + empty state', s2.length === 0 && emptyShown, '0 + message', `${s2.length} ${emptyShown}`);
    const s3 = await search('');
    check('events.html: clearing search restores list', s3.length === n0, n0, s3.length);

    }
    /* ── C. detail pages ── */
    if (ON('C')) {
    setSuite('browser:detail');
    const D = [
      ['event.html', seed.events[1], seed.events.find(e => !e.published), 'Event not found'],
      ['post.html', seed.blogs[1], seed.blogs.find(e => !e.published), 'Article not found'],
      ['project.html', seed.projects[1], seed.projects.find(e => !e.featured), 'Project not found'],
      ['student-profile.html', seed.members[2], seed.members.find(e => !e.active), null],
    ];
    for (const [pageName, rec, draft, nf] of D) {
      await budget();
      const title = rec.title || rec.name;
      await b.goto(`${pageName}?id=${rec._id}`, { wait: 10000, settled: htmlHas(title) });
      const shown = await b.eval(`document.querySelector('h1') ? document.querySelector('h1').innerText : ''`);
      check(`${pageName}: valid id renders that exact record`, (await b.eval(htmlHas(title))) && shown.includes(title), title, shown.slice(0, 60));
      await b.send('Page.reload'); await sleep(4500);
      check(`${pageName}: reload keeps the same record`, (await b.eval(`document.querySelector('h1') ? document.querySelector('h1').innerText : ''`)).includes(title), title, (await b.eval(`document.querySelector('h1')?.innerText||''`)).slice(0, 60));
      for (const [label, q] of [['draft/hidden id', `?id=${draft._id}`], ['nonexistent id', '?id=64b000000000000000000000'], ['malformed id', '?id=not-an-id'], ['missing id', ''], ['injection-looking id', '?id=%3Cimg%20src%3Dx%20onerror%3D__x(1)%3E']]) {
        await b.goto(pageName + q, { wait: 6000 });
        await sleep(1500);
        const r = await b.eval(INSPECT);
        const leaked = await b.eval(`/AUDIT-DRAFT/.test(document.documentElement.innerHTML)`);
        const msg = await b.eval(`document.body.innerText.slice(0,4000)`);
        const friendly = nf ? msg.includes(nf) || /not found|could not load|no (event|article|project|member)/i.test(msg) : /not found|could not|no (member|profile|student)|unavailable|invalid/i.test(msg);
        check(`${pageName}: ${label} → friendly not-found, no leak`, !leaked && friendly && !b.exceptions.length && !r.xss.length && !r.artifacts.length, 'not-found message', `${leaked ? 'LEAKED ' : ''}${friendly ? 'message ok' : 'no message'} ${b.exceptions.join('|').slice(0, 80)} ${r.artifacts.join(',')}`);
      }
    }
    // list → click → detail
    await budget();
    await b.goto('events.html', { wait: 12000, settled: htmlHas('Audit Seminar on Imaging') });
    const href = await b.eval(`(()=>{const a=[...document.querySelectorAll('a[href*="event.html?id="]')].find(a=>a.closest('.ev-card')&&a.closest('.ev-card').innerText.includes('Audit Guest Lecture Past'));return a?a.getAttribute('href'):null})()`);
    check('events.html → card link carries the right id', !!href && href.includes(String(seed.events[3]._id)), String(seed.events[3]._id), href);
    if (href) {
      await b.eval(`location.href=${JSON.stringify(href)}`); await sleep(4500);
      check('click-through detail shows the clicked event', await b.eval(`(document.querySelector('h1')||{}).innerText==='Audit Guest Lecture Past'`), 'Audit Guest Lecture Past', await b.eval(`(document.querySelector('h1')||{}).innerText`));
    }

    }
    /* ── D. forms ── */
    if (ON('D')) {
    setSuite('browser:forms');
    await budget();
    await b.goto('contact.html', { wait: 10000, settled: htmlHas('chapter@example.test') });
    sink.messages.length = 0;
    const fill = (n, e, s, m) => b.eval(`(()=>{const f=document.querySelector('.contact-form');f.querySelector('#contactName').value=${JSON.stringify(n)};f.querySelector('#contactEmail').value=${JSON.stringify(e)};f.querySelector('#contactSubject').value=${JSON.stringify(s)};f.querySelector('#contactMessage').value=${JSON.stringify(m)};return 1})()`);
    const submit = () => b.eval(`(()=>{const f=document.querySelector('.contact-form');f.requestSubmit(f.querySelector('.contact-submit'));return 1})()`);
    const status = () => b.eval(`(document.querySelector('.contact-status')||{}).textContent||''`);
    await fill('', '', '', ''); await submit(); await sleep(400);
    check('contact: empty submit blocked with message (no request)', b.api.filter(a => a.path === '/contact').length === 0, 'no POST', b.api.filter(a => a.path === '/contact').length);
    await fill('Audit Visitor', 'not-an-email', 'Hi', 'Message'); await submit(); await sleep(600);
    check('contact: invalid email blocked by the form', b.api.filter(a => a.path === '/contact').length === 0, 'no POST (type=email validation)', b.api.filter(a => a.path === '/contact').length);
    b.simulate = (M, p) => p === '/contact' && M === 'POST' ? { name: 'slow', delay: 1500, passthrough: true } : null;
    await fill('Audit Visitor', 'visitor@example.test', 'Audit form subject', 'Audit message <b>hi</b>'); await submit();
    await sleep(500);
    const busy = await b.eval(`(()=>{const x=document.querySelector('.contact-submit');return x.disabled+' '+x.textContent.trim()})()`);
    await sleep(2500);
    b.simulate = null;
    check('contact: button shows sending state', /^true Sending/.test(busy), 'disabled + Sending…', busy);
    check('contact: success message shown and form reset', /sent successfully/i.test(await status()) && (await b.eval(`document.querySelector('#contactName').value`)) === '', 'success + reset', await status());
    check('contact: one email delivered to chapter inbox (fake SMTP)', sink.messages.length === 1 && /Audit form subject/.test(sink.messages[0].subject), 1, sink.messages.length);
    // API failure → error shown, button restored
    b.simulate = (M, p) => p === '/contact' && M === 'POST' ? { name: '500', status: 500, body: JSON.stringify({ success: false, message: 'Something went wrong. Please try again later.' }) } : null;
    await fill('Audit Visitor', 'visitor@example.test', 'S', 'M'); await submit(); await sleep(1200);
    check('contact: API 500 → error message, button re-enabled', /went wrong|try again/i.test(await status()) && await b.eval(`!document.querySelector('.contact-submit').disabled`), 'error + enabled', await status());
    b.simulate = (M, p) => p === '/contact' && M === 'POST' ? { name: 'network', network: true } : null;
    await fill('Audit Visitor', 'visitor@example.test', 'S', 'M'); await submit(); await sleep(1200);
    check('contact: network failure → friendly message', /could not reach/i.test(await status()), 'could not reach', await status());
    b.simulate = (M, p) => p === '/contact' && M === 'POST' ? { name: 'html', status: 502, type: 'text/html', body: '<html>Bad gateway</html>' } : null;
    await fill('Audit Visitor', 'visitor@example.test', 'S', 'M'); await submit(); await sleep(1200);
    check('contact: non-JSON error page → friendly message, no exception', !b.exceptions.length && (await status()).length > 0 && !/Unexpected token|JSON/i.test(await status()), 'friendly message', `${await status()} ${b.exceptions.join('|')}`);
    b.simulate = null;
    // double submit
    sink.messages.length = 0; b.api.length = 0;
    await fill('Audit Visitor', 'visitor@example.test', 'Double', 'M'); await b.eval(`(()=>{const x=document.querySelector('.contact-submit');x.click();x.click();return 1})()`); await sleep(2500);
    check('contact: rapid double submit sends once', b.api.filter(a => a.path === '/contact' && a.method === 'POST').length === 1, 1, b.api.filter(a => a.path === '/contact' && a.method === 'POST').length);

    // newsletter forms
    for (const [url, formSel, n] of [['index.html', '.footer-newsletter-form', 'footer'], ['podcast.html', '.pod-subscribe-form', 'podcast'], ['announcements.html', '.ann-newsletter-form', 'announcements']]) {
      await budget();
      await b.goto(url, { wait: 6000 });
      const sub = async email => { await b.eval(`(()=>{const f=document.querySelector(${JSON.stringify(formSel)});const i=f.querySelector('input');i.value=${JSON.stringify(email)};f.requestSubmit();return 1})()`); await sleep(1200); return b.eval(`(()=>{const f=document.querySelector(${JSON.stringify(formSel)});return (f.querySelector('button')||{}).textContent.trim()})()`); };
      const e1 = `audit-${n}@example.test`;
      check(`newsletter (${n}): subscribe succeeds`, /Subscribed/.test(await sub(e1)), 'Subscribed ✓', await b.eval(`document.querySelector(${JSON.stringify(formSel)}+' button').textContent.trim()`));
      await sleep(3200);
      check(`newsletter (${n}): duplicate reports already subscribed`, /Already/.test(await sub(e1)), 'Already subscribed', await b.eval(`document.querySelector(${JSON.stringify(formSel)}+' button').textContent.trim()`));
      await sleep(3200);
      b.api.length = 0;
      await sub('');
      check(`newsletter (${n}): empty email sends nothing`, !b.api.some(a => a.path === '/newsletter/subscribe'), 'no request', b.api.length);
    }

    }
    /* ── E. failure simulation ── */
    if (ON('E')) {
    setSuite('browser:failures');
    const MODES = [
      ['500', { status: 500, body: JSON.stringify({ success: false, message: 'Something went wrong. Please try again later.' }) }],
      ['404', { status: 404, body: JSON.stringify({ success: false, message: 'Not found' }) }],
      ['401', { status: 401, body: JSON.stringify({ success: false, message: 'Not authenticated' }) }],
      ['403', { status: 403, body: JSON.stringify({ success: false, message: 'You do not have permission' }) }],
      ['malformed JSON', { status: 200, body: '{"success":true,"data":[{"title":' }],
      ['HTML error page', { status: 502, type: 'text/html', body: '<html><body>Bad Gateway</body></html>' }],
      ['empty array', { status: 200, body: JSON.stringify({ success: true, data: [] }) }],
      ['null data', { status: 200, body: JSON.stringify({ success: true, data: null }) }],
      ['missing data field', { status: 200, body: JSON.stringify({ success: true }) }],
      ['wrong shape (object)', { status: 200, body: JSON.stringify({ success: true, data: { unexpected: true } }) }],
      ['network failure', { network: true }],
      ['slow API (6s)', { delay: 6000, passthrough: true }],
    ];
    const FPAGES = ['index.html', 'about.html', 'activities.html', 'events.html', `event.html?id=${seed.events[0]._id}`, 'projects.html', `project.html?id=${seed.projects[0]._id}`, 'blog.html', `post.html?id=${seed.blogs[0]._id}`, 'podcast.html', 'gallery.html', 'members.html', `student-profile.html?id=${seed.members[0]._id}`, 'achievements.html', 'announcements.html', 'contact.html'];
    for (const [mode, sim] of MODES) {
      b.simulate = (M) => (M === 'GET' ? { name: mode, ...sim } : null);
      for (const url of FPAGES) {
        if (sim.passthrough) await budget(40);
        await b.goto(url, { wait: sim.delay ? 11000 : 5500 });
        await b.scrollThrough();
        const r = await b.eval(INSPECT);
        const name = url.split('?')[0];
        const problems = [];
        if (b.exceptions.length) problems.push('uncaught: ' + b.exceptions.slice(0, 2).join(' | '));
        if (r.artifacts.length) problems.push('text: ' + r.artifacts.join(','));
        if (r.rawErr.length) problems.push('raw error shown: ' + r.rawErr.join(','));
        if (r.stuck.length || r.skeletons.length) problems.push('stuck loading: ' + [...r.stuck, ...r.skeletons].join(','));
        if (r.hiddenContent.length) problems.push('hidden: ' + r.hiddenContent.slice(0, 2).join(','));
        const blank = await b.eval(`(document.querySelector('main')||document.body).innerText.trim().length < 40`);
        if (blank) problems.push('blank page');
        check(`${name} under ${mode}`, problems.length === 0, 'graceful fallback', problems.join(' ; ').slice(0, 300) || 'ok');
      }
    }
    b.simulate = null;

    }
    /* ── F. responsive + reduced motion with live API content ── */
    if (ON('F')) {
    setSuite('browser:responsive');
    const RPAGES = ['index.html', 'about.html', 'activities.html', 'events.html', 'projects.html', 'blog.html', 'podcast.html', 'gallery.html', 'members.html', 'achievements.html', 'announcements.html', 'contact.html', `event.html?id=${seed.events[0]._id}`, `post.html?id=${seed.blogs[0]._id}`, `project.html?id=${seed.projects[0]._id}`];
    const modes = [...WIDTHS.map(([w, h]) => ({ w, h, reduced: false })), { w: 1440, h: 900, reduced: true }];
    for (const m of modes) {
      await b.viewport(m.w, m.h, { reduced: m.reduced });
      for (const url of RPAGES) {
        await budget(25);
        const pg = pages.find(p => p.url === url);
        await b.goto(url, { wait: 12000, settled: pg && pg.expect.length ? pg.expect.map(htmlHas).join('&&') : null });
        await b.scrollThrough(); await sleep(500);
        const r = await b.eval(INSPECT);
        const name = `${url.split('?')[0]} @${m.w}${m.reduced ? ' reduced-motion' : ''}`;
        const missing = []; for (const s of (pg?.expect || [])) if (!(await b.eval(htmlHas(s)))) missing.push(s);
        const problems = [];
        if (r.hOverflow > 1) problems.push(`horizontal overflow ${r.hOverflow}px`);
        if (missing.length) problems.push('missing: ' + missing.join('|'));
        if (r.hiddenContent.length) problems.push('hidden: ' + r.hiddenContent.join(','));
        if (b.exceptions.length || b.logs.length) problems.push('console: ' + [...b.exceptions, ...b.logs].slice(0, 2).join('|'));
        if (b.failed.filter(f => !/\/x(\?|$)/.test(f)).length) problems.push('failed: ' + b.failed.slice(0, 2).join('|'));
        if (r.stuck.length || r.skeletons.length) problems.push('stuck: ' + [...r.stuck, ...r.skeletons].join(','));
        check(name, problems.length === 0, 'renders cleanly', problems.join(' ; ').slice(0, 300) || `ok cls=${r.cls}`);
        if (m.w === 390 || m.w === 1680) await b.shot(`resp-${m.w}-${url.split('?')[0].replace('.html', '')}`);
      }
    }
    await b.viewport(1440, 900);

    }
    /* ── G. duplicate request summary ── */
    if (ON('G')) {
    setSuite('browser:requests');
    for (const [pg, d] of Object.entries(dup)) record(`${pg}: duplicate GETs`, { expected: 'info', actual: d.join(', ') || 'none', pass: true });

    }
    /* ── H. XSS / unsafe CMS content ── */
    if (ON('H')) {
    setSuite('browser:xss');
    const xs = await seedXss(env);
    await env.restart(); used = b.forwarded;
    const XPAGES = ['index.html', 'about.html', 'activities.html', 'events.html', `event.html?id=${xs.event._id}`, `event.html?id=${xs.eventPast._id}`, 'projects.html', `project.html?id=${xs.project._id}`, 'blog.html', `post.html?id=${xs.blog._id}`, 'podcast.html', 'gallery.html', 'members.html', `student-profile.html?id=${xs.member._id}`, 'achievements.html', 'announcements.html', 'contact.html', '404.html'];
    const allTags = new Set();
    for (const url of XPAGES) {
      await budget(30);
      await b.goto(url, { wait: 9000 });
      await b.scrollThrough();
      // exercise interactive surfaces that render CMS text on demand
      await b.eval(`(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));for(const sel of ['.pod-feat-btn--play','.pod-topic-chip','.gal-photo-item','.ann-card a','.ach-card']){const e=document.querySelector(sel);if(e){try{e.click()}catch(x){}await s(500)}}const c=document.querySelector('.pod-player-close,#pod-player-close');if(c)c.click();return 1})()`);
      await sleep(1200);
      const r = await b.eval(INSPECT);
      r.xss.forEach(t => allTags.add(`${url.split('?')[0]} → ${t}`));
      const ok = !r.xss.length && !r.jsLinks.length && !r.handlers.length;
      check(`${url.split('?')[0]}${url.includes('?') ? ' (detail)' : ''}: CMS markup rendered inert`, ok, 'no script ran, no javascript: URLs, no injected handlers',
        ok ? 'ok' : `executed: ${[...new Set(r.xss)].join(',')} | js-urls: ${r.jsLinks.join(',')} | handlers: ${r.handlers.join(',')}`.slice(0, 400));
    }
    fs.writeFileSync(path.join(out, 'xss-executed.txt'), [...allTags].join('\n'));

    }
    /* ── I. admin panel smoke (built-in login with the per-run test password) ── */
    if (ON('I')) {
    setSuite('browser:admin');
    await budget(120);
    await b.goto('admin/index.html', { wait: 4000 });
    await b.eval(`(()=>{document.getElementById('password').value=${JSON.stringify(env.secrets.ADMIN_PASSWORD)};document.getElementById('loginForm').requestSubmit();return 1})()`);
    await sleep(3500);
    check('admin: login with test password reaches dashboard', /dashboard\.html/.test(await b.eval('location.href')), 'dashboard.html', await b.eval('location.pathname'));
    const adminXss = new Set();
    const ADMIN = [['dashboard.html', null], ['events.html', 'Audit Seminar on Imaging'], ['blog.html', 'AUDIT-DRAFT-BLOG'], ['podcast.html', 'AUDIT-DRAFT-PODCAST'], ['members.html', 'AUDIT-DRAFT-MEMBER'], ['achievements.html', 'AUDIT-DRAFT-ACHIEVEMENT'], ['announcements.html', 'Audit Internship Call'], ['gallery.html', 'AUDIT-DRAFT-GALLERY'], ['projects.html', 'AUDIT-DRAFT-PROJECT'], ['timeline.html', 'AUDIT-DRAFT-TIMELINE'], ['newsletter.html', '@example.test'], ['settings.html', null]];
    for (const [pg, expect] of ADMIN) {
      await budget(30);
      await b.goto(`admin/${pg}`, { wait: 9000, settled: expect ? htmlHas(expect) : null });
      await sleep(800);
      const has = expect ? await b.eval(htmlHas(expect)) : true;
      for (const t of (await b.eval('window.__xss')) || []) adminXss.add(`${pg}:${t}`);
      const errs = [...b.exceptions, ...b.logs];
      const fails = b.failed.filter(f => !/\/x(\?|$)|onerror|cloudinary\.com\/demo/.test(f));
      check(`admin/${pg}: loads${expect ? ' and lists drafts (verified staff token)' : ''}`, has && !b.exceptions.length && !fails.length, 'rendered, no errors', `${has ? 'data ok' : 'MISSING ' + expect} ${errs.join('|').slice(0, 120)} ${fails.join('|').slice(0, 120)}`);
    }
    // CMS round trip through the real admin UI: create → edit → delete (timeline)
    const pubTimeline = async () => ((await http('audit', 'GET', '/timeline')).data?.data || []).map(x => x.title);
    await budget(40);
    await b.goto('admin/timeline.html', { wait: 6000 });
    await b.eval(`(()=>{document.getElementById('toggleFormBtn').click();document.getElementById('tlYear').value='2031';document.getElementById('tlTitle').value='Audit UI Created Entry';document.getElementById('tlDesc').value='Created through the admin form';document.getElementById('saveEntryBtn').click();return 1})()`);
    await sleep(2500);
    check('admin UI create → public API', (await pubTimeline()).includes('Audit UI Created Entry'), 'present', (await pubTimeline()).join(' | ').slice(0, 120));
    await b.goto('about.html', { wait: 9000, settled: htmlHas('Audit UI Created Entry') });
    check('admin UI create → public About page', await b.eval(htmlHas('Audit UI Created Entry')), true, await b.eval(htmlHas('Audit UI Created Entry')));
    const created = ((await http('audit', 'GET', '/timeline')).data?.data || []).find(x => x.title === 'Audit UI Created Entry');
    if (created) {
      await b.goto('admin/timeline.html', { wait: 6000, settled: htmlHas('Audit UI Created Entry') });
      await b.eval(`(()=>{editEntry(${JSON.stringify(created._id)});document.getElementById('tlTitle').value='Audit UI Edited Entry';document.getElementById('saveEntryBtn').click();return 1})()`);
      await sleep(2500);
      const after = await pubTimeline();
      check('admin UI edit → public API (same record, new title)', after.includes('Audit UI Edited Entry') && !after.includes('Audit UI Created Entry'), 'edited', after.join(' | ').slice(0, 120));
      await b.goto('admin/timeline.html', { wait: 6000, settled: htmlHas('Audit UI Edited Entry') });
      await b.eval(`(()=>{openDeleteModal(${JSON.stringify(created._id)});document.getElementById('confirmDelete').click();return 1})()`);
      await sleep(2500);
      check('admin UI delete → gone from public API', !(await pubTimeline()).includes('Audit UI Edited Entry'), 'absent', (await pubTimeline()).join(' | ').slice(0, 120));
      await b.goto('about.html', { wait: 7000 });
      check('admin UI delete → gone from public page', !(await b.eval(htmlHas('Audit UI Edited Entry'))), 'absent', await b.eval(htmlHas('Audit UI Edited Entry')));
    }
    check('admin: CMS markup rendered inert in admin tables', adminXss.size === 0, 'no script ran', [...adminXss].join(',').slice(0, 300) || 'ok');
    }
  } finally {
    await b.close();
  }
}
