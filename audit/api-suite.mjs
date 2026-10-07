// API suite — runs ONLY against the verified isolated audit backend (:5055,
// database embs-audit-tmp). Mutations are possible only because the guard
// has proven isolation; every request goes through guard.http().
import fs from 'node:fs';
import path from 'node:path';
import { http } from './lib/guard.mjs';
import { record, expectStatus, check, setSuite } from './lib/report.mjs';
import { breq, BACKEND } from './lib/env.mjs';

const A = (method, p, o) => http('audit', method, p, o);
const BAD_ID = '64b000000000000000000000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ids = rows => new Set((Array.isArray(rows) ? rows : []).map(x => x._id));
const bodies = [];                       // every audit response, for the sensitive-data scan
const keep = r => { bodies.push(r.text || ''); return r; };

/* Content types: the generic CRUD + publication contract for each. */
const TYPES = [
  { name: 'events', path: '/events', upd: 'PUT', adminList: '?all=true',
    create: { title: 'Audit Event', date: '2031-05-01', published: true, mode: 'offline' },
    draft: { title: 'AUDIT-DRAFT-event', date: '2031-05-02', published: false },
    missing: { date: '2031-01-01' }, invalid: { mode: 'telepathy' },
    patch: { venue: 'Audit Hall' }, patched: d => d.venue === 'Audit Hall', still: d => d.published === true && d.title === 'Audit Event' },
  { name: 'podcasts', path: '/podcasts', upd: 'PATCH', adminList: '?drafts=true',
    create: { title: 'Audit Episode', episodeNumber: 901, published: true },
    draft: { title: 'AUDIT-DRAFT-podcast', episodeNumber: 902, published: false },
    missing: { title: 'no number' }, invalid: { episodeNumber: 'not-a-number' },
    patch: { guestName: 'Audit Guest' }, patched: d => d.guestName === 'Audit Guest', still: (d, o) => d.published === true && !!d.publishedAt && d.publishedAt === o.publishedAt },
  { name: 'blogs', path: '/blogs', upd: 'PATCH', adminList: '?drafts=true',
    create: { title: 'Audit Post', content: 'Audit body text.', published: true },
    draft: { title: 'AUDIT-DRAFT-blog', content: 'draft body', published: false },
    missing: { content: 'no title' }, invalid: { published: true, publishedAt: 'not-a-date' },
    patch: { excerpt: 'Audit excerpt' }, patched: d => d.excerpt === 'Audit excerpt', still: (d, o) => d.published === true && !!d.publishedAt && d.publishedAt === o.publishedAt },
  { name: 'members', path: '/members', upd: 'PATCH', adminList: '?all=true', paged: true,
    create: { name: 'Audit Member', role: 'Audit Role', active: true },
    draft: { name: 'AUDIT-DRAFT-member', role: 'Inactive', active: false },
    missing: { role: 'no name' }, invalid: { active: 'definitely' },
    patch: { batch: '2031' }, patched: d => d.batch === '2031', still: d => d.active === true && d.name === 'Audit Member' },
  { name: 'achievements', path: '/achievements', upd: 'PATCH', adminList: '?all=true',
    create: { title: 'Audit Award', featured: true, date: '2031-01-01' },
    draft: { title: 'AUDIT-DRAFT-achievement', featured: false },
    missing: { description: 'no title' }, invalid: { title: '' },
    patch: { category: 'Audit' }, patched: d => d.category === 'Audit', still: d => d.featured === true && d.title === 'Audit Award' },
  { name: 'announcements', path: '/announcements', upd: 'PATCH', adminList: null,
    create: { title: 'Audit Notice', body: 'Audit notice body', category: 'workshops' },
    draft: { title: 'AUDIT-DRAFT-expired-notice', body: 'expired', expiresAt: '2001-01-01T00:00:00Z' },
    missing: { body: 'no title' }, invalid: { category: 'not-a-category' },
    patch: { link: 'https://example.test/apply' }, patched: d => d.link === 'https://example.test/apply', still: d => d.title === 'Audit Notice' && d.category === 'workshops' },
  { name: 'gallery', path: '/gallery', upd: 'PATCH', adminList: '?drafts=true',
    create: { title: 'Audit Photo', imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', published: true },
    draft: { title: 'AUDIT-DRAFT-gallery', imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', published: false },
    missing: { title: 'no image' }, invalid: { type: 'hologram' },
    patch: { caption: 'Audit caption' }, patched: d => d.caption === 'Audit caption', still: (d, o) => d.published === true && !!d.publishedAt && d.publishedAt === o.publishedAt },
  { name: 'projects', path: '/projects', upd: 'PATCH', adminList: '?all=true',
    create: { title: 'Audit Project', featured: true, status: 'ongoing' },
    draft: { title: 'AUDIT-DRAFT-project', featured: false },
    missing: { description: 'no title' }, invalid: { status: 'abandoned-forever' },
    patch: { mentor: 'Audit Mentor' }, patched: d => d.mentor === 'Audit Mentor', still: d => d.featured === true && d.visibility === 'visible' && d.status === 'ongoing' },
  { name: 'documents', path: '/documents', upd: 'PATCH', adminList: '?all=true',
    create: { title: 'Audit Brochure', fileUrl: 'https://example.test/brochure.pdf' },
    draft: { title: 'AUDIT-DRAFT-document', fileUrl: 'https://example.test/private.pdf', published: false },
    missing: { title: 'no file' }, invalid: { published: 'maybe' },
    patch: { description: 'Audit doc' }, patched: d => d.description === 'Audit doc', still: d => d.published === true && d.public === true },
  { name: 'timeline', path: '/timeline', upd: 'PATCH', adminList: '?all=true',
    create: { year: '2031', title: 'Audit Milestone', active: true },
    draft: { year: '2032', title: 'AUDIT-DRAFT-timeline', active: false },
    missing: { title: 'no year' }, invalid: { year: { $gt: '' } },
    patch: { description: 'Audit milestone text' }, patched: d => d.description === 'Audit milestone text', still: d => d.active === true && d.title === 'Audit Milestone' },
];

/* The backend allows 600 /api requests per 15 min per IP. Rather than weaken
   that, restart the isolated backend (which re-proves isolation) when close. */
import { journal } from './lib/guard.mjs';
let sinceRestart = 0, mark = 0;
async function budget(env, need = 120) {
  sinceRestart += journal.length - mark; mark = journal.length;
  if (sinceRestart + need > 560) { await env.restart(); sinceRestart = 0; }
}

export async function runApiSuite({ env, sink }) {
  /* ── seed test-only users directly in embs-audit-tmp ── */
  const User = breq('./models/User');
  const PW = { admin: 'AuditAdmin#2031', editor: 'AuditEditor#2031', viewer: 'AuditViewer#2031' };
  await env.dbWrite(async () => {
    await User.deleteMany({ email: /@audit\.test$/ });
    for (const role of ['admin', 'editor', 'viewer']) await User.create({ name: `Audit ${role}`, email: `${role}@audit.test`, password: PW[role], role });
  });

  /* ══ AUTH ══════════════════════════════════════════════ */
  setSuite('auth');
  const login = (email, password) => A('POST', '/auth/login', { json: { email, password } });
  const tok = {};
  for (const role of ['admin', 'editor', 'viewer']) {
    const r = keep(await login(`${role}@audit.test`, PW[role]));
    expectStatus(`login ${role} (db user)`, 'POST /auth/login', r, 200, x => !!x.data?.data?.token || 'no token');
    tok[role] = r.data?.data?.token;
    if (role === 'admin') check('login sets httpOnly token cookie', r.setCookie.some(c => /^token=/.test(c) && /HttpOnly/i.test(c)), 'httpOnly cookie', r.setCookie.join(';').slice(0, 60), 'POST /auth/login');
  }
  const rb = keep(await login('admin@ieeoembs.com', env.secrets.ADMIN_PASSWORD));
  expectStatus('login built-in admin (ADMIN_PASSWORD, as admin panel does)', 'POST /auth/login', rb, 200);
  tok.builtin = rb.data?.data?.token;
  expectStatus('login wrong password', 'POST /auth/login', keep(await login('admin@audit.test', 'wrong-password')), 401);
  expectStatus('login unknown user', 'POST /auth/login', keep(await login('nobody@audit.test', 'whatever1')), 401);
  expectStatus('login missing fields', 'POST /auth/login', keep(await A('POST', '/auth/login', { json: {} })), 400);
  expectStatus('login NoSQL operator in email', 'POST /auth/login', keep(await A('POST', '/auth/login', { json: { email: { $gt: '' }, password: { $gt: '' } } })), 400);
  expectStatus('login malformed JSON', 'POST /auth/login', keep(await A('POST', '/auth/login', { json: '{"email":' })), 400);

  const wrongSecret = breq('jsonwebtoken').sign({ id: 'admin', role: 'admin' }, 'not-the-secret');
  const expired = env.token({ id: 'admin', role: 'admin' }, { expiresIn: -10 });
  const BADTOKENS = { 'no token': undefined, 'garbage token': 'x', 'wrong-secret token': wrongSecret, 'expired token': expired };
  for (const [k, t] of Object.entries(BADTOKENS)) expectStatus(`GET /auth/me with ${k}`, 'GET /auth/me', keep(await A('GET', '/auth/me', { token: t })), 401);
  expectStatus('GET /auth/me with "Bearer" and no value', 'GET /auth/me', keep(await A('GET', '/auth/me', { headers: { Authorization: 'Bearer ' } })), 401);
  expectStatus('GET /auth/me valid editor', 'GET /auth/me', keep(await A('GET', '/auth/me', { token: tok.editor })), 200, r => r.data?.data?.role === 'editor' || 'wrong role');
  expectStatus('GET /auth/me via cookie only', 'GET /auth/me', keep(await A('GET', '/auth/me', { cookie: `token=${tok.viewer}` })), 200, r => r.data?.data?.role === 'viewer' || 'wrong user');
  expectStatus('GET /auth/me built-in admin', 'GET /auth/me', keep(await A('GET', '/auth/me', { token: tok.builtin })), 200);
  const lo = keep(await A('POST', '/auth/logout'));
  expectStatus('logout clears cookie', 'POST /auth/logout', lo, 200, r => r.setCookie.some(c => /^token=;/.test(c)) || 'cookie not cleared');

  // register (admin-only)
  const reg = { name: 'Audit New', email: 'new@audit.test', password: 'AuditNew#2031', role: 'viewer' };
  expectStatus('register anonymous', 'POST /auth/register', keep(await A('POST', '/auth/register', { json: reg })), 401);
  expectStatus('register as editor', 'POST /auth/register', keep(await A('POST', '/auth/register', { json: reg, token: tok.editor })), 403);
  expectStatus('register invalid role', 'POST /auth/register', keep(await A('POST', '/auth/register', { json: { ...reg, role: 'superuser' }, token: tok.admin })), 400);
  expectStatus('register short password', 'POST /auth/register', keep(await A('POST', '/auth/register', { json: { ...reg, password: 'short' }, token: tok.admin })), 400);
  const rr = keep(await A('POST', '/auth/register', { json: reg, token: tok.admin }));
  expectStatus('register as admin', 'POST /auth/register', rr, 201);
  check('register does not replace the admin\'s session cookie', !rr.setCookie.some(c => /^token=[^;]/.test(c)), 'no Set-Cookie for new user', rr.setCookie.length ? 'Set-Cookie token=<new user>' : 'none', 'POST /auth/register');
  expectStatus('register duplicate email', 'POST /auth/register', keep(await A('POST', '/auth/register', { json: reg, token: tok.admin })), 400);
  expectStatus('register NoSQL operator', 'POST /auth/register', keep(await A('POST', '/auth/register', { json: { ...reg, email: { $gt: '' } }, token: tok.admin })), 400);

  // update-me / update-password
  expectStatus('update-me anonymous', 'PATCH /auth/update-me', keep(await A('PATCH', '/auth/update-me', { json: { name: 'x' } })), 401);
  expectStatus('update-me editor', 'PATCH /auth/update-me', keep(await A('PATCH', '/auth/update-me', { json: { name: 'Audit Editor Renamed' }, token: tok.editor })), 200, r => r.data?.data?.name === 'Audit Editor Renamed' || 'not renamed');
  expectStatus('update-me rejects password field', 'PATCH /auth/update-me', keep(await A('PATCH', '/auth/update-me', { json: { password: 'x' }, token: tok.editor })), 400);
  expectStatus('update-me built-in admin (no DB user)', 'PATCH /auth/update-me', keep(await A('PATCH', '/auth/update-me', { json: { name: 'x' }, token: tok.builtin })), [400, 403]);
  expectStatus('update-password anonymous', 'PATCH /auth/update-password', keep(await A('PATCH', '/auth/update-password', { json: {} })), 401);
  expectStatus('update-password missing fields', 'PATCH /auth/update-password', keep(await A('PATCH', '/auth/update-password', { json: {}, token: tok.viewer })), 400);
  expectStatus('update-password too short', 'PATCH /auth/update-password', keep(await A('PATCH', '/auth/update-password', { json: { currentPassword: PW.viewer, newPassword: '123' }, token: tok.viewer })), 400);
  expectStatus('update-password non-string', 'PATCH /auth/update-password', keep(await A('PATCH', '/auth/update-password', { json: { currentPassword: PW.viewer, newPassword: { length: 12 } }, token: tok.viewer })), 400);
  expectStatus('update-password wrong current', 'PATCH /auth/update-password', keep(await A('PATCH', '/auth/update-password', { json: { currentPassword: 'nope-nope', newPassword: 'AuditViewer#2032' }, token: tok.viewer })), 401);
  expectStatus('update-password built-in admin (no DB user)', 'PATCH /auth/update-password', keep(await A('PATCH', '/auth/update-password', { json: { currentPassword: 'a', newPassword: 'AuditX#20311' }, token: tok.builtin })), [400, 403]);
  const up = keep(await A('PATCH', '/auth/update-password', { json: { currentPassword: PW.viewer, newPassword: 'AuditViewer#2032' }, token: tok.viewer }));
  expectStatus('update-password success', 'PATCH /auth/update-password', up, 200);
  expectStatus('login with new password', 'POST /auth/login', keep(await login('viewer@audit.test', 'AuditViewer#2032')), 200);
  expectStatus('login with old password rejected', 'POST /auth/login', keep(await login('viewer@audit.test', PW.viewer)), 401);
  // deleted user token
  const ghost = await env.dbWrite(() => User.create({ name: 'Ghost', email: 'ghost@audit.test', password: 'Ghost#20311', role: 'admin' }));
  const ghostTok = env.token({ id: String(ghost._id), role: 'admin' });
  await env.dbWrite(() => User.deleteOne({ _id: ghost._id }));
  expectStatus('token of deleted user rejected', 'GET /auth/me', keep(await A('GET', '/auth/me', { token: ghostTok })), 401);
  // forged role claim: viewer user id + role admin in a token signed with a WRONG secret
  expectStatus('forged token rejected on admin route', 'GET /dashboard/stats', keep(await A('GET', '/dashboard/stats', { token: wrongSecret })), 401);

  /* ══ CONTENT TYPES: CRUD + publication / authorization ══ */
  for (const T of TYPES) {
    await budget(env, 90);
    setSuite(`crud:${T.name}`);
    const P = T.path;
    expectStatus('create anonymous', `POST ${P}`, keep(await A('POST', P, { json: T.create })), 401);
    expectStatus('create garbage token', `POST ${P}`, keep(await A('POST', P, { json: T.create, token: 'x' })), 401);
    expectStatus('create expired token', `POST ${P}`, keep(await A('POST', P, { json: T.create, token: expired })), 401);
    expectStatus('create viewer (role)', `POST ${P}`, keep(await A('POST', P, { json: T.create, token: tok.viewer })), 403);
    expectStatus('create missing required', `POST ${P}`, keep(await A('POST', P, { json: T.missing, token: tok.editor })), 400);
    expectStatus('create empty body', `POST ${P}`, keep(await A('POST', P, { json: {}, token: tok.editor })), 400);
    expectStatus('create invalid value', `POST ${P}`, keep(await A('POST', P, { json: { ...T.create, ...T.invalid }, token: tok.editor })), 400);
    const c = keep(await A('POST', P, { json: { ...T.create, auditUnexpected: 'x' }, token: tok.editor }));
    expectStatus('create valid (editor)', `POST ${P}`, c, 201, r => (r.data?.data && !('auditUnexpected' in r.data.data)) || 'unexpected field persisted');
    const item = c.data?.data || {};
    const d = keep(await A('POST', P, { json: T.draft, token: tok.builtin }));
    expectStatus('create draft/unpublished (built-in admin)', `POST ${P}`, d, 201);
    const draft = d.data?.data || {};

    if (item._id) {
      expectStatus('read published by id (anon) returns that record', `GET ${P}/:id`, keep(await A('GET', `${P}/${item._id}`)), 200, r => r.data?.data?._id === item._id || 'wrong record');
    }
    expectStatus('read malformed id', `GET ${P}/:id`, keep(await A('GET', `${P}/not-an-id`)), 400);
    expectStatus('read nonexistent id', `GET ${P}/:id`, keep(await A('GET', `${P}/${BAD_ID}`)), 404);

    const pub = keep(await A('GET', P));
    expectStatus('list anon', `GET ${P}`, pub, 200, r => Array.isArray(r.data?.data) || 'data not array');
    check('list anon includes published', ids(pub.data?.data).has(item._id), 'present', ids(pub.data?.data).has(item._id), `GET ${P}`);
    check('list anon excludes draft', !ids(pub.data?.data).has(draft._id), 'absent', ids(pub.data?.data).has(draft._id) ? 'LEAKED' : 'absent', `GET ${P}`);

    // draft-leak probes: every variant must keep the draft out
    const probes = [
      ['?all=true anon', `${P}?all=true`, {}], ['?drafts=true anon', `${P}?drafts=true`, {}],
      ['fake bearer', P, { token: 'x' }], ['random bearer', P, { token: 'eyJhbGciOiJIUzI1NiJ9.e30.abc' }],
      ['wrong-secret bearer', P, { token: wrongSecret }], ['expired bearer', P, { token: expired }],
      ['viewer token ?all=true', `${P}?all=true`, { token: tok.viewer }],
    ];
    for (const [label, url, o] of probes) {
      const r = keep(await A('GET', url, o));
      check(`draft not leaked: ${label}`, [200, 401, 403].includes(r.status) && !ids(r.data?.data).has(draft._id), 'draft absent (200 public / 401)', `${r.status} ${ids(r.data?.data).has(draft._id) ? 'LEAKED' : 'absent'}`, `GET ${P}`);
    }
    if (draft._id) {
      for (const [label, o] of [['anon', {}], ['fake bearer', { token: 'x' }], ['?all=true', {}]]) {
        const r = keep(await A('GET', `${P}/${draft._id}${label === '?all=true' ? '?all=true' : ''}`, o));
        check(`draft by id not leaked: ${label}`, r.status !== 200, '404/401', r.status, `GET ${P}/:id`);
      }
      const adm = keep(await A('GET', `${P}/${draft._id}`, { token: tok.builtin }));
      expectStatus('draft by id visible to admin', `GET ${P}/:id`, adm, 200);
    }
    if (T.adminList) {
      for (const [who, t] of [['built-in admin', tok.builtin], ['editor', tok.editor]]) {
        const r = keep(await A('GET', P + T.adminList, { token: t }));
        check(`admin list (${who}) includes draft`, r.status === 200 && ids(r.data?.data).has(draft._id), '200 + draft present', `${r.status} ${ids(r.data?.data).has(draft._id)}`, `GET ${P}`);
      }
    }

    // pagination contract (opt-in)
    if (!['announcements', 'documents', 'timeline'].includes(T.name)) {
      const pg = keep(await A('GET', `${P}?page=1&limit=1`));
      expectStatus('pagination page=1&limit=1', `GET ${P}`, pg, 200, r => (r.data?.data?.length <= 1 && r.data?.meta?.limit === 1 && typeof r.data?.meta?.total === 'number') || 'bad meta');
      const big = keep(await A('GET', `${P}?limit=999999`));
      expectStatus('pagination limit capped at 100', `GET ${P}`, big, 200, r => r.data?.meta?.limit === 100 || 'not capped');
      expectStatus('pagination junk values', `GET ${P}`, keep(await A('GET', `${P}?page=-4&limit=abc`)), 200, r => r.data?.meta?.page === 1 || 'bad page');
    }

    // update
    if (item._id) {
      const before = keep(await A('GET', `${P}/${item._id}`, { token: tok.builtin })).data?.data || item;
      await sleep(20);
      expectStatus('update anonymous', `${T.upd} ${P}/:id`, keep(await A(T.upd, `${P}/${item._id}`, { json: T.patch })), 401);
      expectStatus('update viewer', `${T.upd} ${P}/:id`, keep(await A(T.upd, `${P}/${item._id}`, { json: T.patch, token: tok.viewer })), 403);
      const u = keep(await A(T.upd, `${P}/${item._id}`, { json: T.patch, token: tok.editor }));
      expectStatus('update partial (editor) applies change', `${T.upd} ${P}/:id`, u, 200, r => T.patched(r.data?.data || {}) || 'change not applied');
      check('partial update preserves other fields/state', !!u.data?.data && T.still(u.data.data, before), 'unchanged', JSON.stringify(u.data?.data || {}).slice(0, 160), `${T.upd} ${P}/:id`);
      const after = keep(await A('GET', P));
      check('partially-updated item still public', ids(after.data?.data).has(item._id), 'present', ids(after.data?.data).has(item._id), `GET ${P}`);
      expectStatus('update invalid value', `${T.upd} ${P}/:id`, keep(await A(T.upd, `${P}/${item._id}`, { json: T.invalid, token: tok.editor })), 400);
    }
    expectStatus('update malformed id', `${T.upd} ${P}/:id`, keep(await A(T.upd, `${P}/not-an-id`, { json: T.patch, token: tok.editor })), 400);
    expectStatus('update nonexistent', `${T.upd} ${P}/:id`, keep(await A(T.upd, `${P}/${BAD_ID}`, { json: T.patch, token: tok.editor })), 404);

    // delete (only disposable records created above)
    if (item._id) {
      expectStatus('delete anonymous', `DELETE ${P}/:id`, keep(await A('DELETE', `${P}/${item._id}`)), 401);
      expectStatus('delete editor (admin-only)', `DELETE ${P}/:id`, keep(await A('DELETE', `${P}/${item._id}`, { token: tok.editor })), 403);
      expectStatus('delete admin', `DELETE ${P}/:id`, keep(await A('DELETE', `${P}/${item._id}`, { token: tok.admin })), 200);
      expectStatus('delete again → not found', `DELETE ${P}/:id`, keep(await A('DELETE', `${P}/${item._id}`, { token: tok.admin })), 404);
      expectStatus('read after delete', `GET ${P}/:id`, keep(await A('GET', `${P}/${item._id}`)), 404);
    }
    expectStatus('delete malformed id', `DELETE ${P}/:id`, keep(await A('DELETE', `${P}/not-an-id`, { token: tok.admin })), 400);
    if (draft._id) await A('DELETE', `${P}/${draft._id}`, { token: tok.admin });
  }

  /* ── type-specific behaviour ── */
  await budget(env, 80);
  setSuite('members:filters');
  const mk = async b => (await A('POST', '/members', { json: { name: 'Audit F', role: 'Faculty', ...b }, token: tok.admin })).data?.data;
  const mOrg = await mk({ name: 'Audit Org (inactive)', inOrgChart: true, active: false });
  const mFac = await mk({ name: 'Audit Coordinator', isFacultyCoordinator: true });
  const mFacOff = await mk({ name: 'Audit Coordinator Off', isFacultyCoordinator: true, active: false });
  const mAdv = await mk({ name: 'Audit Advisor', isFacultyAdvisor: true });
  const has = async (q, m) => ids((await A('GET', '/members' + q)).data?.data).has(m._id);
  check('?orgchart=true includes inOrgChart (any active state)', await has('?orgchart=true', mOrg), true, await has('?orgchart=true', mOrg), 'GET /members');
  check('?faculty=true includes active coordinator', await has('?faculty=true', mFac), true, await has('?faculty=true', mFac), 'GET /members');
  check('?faculty=true excludes inactive coordinator', !(await has('?faculty=true', mFacOff)), false, await has('?faculty=true', mFacOff), 'GET /members');
  check('?advisor=true includes advisor', await has('?advisor=true', mAdv), true, await has('?advisor=true', mAdv), 'GET /members');
  for (const m of [mOrg, mFac, mFacOff, mAdv]) if (m) await A('DELETE', `/members/${m._id}`, { token: tok.admin });

  setSuite('gallery:filters');
  const ev = (await A('POST', '/events', { json: { title: 'Audit Gallery Event', date: '2030-02-02', published: true }, token: tok.admin })).data?.data;
  const g1 = (await A('POST', '/gallery', { json: { title: 'Audit G1', imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', published: true, event: ev?._id }, token: tok.admin })).data?.data;
  const gv = (await A('POST', '/gallery', { json: { title: 'Audit Video', type: 'video', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', published: true }, token: tok.admin })).data?.data;
  const gEv = keep(await A('GET', `/gallery?event=${ev?._id}`));
  expectStatus('?event=<id> filters and populates event title', 'GET /gallery', gEv, 200, r => (r.data.data.length === 1 && r.data.data[0].event?.title === 'Audit Gallery Event') || 'filter/populate wrong');
  expectStatus('?type=video', 'GET /gallery', keep(await A('GET', '/gallery?type=video')), 200, r => (r.data.data.every(x => x.type === 'video') && ids(r.data.data).has(gv?._id)) || 'type filter wrong');
  const badEv = keep(await A('GET', '/gallery?event=notanid'));
  expectStatus('?event=<malformed> is a 400 without DB internals', 'GET /gallery', badEv, 400, r => !/Cast to ObjectId|model|path/i.test(r.text) || 'internal error text exposed');
  expectStatus('?event[$ne]= operator injection', 'GET /gallery', keep(await A('GET', '/gallery?event[$ne]=x')), 400);
  expectStatus('?type[$ne]=x operator injection does not widen results', 'GET /gallery', keep(await A('GET', '/gallery?type[$ne]=x')), [200, 400], r => r.status === 400 || r.data.data.length === 0 || 'operator applied');
  expectStatus('video item without image accepted', 'POST /gallery', { status: gv ? 201 : 0 }, 201);
  for (const [p, x] of [['/gallery', g1], ['/gallery', gv], ['/events', ev]]) if (x) await A('DELETE', `${p}/${x._id}`, { token: tok.admin });

  setSuite('events:status');
  const past = keep(await A('POST', '/events', { json: { title: 'Audit Past', date: '2001-01-01', published: true }, token: tok.admin }));
  expectStatus('past date → status completed', 'POST /events', past, 201, r => r.data.data.status === 'completed' || r.data.data.status);
  const fut = keep(await A('POST', '/events', { json: { title: 'Audit Future', date: '2099-01-01', published: 'true' }, token: tok.admin }));
  expectStatus('future date + "true" string → upcoming, published', 'POST /events', fut, 201, r => (r.data.data.status === 'upcoming' && r.data.data.published === true) || JSON.stringify(r.data.data));
  for (const x of [past, fut]) if (x.data?.data) await A('DELETE', `/events/${x.data.data._id}`, { token: tok.admin });

  setSuite('blogs:author');
  const bb = keep(await A('POST', '/blogs', { json: { title: 'Audit Built-in Author', content: 'x', published: true }, token: tok.builtin }));
  expectStatus('built-in admin (admin panel login) can create a blog post', 'POST /blogs', bb, 201);
  if (bb.data?.data) {
    const ub = keep(await A('PATCH', `/blogs/${bb.data.data._id}`, { json: { title: 'Audit Built-in Author 2' }, token: tok.builtin }));
    expectStatus('built-in admin can update a blog post', 'PATCH /blogs/:id', ub, 200);
    await A('DELETE', `/blogs/${bb.data.data._id}`, { token: tok.admin });
  }
  const bu = keep(await A('POST', '/blogs', { json: { title: 'Audit DB Author', content: 'x', published: true }, token: tok.editor }));
  expectStatus('db user author populated on read', 'GET /blogs/:id', keep(await A('GET', `/blogs/${bu.data?.data?._id}`)), 200, r => r.data.data.author?.name === 'Audit Editor Renamed' || JSON.stringify(r.data.data.author));
  if (bu.data?.data) await A('DELETE', `/blogs/${bu.data.data._id}`, { token: tok.admin });

  setSuite('documents:public');
  const dPub = (await A('POST', '/documents', { json: { title: 'Audit Public Doc', fileUrl: 'https://example.test/a.pdf' }, token: tok.admin })).data?.data;
  const dPriv = (await A('POST', '/documents', { json: { title: 'AUDIT-PRIVATE-doc', fileUrl: 'https://example.test/p.pdf', public: false }, token: tok.admin })).data?.data;
  const dp = keep(await A('GET', '/documents/public'));
  expectStatus('GET /documents/public lists public only', 'GET /documents/public', dp, 200, r => (ids(r.data.data).has(dPub?._id) && !ids(r.data.data).has(dPriv?._id)) || 'wrong set');
  check('private document not readable by id anonymously', (await A('GET', `/documents/${dPriv?._id}`)).status !== 200, '404', (await A('GET', `/documents/${dPriv?._id}`)).status, 'GET /documents/:id');
  check('private document readable by admin', (await A('GET', `/documents/${dPriv?._id}`, { token: tok.admin })).status === 200, 200, (await A('GET', `/documents/${dPriv?._id}`, { token: tok.admin })).status, 'GET /documents/:id');
  for (const x of [dPub, dPriv]) if (x) await A('DELETE', `/documents/${x._id}`, { token: tok.admin });

  setSuite('announcements:expiry');
  const an = (await A('POST', '/announcements', { json: { title: 'Audit Future Expiry', body: 'b', expiresAt: '2099-01-01T00:00:00Z', pinned: true }, token: tok.admin })).data?.data;
  const an2 = (await A('POST', '/announcements', { json: { title: 'Audit Unpinned', body: 'b' }, token: tok.admin })).data?.data;
  const al = keep(await A('GET', '/announcements'));
  expectStatus('future-expiry listed, pinned first', 'GET /announcements', al, 200, r => (r.data.data[0]?._id === an?._id && ids(r.data.data).has(an2?._id)) || 'order wrong');
  for (const x of [an, an2]) if (x) await A('DELETE', `/announcements/${x._id}`, { token: tok.admin });

  /* ══ NEWSLETTER ══ */
  await budget(env, 80);
  setSuite('newsletter');
  const SUB = e => A('POST', '/newsletter/subscribe', { json: { email: e } });
  expectStatus('subscribe valid', 'POST /newsletter/subscribe', keep(await SUB('audit-reader-1@example.test')), 201);
  expectStatus('subscribe second', 'POST /newsletter/subscribe', keep(await SUB('audit-reader-2@example.test')), 201);
  expectStatus('subscribe duplicate', 'POST /newsletter/subscribe', keep(await SUB('audit-reader-1@example.test')), 409);
  expectStatus('subscribe duplicate differing in case/space', 'POST /newsletter/subscribe', keep(await SUB('  AUDIT-Reader-1@example.test ')), 409);
  expectStatus('subscribe missing', 'POST /newsletter/subscribe', keep(await A('POST', '/newsletter/subscribe', { json: {} })), 400);
  expectStatus('subscribe invalid email', 'POST /newsletter/subscribe', keep(await SUB('not-an-email')), 400);
  expectStatus('subscribe operator object', 'POST /newsletter/subscribe', keep(await SUB({ $gt: '' })), 400);
  expectStatus('subscribe markup-bearing email rejected', 'POST /newsletter/subscribe', keep(await SUB('<img/src=x/onerror=alert(1)>@a.co')), 400);
  expectStatus('subscribe quote-bearing email rejected', 'POST /newsletter/subscribe', keep(await SUB('a"onmouseover=alert(1)"@a.co')), 400);
  expectStatus('list subscribers anonymous', 'GET /newsletter', keep(await A('GET', '/newsletter')), 401);
  expectStatus('list subscribers editor', 'GET /newsletter', keep(await A('GET', '/newsletter', { token: tok.editor })), 403);
  expectStatus('list subscribers admin', 'GET /newsletter', keep(await A('GET', '/newsletter', { token: tok.builtin })), 200, r => r.data.data.length === 2 || r.data.data.length);
  const UNS = body => A('DELETE', '/newsletter/unsubscribe', { json: body });
  const countSubs = async () => (await A('GET', '/newsletter', { token: tok.admin })).data?.data?.length;
  const n0 = await countSubs();
  expectStatus('unsubscribe {"email":{"$ne":null}} rejected', 'DELETE /newsletter/unsubscribe', keep(await UNS({ email: { $ne: null } })), 400);
  expectStatus('unsubscribe {"email":{"$regex":".*"}} rejected', 'DELETE /newsletter/unsubscribe', keep(await UNS({ email: { $regex: '.*' } })), 400);
  expectStatus('unsubscribe array value rejected', 'DELETE /newsletter/unsubscribe', keep(await UNS({ email: ['a@example.test'] })), 400);
  check('operator payloads deleted nothing', (await countSubs()) === n0, n0, await countSubs(), 'DELETE /newsletter/unsubscribe');
  expectStatus('unsubscribe missing email', 'DELETE /newsletter/unsubscribe', keep(await UNS({})), 400);
  expectStatus('unsubscribe nonexistent', 'DELETE /newsletter/unsubscribe', keep(await UNS({ email: 'nobody@example.test' })), 404);
  expectStatus('unsubscribe case-insensitive', 'DELETE /newsletter/unsubscribe', keep(await UNS({ email: 'AUDIT-READER-2@Example.Test' })), 200);
  check('exactly one subscriber removed', (await countSubs()) === n0 - 1, n0 - 1, await countSubs(), 'DELETE /newsletter/unsubscribe');
  await SUB('audit-reader-2@example.test');

  sink.messages.length = 0;
  expectStatus('send newsletter editor', 'POST /newsletter/send', keep(await A('POST', '/newsletter/send', { json: { subject: 's', text: 't' }, token: tok.editor })), 403);
  expectStatus('send newsletter missing subject', 'POST /newsletter/send', keep(await A('POST', '/newsletter/send', { json: { text: 't' }, token: tok.admin })), 400);
  expectStatus('send newsletter missing content', 'POST /newsletter/send', keep(await A('POST', '/newsletter/send', { json: { subject: 's' }, token: tok.admin })), 400);
  const ns = keep(await A('POST', '/newsletter/send', { json: { subject: 'Audit Newsletter', text: 'Line one\n<b>not bold</b>' }, token: tok.builtin }));
  expectStatus('send newsletter admin', 'POST /newsletter/send', ns, 200, r => r.data.data.sent === 2 || JSON.stringify(r.data.data));
  await sleep(400);
  const nm = sink.messages.filter(m => m.subject === 'Audit Newsletter');
  check('newsletter delivered once per subscriber (fake SMTP)', nm.length === 2 && nm.every(m => m.to.length === 1), '2 messages, 1 rcpt each', nm.map(m => m.to.join(',')).join(' | '), 'POST /newsletter/send');
  check('newsletter text→html fallback escapes markup', nm[0] && !/<b>not bold<\/b>/.test(nm[0].html) && /&lt;b&gt;/.test(nm[0].html), 'escaped', (nm[0]?.html || '').slice(0, 120), 'POST /newsletter/send');

  /* publish notifications (fire-and-forget) */
  setSuite('notifications');
  sink.messages.length = 0;
  const na = (await A('POST', '/announcements', { json: { title: 'Audit <i>Notice</i> & more', body: 'Body <script>x</script>' }, token: tok.admin })).data?.data;
  const ne = (await A('POST', '/events', { json: { title: 'Audit Notify Event', date: '2099-03-03', published: true }, token: tok.admin })).data?.data;
  const nd = (await A('POST', '/events', { json: { title: 'Audit Draft No Notify', date: '2099-03-04', published: false }, token: tok.admin })).data?.data;
  for (let i = 0; i < 60 && sink.messages.length < 4; i++) await sleep(250);
  const subj = sink.messages.map(m => m.subject);
  check('announcement create notifies subscribers', subj.filter(s => /New Announcement/.test(s)).length === 2, 2, subj.filter(s => /New Announcement/.test(s)).length, 'POST /announcements');
  check('published event notifies subscribers', subj.filter(s => /Audit Notify Event/.test(s)).length === 2, 2, subj.filter(s => /Audit Notify Event/.test(s)).length, 'POST /events');
  check('draft event does not notify', !subj.some(s => /Draft No Notify/.test(s)), 'none', subj.filter(s => /Draft No Notify/.test(s)).length, 'POST /events');
  const am = sink.messages.find(m => /New Announcement/.test(m.subject));
  check('notification email escapes CMS markup', !!am && !/<script>x<\/script>/.test(am.html) && !/<i>Notice<\/i>/.test(am.html), 'escaped', (am?.html.match(/<h1[^>]*>([^<]*(?:<[^h][^>]*>[^<]*)*)<\/h1>/) || [])[1] || 'n/a', 'POST /announcements');
  for (const [p, x] of [['/announcements', na], ['/events', ne], ['/events', nd]]) if (x) await A('DELETE', `${p}/${x._id}`, { token: tok.admin });

  /* ══ CONTACT ══ */
  await budget(env, 80);
  setSuite('contact');
  const C = b => A('POST', '/contact', { json: b });
  const okBody = { name: 'Audit Sender', email: 'sender@example.test', subject: 'Audit question', message: 'Hello from the audit.' };
  sink.messages.length = 0;
  expectStatus('contact valid', 'POST /contact', keep(await C(okBody)), 200);
  for (const f of ['name', 'email', 'subject', 'message']) expectStatus(`contact missing ${f}`, 'POST /contact', keep(await C({ ...okBody, [f]: '' })), 400);
  expectStatus('contact whitespace-only', 'POST /contact', keep(await C({ ...okBody, name: '   ' })), 400);
  expectStatus('contact invalid email', 'POST /contact', keep(await C({ ...okBody, email: 'not-an-email' })), 400);
  expectStatus('contact non-string field', 'POST /contact', keep(await C({ ...okBody, message: { $gt: '' } })), 400);
  expectStatus('contact oversized message', 'POST /contact', keep(await C({ ...okBody, message: 'x'.repeat(20001) })), 400);
  const xss = { name: '<img src=x onerror=alert(1)>', email: 'x@example.test', subject: '<b>bold</b> subject', message: '"><script>alert(2)</script>\nline 2' };
  expectStatus('contact with HTML payload accepted', 'POST /contact', keep(await C(xss)), 200);
  expectStatus('contact header-injection in subject', 'POST /contact', keep(await C({ ...okBody, subject: 'Hi\r\nBcc: victim@example.test' })), [200, 400]);
  await sleep(500);
  const cm = sink.messages;
  check('contact email delivered to chapter inbox only', cm.length >= 3 && cm.every(m => m.to.length === 1 && m.to[0] === 'audit-inbox@example.test'), 'all to audit inbox, 1 rcpt', cm.map(m => m.to.join(',')).join(' | '), 'POST /contact');
  const xm = cm.find(m => /bold/.test(m.subject));
  check('contact email HTML escapes user input', !!xm && !/<img src=x/i.test(xm.html) && !/<script>/i.test(xm.html) && /&lt;img src=x/.test(xm.html), 'escaped', (xm?.html || '').match(/Name<\/td>\s*<td[^>]*>([^\n]*)<\/td>/)?.[1] || 'n/a', 'POST /contact');
  check('contact email: no injected Bcc recipient', !cm.some(m => m.to.includes('victim@example.test')), 'no victim rcpt', cm.flatMap(m => m.to).join(','), 'POST /contact');
  check('contact email: reply-to is the sender', cm.some(m => /^reply-to:.*sender@example\.test/im.test(m.headers)), 'Reply-To header', (cm[0]?.headers.match(/^reply-to:.*$/im) || ['none'])[0], 'POST /contact');
  // mail transport down → safe error, no internals
  await sink.close();
  const down = keep(await C(okBody));
  expectStatus('contact when mail server is down → 5xx without internals', 'POST /contact', down, [500, 502, 503], r => !/ECONNREFUSED|127\.0\.0\.1|smtp|at \w+ \(/i.test(r.text) || `exposed: ${r.text.slice(0, 90)}`);
  await sink.reopen();

  /* ══ SITE SETTINGS / DASHBOARD / UPDATES / MISC ══ */
  await budget(env, 80);
  setSuite('site-settings');
  expectStatus('public settings', 'GET /site-settings/public', keep(await A('GET', '/site-settings/public')), 200, r => (typeof r.data.data.socialLinks === 'object') || 'shape');
  expectStatus('admin settings anon', 'GET /site-settings', keep(await A('GET', '/site-settings')), 401);
  expectStatus('admin settings viewer', 'GET /site-settings', keep(await A('GET', '/site-settings', { token: tok.viewer })), 403);
  expectStatus('admin settings editor', 'GET /site-settings', keep(await A('GET', '/site-settings', { token: tok.editor })), 200);
  expectStatus('update settings anon', 'PATCH /site-settings', keep(await A('PATCH', '/site-settings', { json: { siteName: 'x' } })), 401);
  const ss = keep(await A('PATCH', '/site-settings', { json: { siteName: 'Audit Site', socialLinks: { linkedin: 'https://example.test/in' }, _id: BAD_ID }, token: tok.admin }));
  expectStatus('update settings db admin', 'PATCH /site-settings', ss, 200, r => r.data.data.siteName === 'Audit Site' || 'not saved');
  expectStatus('update settings built-in admin', 'PATCH /site-settings', keep(await A('PATCH', '/site-settings', { json: { footerText: 'Audit footer' }, token: tok.builtin })), 200);
  const sp = keep(await A('GET', '/site-settings/public'));
  check('public settings reflect update', sp.data?.data?.siteName === 'Audit Site' && sp.data?.data?.footerText === 'Audit footer', 'Audit Site / Audit footer', `${sp.data?.data?.siteName} / ${sp.data?.data?.footerText}`, 'GET /site-settings/public');
  check('public settings do not expose updatedBy (internal user id)', !('updatedBy' in (sp.data?.data || {})), 'absent', JSON.stringify(sp.data?.data?.updatedBy), 'GET /site-settings/public');
  expectStatus('branding with no files', 'PATCH /site-settings/branding', keep(await A('PATCH', '/site-settings/branding', { json: {}, token: tok.admin })), 400);
  expectStatus('branding anon', 'PATCH /site-settings/branding', keep(await A('PATCH', '/site-settings/branding', { json: {} })), 401);
  const fd = new FormData(); fd.append('logo', new Blob(['not an image'], { type: 'text/plain' }), 'logo.txt');
  expectStatus('branding rejects non-image file (400, no upload)', 'PATCH /site-settings/branding', keep(await A('PATCH', '/site-settings/branding', { body: fd, token: tok.admin })), 400);
  expectStatus('branding clear hero via text field', 'PATCH /site-settings/branding', keep(await A('PATCH', '/site-settings/branding', { json: { blogHeroImageUrl: '' }, token: tok.admin })), 200);

  setSuite('dashboard');
  expectStatus('stats anon', 'GET /dashboard/stats', keep(await A('GET', '/dashboard/stats')), 401);
  expectStatus('stats viewer', 'GET /dashboard/stats', keep(await A('GET', '/dashboard/stats', { token: tok.viewer })), 403);
  expectStatus('stats editor shape', 'GET /dashboard/stats', keep(await A('GET', '/dashboard/stats', { token: tok.editor })), 200, r => (Array.isArray(r.data.data.events.monthly) && r.data.data.events.monthly.length === 12 && Array.isArray(r.data.data.recentActivity)) || 'shape');

  setSuite('updates');
  const uPub = (await A('POST', '/blogs', { json: { title: 'Audit Update Pub', content: 'x', published: true, showInUpdates: true }, token: tok.admin })).data?.data;
  const uDraft = (await A('POST', '/blogs', { json: { title: 'AUDIT-DRAFT-update', content: 'x', published: false, showInUpdates: true }, token: tok.admin })).data?.data;
  const upd = keep(await A('GET', '/updates'));
  expectStatus('updates feed', 'GET /updates', upd, 200, r => (r.data.data.some(x => x.title === 'New Article: Audit Update Pub' && x.url === `post.html?id=${uPub?._id}`)) || 'published item missing/wrong url');
  check('updates feed excludes drafts', !upd.data?.data?.some(x => /AUDIT-DRAFT/.test(x.title)), 'absent', upd.data?.data?.filter(x => /AUDIT-DRAFT/.test(x.title)).length, 'GET /updates');
  for (const x of [uPub, uDraft]) if (x) await A('DELETE', `/blogs/${x._id}`, { token: tok.admin });

  setSuite('misc');
  expectStatus('health', 'GET /health', keep(await A('GET', '/health')), 200);
  expectStatus('unknown route 404 JSON', 'GET /nope', keep(await A('GET', '/does-not-exist')), 404, r => r.data?.success === false || 'not json');
  expectStatus('oversized JSON body → 413', 'POST /contact', keep(await A('POST', '/contact', { json: { ...okBody, message: 'x'.repeat(1_200_000) } })), 413);
  expectStatus('wrong content-type body ignored safely', 'POST /contact', keep(await A('POST', '/contact', { body: 'name=a', headers: { 'Content-Type': 'text/plain' } })), 400);
  const h = await A('GET', '/events');
  check('helmet: nosniff', h.headers.get('x-content-type-options') === 'nosniff', 'nosniff', h.headers.get('x-content-type-options'), 'GET /events');
  check('helmet: CSP present', !!h.headers.get('content-security-policy'), 'present', !!h.headers.get('content-security-policy'), 'GET /events');
  check('no X-Powered-By', !h.headers.get('x-powered-by'), 'absent', h.headers.get('x-powered-by'), 'GET /events');
  check('rate-limit headers', !!h.headers.get('ratelimit-policy'), 'present', h.headers.get('ratelimit-policy'), 'GET /events');
  // CORS
  const cors = async (origin, method = 'GET') => {
    const r = method === 'OPTIONS'
      ? await A('OPTIONS', '/contact', { headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,authorization' } })
      : await A('GET', '/events', { headers: { Origin: origin } });
    return { acao: r.headers.get('access-control-allow-origin'), acac: r.headers.get('access-control-allow-credentials'), status: r.status, acam: r.headers.get('access-control-allow-methods') };
  };
  const ce = await cors('https://evil.example');
  check('CORS: foreign origin not allowed', !ce.acao, 'no ACAO', ce.acao, 'GET /events');
  const cl = await cors('http://localhost:8765');
  check('CORS: local dev origin allowed with credentials', cl.acao === 'http://localhost:8765' && cl.acac === 'true', 'echo + credentials', `${cl.acao} ${cl.acac}`, 'GET /events');
  const cp = await cors('http://localhost:8765', 'OPTIONS');
  check('CORS: preflight 204 allows POST + Authorization', cp.status === 204 && /POST/.test(cp.acam || ''), '204 POST', `${cp.status} ${cp.acam}`, 'OPTIONS /contact');
  const cv = await cors('https://embs-website.vercel.app');
  check('CORS: production origin allowed with credentials', cv.acao === 'https://embs-website.vercel.app' && cv.acac === 'true', 'echo + credentials', `${cv.acao} ${cv.acac}`, 'GET /events');
  const cvp = await cors('https://embs-website.vercel.app', 'OPTIONS');
  check('CORS: production origin preflight allowed', cvp.status === 204 && cvp.acao === 'https://embs-website.vercel.app', '204 + ACAO', `${cvp.status} ${cvp.acao}`, 'OPTIONS /contact');
  for (const o of ['https://attacker-project.vercel.app', 'https://embs-website-evil.vercel.app', 'https://evil.netlify.app', 'https://embs-website.vercel.app.evil.example', 'http://embs-website.vercel.app']) {
    const r = await cors(o);
    check(`CORS: ${o} not allowed`, !r.acao, 'no ACAO', r.acao, 'GET /events');
  }
  const cc = await cors('http://localhost:8765');
  check('CORS: CLIENT_URL origin allowed', cc.acao === 'http://localhost:8765', 'allowed', cc.acao, 'GET /events');
  const cn = await cors('null');
  check('CORS: "null" origin rejected', !cn.acao, 'no ACAO', cn.acao, 'GET /events');

  /* ══ UPLOAD (Cloudinary, one disposable 1×1 PNG) ══ */
  await budget(env, 80);
  setSuite('upload');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const up1 = new FormData(); up1.append('title', 'Audit Upload'); up1.append('published', 'true'); up1.append('image', new Blob([png], { type: 'image/png' }), 'audit-pixel.png');
  const ur = keep(await A('POST', '/gallery', { body: up1, token: tok.admin, timeout: 60000 }));
  const url = ur.data?.data?.imageUrl || '';
  expectStatus('multipart image upload → Cloudinary URL stored', 'POST /gallery', ur, 201, () => /^https:\/\/res\.cloudinary\.com\//.test(url) || `url=${url}`);
  let uploadedPublicId = null;
  if (url) {
    uploadedPublicId = (url.match(/\/upload\/(?:[^/]+\/)*?v\d+\/(.+)\.[a-z0-9]+$/i) || [])[1] || null;
    const cdn = await (globalThis.fetch)(url, { method: 'GET' });
    check('uploaded image is served by the CDN', cdn.ok && /image\//.test(cdn.headers.get('content-type') || ''), '200 image/*', `${cdn.status} ${cdn.headers.get('content-type')}`, 'GET <cloudinary>');
    const pubList = keep(await A('GET', '/gallery'));
    check('uploaded record appears in public list with same URL', pubList.data?.data?.some(x => x.imageUrl === url), true, pubList.data?.data?.some(x => x.imageUrl === url), 'GET /gallery');
    await A('DELETE', `/gallery/${ur.data.data._id}`, { token: tok.admin });
  }
  const up2 = new FormData(); up2.append('title', 'Audit Bad File'); up2.append('image', new Blob(['<svg onload=alert(1)>'], { type: 'image/svg+xml' }), 'x.svg');
  expectStatus('upload rejects SVG/other types with 400', 'POST /gallery', keep(await A('POST', '/gallery', { body: up2, token: tok.admin })), 400);
  const up3 = new FormData(); up3.append('title', 'Audit No File');
  expectStatus('upload with no image and no imageUrl', 'POST /gallery', keep(await A('POST', '/gallery', { body: up3, token: tok.admin })), 400);
  const galleryLeft = (await A('GET', '/gallery?drafts=true', { token: tok.admin })).data?.data?.filter(x => /Audit (Bad|No) File/.test(x.title)).length;
  check('failed uploads leave no DB records', galleryLeft === 0, 0, galleryLeft, 'POST /gallery');
  if (uploadedPublicId) {
    const cloudinary = breq('cloudinary').v2;
    const fe = breq('dotenv').parse(fs.readFileSync(path.join(BACKEND, '.env')));
    cloudinary.config({ cloud_name: fe.CLOUDINARY_CLOUD_NAME, api_key: fe.CLOUDINARY_API_KEY, api_secret: fe.CLOUDINARY_API_SECRET });
    const del = await cloudinary.uploader.destroy(uploadedPublicId, { invalidate: true });
    check('disposable Cloudinary asset deleted', del.result === 'ok', 'ok', del.result + ' ' + uploadedPublicId, 'cloudinary destroy');
  }

  /* ══ SENSITIVE DATA scan over every audit response body ══ */
  setSuite('sensitive-data');
  const all = bodies.join('\n');
  const fe2 = breq('dotenv').parse(fs.readFileSync(path.join(BACKEND, '.env')));
  const leaks = {
    'password field': /"password"\s*:/.test(all),
    'bcrypt hash': /\$2[aby]\$\d{2}\$/.test(all),
    'JWT secret (test)': all.includes(env.secrets.JWT_SECRET),
    'ADMIN_PASSWORD (test)': all.includes(env.secrets.ADMIN_PASSWORD),
    'Mongo URI': /mongodb(\+srv)?:\/\//.test(all),
    'Cloudinary secret': !!fe2.CLOUDINARY_API_SECRET && all.includes(fe2.CLOUDINARY_API_SECRET),
    'stack trace': /\n\s+at [^\n]+:\d+:\d+/.test(all),
    'filesystem path': /[A-Z]:\\\\(Users|Program)|\/node_modules\//.test(all),
  };
  for (const [k, v] of Object.entries(leaks)) check(`no ${k} in any response`, !v, 'absent', v ? 'FOUND' : 'absent');

  /* ══ LOGIN RATE LIMIT (last: it locks failed logins for 15 min on this instance) ══ */
  setSuite('auth:rate-limit');
  let first429 = 0;
  for (let i = 1; i <= 12; i++) { const r = await login('admin@audit.test', 'wrong-' + i); if (r.status === 429 && !first429) first429 = i; }
  check('failed logins throttled after 10 attempts', first429 > 0 && first429 <= 11, '429 by attempt 11', first429 || 'never', 'POST /auth/login');
  return { tok };
}

/* Discover every route from backend/routes/*.js (for coverage reporting). */
export function discoverEndpoints() {
  const server = fs.readFileSync(path.join(BACKEND, 'server.js'), 'utf8');
  const mounts = {};
  for (const m of server.matchAll(/app\.use\('(\/api\/[^']+)',\s*(\w+)\)/g)) mounts[m[2]] = m[1];
  const req = {};
  for (const m of server.matchAll(/const (\w+)\s*=\s*require\('\.\/routes\/(\w+)'\)/g)) req[m[1]] = m[2];
  const out = [];
  for (const [v, file] of Object.entries(req)) {
    const src = fs.readFileSync(path.join(BACKEND, 'routes', file + '.js'), 'utf8');
    for (const m of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)) out.push(`${m[1].toUpperCase()} ${(mounts[v] + (m[2] === '/' ? '' : m[2])).replace(/^\/api/, '')}`);
  }
  out.push('GET /health');
  return out;
}
