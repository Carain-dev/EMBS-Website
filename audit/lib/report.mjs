// Tiny result collector shared by the suites.
export const results = [];
let suite = '';
export const setSuite = s => { suite = s; console.log(`  · ${s}`); };
export function record(name, { endpoint = '', method = '', expected = '', actual = '', pass, note = '' }) {
  results.push({ suite, name, endpoint, method, expected: String(expected), actual: String(actual), pass: !!pass, note });
  if (!pass) console.log(`  FAIL [${suite}] ${name} — expected ${expected}, got ${actual}${note ? ' (' + note + ')' : ''}`);
}
/* expectStatus(name, endpoint, response, expectedStatus|[...], extraPredicate?) */
export function expectStatus(name, endpoint, r, want, extra) {
  const ok = [].concat(want).includes(r.status);
  let pass = ok, note = '';
  if (ok && extra) { const e = extra(r); if (e !== true) { pass = false; note = e || 'predicate failed'; } }
  const [method, ...p] = endpoint.split(' ');
  record(name, { endpoint: p.join(' '), method, expected: [].concat(want).join('|'), actual: r.status + (r.data && r.data.message && !ok ? ' ' + String(r.data.message).slice(0, 80) : ''), pass, note });
  return pass;
}
export function check(name, cond, expected, actual, endpoint = '') {
  const [method, ...p] = endpoint.split(' ');
  record(name, { endpoint: p.join(' '), method, expected, actual, pass: cond });
  return cond;
}
export function summary(filter = () => true) {
  const r = results.filter(filter);
  return { total: r.length, passed: r.filter(x => x.pass).length, failed: r.filter(x => !x.pass).length };
}
