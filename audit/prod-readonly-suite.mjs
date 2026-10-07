// Production READ-ONLY suite: GET / HEAD / OPTIONS only (the guard refuses
// anything else before it is sent). Runs against:
//   prod-local  — localhost:5000 (current backend code, live database)
//   prod-render — the deployed Render API (whatever code is deployed now)
import { http } from './lib/guard.mjs';
import { setSuite, check, expectStatus, record } from './lib/report.mjs';

const PUBLIC_LISTS = ['/events', '/podcasts', '/blogs', '/members', '/achievements', '/announcements', '/gallery', '/projects', '/timeline', '/documents', '/documents/public', '/updates', '/members?orgchart=true', '/members?advisor=true', '/members?faculty=true'];
const LEAK_TYPES = ['/events', '/podcasts', '/blogs', '/members', '/achievements', '/gallery', '/projects', '/timeline', '/documents'];
const BAD_ID = '64b000000000000000000000';

export async function runProdSuite() {
  for (const target of ['prod-local', 'prod-render']) {
    const G = (p, o) => http(target, 'GET', p, { timeout: 70000, ...o });
    setSuite(`prod:${target}`);
    const h = await G('/health');
    if (h.status !== 200) { record('health', { endpoint: '/health', method: 'GET', expected: 200, actual: h.status || h.err, pass: false, note: 'target unreachable; skipped' }); continue; }
    expectStatus('health', 'GET /health', h, 200);
    const sets = {};
    for (const p of PUBLIC_LISTS) {
      const r = await G(p);
      expectStatus(`public list ${p}`, `GET ${p.split('?')[0]}`, r, 200, x => Array.isArray(x.data?.data) || 'data not an array');
      sets[p] = new Set((r.data?.data || []).map(x => x._id));
      if (r.ms > 3000) record(`slow response ${p}`, { endpoint: p, method: 'GET', expected: '<3000ms', actual: r.ms + 'ms', pass: true, note: 'Render cold start likely' });
    }
    const s = await G('/site-settings/public');
    expectStatus('public settings', 'GET /site-settings/public', s, 200, x => typeof x.data?.data?.socialLinks === 'object' || 'shape');
    check('public settings: no updatedBy', !('updatedBy' in (s.data?.data || {})), 'absent', JSON.stringify(s.data?.data?.updatedBy), 'GET /site-settings/public');

    // drafts never exposed: admin-looking variants must not return ids beyond the public set
    for (const p of LEAK_TYPES) {
      for (const [label, q, o] of [['?all=true', '?all=true', {}], ['?drafts=true', '?drafts=true', {}], ['fake Bearer', '', { token: 'x' }]]) {
        const r = await G(p + q, o);
        const extra = (r.data?.data || []).filter(x => !sets[p].has(x._id)).length;
        check(`no draft leak ${p} ${label}`, [200, 401, 403].includes(r.status) && extra === 0, '0 extra records (or 401)', `${r.status}, ${extra} extra`, `GET ${p}`);
      }
    }
    // read every public record by id; malformed / unknown ids are safe errors
    for (const p of ['/events', '/podcasts', '/blogs', '/projects', '/gallery', '/achievements', '/announcements', '/members', '/timeline', '/documents']) {
      const first = [...(sets[p] || [])][0];
      if (first) expectStatus(`read public record by id ${p}`, `GET ${p}/:id`, await G(`${p}/${first}`), 200, x => x.data?.data?._id === first || 'wrong record');
      expectStatus(`malformed id ${p}`, `GET ${p}/:id`, await G(`${p}/not-an-id`), 400);
      expectStatus(`unknown id ${p}`, `GET ${p}/:id`, await G(`${p}/${BAD_ID}`), 404);
    }
    const g = await G('/gallery?event=notanid');
    expectStatus('gallery ?event=<malformed> → 400, no DB internals', 'GET /gallery', g, 400, x => !/Cast to|model "/.test(x.text) || 'internal error exposed');
    expectStatus('unknown route', 'GET /nope', await G('/no-such-route'), 404);
    expectStatus('auth-protected GET without token', 'GET /dashboard/stats', await G('/dashboard/stats'), 401);
    expectStatus('newsletter list without token', 'GET /newsletter', await G('/newsletter'), 401);
    expectStatus('auth/me with garbage token', 'GET /auth/me', await G('/auth/me', { token: 'x' }), 401);

    // sensitive data in public responses
    const texts = [];
    for (const p of PUBLIC_LISTS) texts.push((await G(p)).text);
    texts.push(s.text);
    const all = texts.join('\n');
    check('no password/bcrypt/secrets in public responses', !/"password"\s*:|\$2[aby]\$\d{2}\$|mongodb(\+srv)?:\/\/|api_secret/i.test(all), 'absent', 'checked ' + texts.length + ' responses');
    // headers + CORS (GET / OPTIONS only)
    const hh = await G('/events', { headers: { Origin: 'https://evil.example' } });
    check('CORS: foreign origin gets no ACAO', !hh.headers.get('access-control-allow-origin'), 'none', hh.headers.get('access-control-allow-origin'), 'GET /events');
    check('helmet headers present', hh.headers.get('x-content-type-options') === 'nosniff' && !!hh.headers.get('strict-transport-security'), 'nosniff + HSTS', `${hh.headers.get('x-content-type-options')} ${!!hh.headers.get('strict-transport-security')}`, 'GET /events');
    const pre = await http(target, 'OPTIONS', '/contact', { headers: { Origin: 'http://localhost:8765', 'Access-Control-Request-Method': 'POST' } });
    check('CORS preflight answers (OPTIONS only, nothing posted)', [204, 200].includes(pre.status), '204', pre.status, 'OPTIONS /contact');
    const vx = await G('/events', { headers: { Origin: 'https://any-attacker-project.vercel.app' } });
    record('CORS: arbitrary *.vercel.app origin', { endpoint: '/events', method: 'GET', expected: 'info', actual: `${vx.headers.get('access-control-allow-origin') || 'not allowed'} credentials=${vx.headers.get('access-control-allow-credentials')}`, pass: true, note: 'see report: wildcard suffix + credentials' });
  }
}
