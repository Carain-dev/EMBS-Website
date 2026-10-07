// Audit runner.
//   node audit/run.mjs                 → guard self-test + isolated API suite + browser suite + production read-only suite
//   node audit/run.mjs api             → isolated API suite only
//   node audit/run.mjs browser         → isolated browser suite only
//   node audit/run.mjs prod            → production read-only (GET/HEAD/OPTIONS) suite only
// Mutations only ever reach the isolated backend (:5055 / embs-audit-tmp); see lib/guard.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { AuditEnv, mongoose, AUDIT_DB, ROOT } from './lib/env.mjs';
import { http, bindAuditEnv, GuardError, refused, journal, prodMutationsSent } from './lib/guard.mjs';
import { startSmtpSink } from './lib/smtp-sink.mjs';
import { results, setSuite, check, summary } from './lib/report.mjs';
import { runApiSuite, discoverEndpoints } from './api-suite.mjs';

const OUT = path.join(ROOT, 'audit', 'out');
process.on('exit', c => { if (!globalThis.__reported) console.log(`!! process exiting early (code ${c}) — an awaited step never settled`); });
process.on('unhandledRejection', e => console.log('!! unhandled rejection:', e && e.message));
fs.mkdirSync(OUT, { recursive: true });
const want = new Set(process.argv.slice(2));
const all = want.size === 0;
const SMTP_PORT = 2526;

async function guardSelfTest(env) {
  setSuite('guard');
  const before = journal.length;
  const attempts = [
    ['prod-local', 'POST', '/contact'], ['prod-local', 'DELETE', '/newsletter/unsubscribe'],
    ['prod-render', 'PATCH', '/site-settings'], ['prod-render', 'PUT', '/events/x'],
  ];
  for (const [t, m, p] of attempts) {
    let blocked = false;
    try { await http(t, m, p, { json: {} }); } catch (e) { blocked = e instanceof GuardError; }
    check(`refuses ${m} to ${t}`, blocked, 'refused before sending', blocked ? 'refused' : 'SENT');
  }
  let g = false; try { await fetch('https://embs-website-b3de.onrender.com/api/contact', { method: 'POST' }); } catch (e) { g = e instanceof GuardError; }
  check('global fetch refuses production POST', g, 'refused', g ? 'refused' : 'SENT');
  if (env) {
    const was = env.verified; env.verified = false;
    let b = false; try { await http('audit', 'POST', '/contact', { json: {} }); } catch (e) { b = e instanceof GuardError; }
    env.verified = was;
    check('refuses audit mutation when isolation is not verified', b, 'refused', b ? 'refused' : 'SENT');
  }
  check('no request was sent by the refused attempts', journal.length === before, 0, journal.length - before);
}

let env = null, sink = null;
try {
  if (all || want.has('api') || want.has('browser')) {
    sink = await startSmtpSink(SMTP_PORT);
    env = new AuditEnv({ smtpPort: SMTP_PORT, logFile: path.join(OUT, 'backend-audit.log') });
    bindAuditEnv(env);
    await guardSelfTest(null);
    await env.start();
    setSuite('isolation');
    for (const [k, v] of Object.entries(env.proof)) check(`isolation proof: ${k}`, v, true, v);
    await guardSelfTest(env);
    // start from a clean database (only ever the verified audit DB)
    await env.dbWrite(() => { if (mongoose.connection.name !== AUDIT_DB) throw new Error('not audit db'); return mongoose.connection.dropDatabase(); });
    await env.restart();
  } else {
    await guardSelfTest(null);
  }

  if (all || want.has('api')) {
    console.log('== isolated API suite');
    await runApiSuite({ env, sink });
  }
  if (all || want.has('browser')) {
    console.log('== isolated browser suite');
    const { runBrowserSuite } = await import('./browser-suite.mjs');
    await runBrowserSuite({ env, sink, out: OUT });
  }
  if (all || want.has('prod')) {
    console.log('== production read-only suite');
    const { runProdSuite } = await import('./prod-readonly-suite.mjs');
    await runProdSuite({ out: OUT });
  }
} catch (e) {
  console.error('RUN ABORTED:', e.message);
  results.push({ suite: 'runner', name: 'run completed', pass: false, expected: 'no abort', actual: e.message.slice(0, 200) });
} finally {
  if (env) { try { await env.teardown(); } catch (e) { console.error('teardown:', e.message); } }
  if (sink) await sink.close();
}

/* ── report ── */
setSuite('safety');
check('zero mutation requests sent to production', prodMutationsSent() === 0, 0, prodMutationsSent());
const discovered = discoverEndpoints();
const tested = new Set(results.filter(r => r.method).map(r => `${r.method} ${r.endpoint}`));
const untested = discovered.filter(e => !tested.has(e));
const bySuite = {};
for (const r of results) { const k = r.suite.split(':')[0]; (bySuite[k] ||= { passed: 0, failed: 0 }); r.pass ? bySuite[k].passed++ : bySuite[k].failed++; }
const report = {
  when: new Date().toISOString(), summary: summary(), bySuite,
  endpoints: { discovered: discovered.length, tested: discovered.length - untested.length, untested },
  requests: { total: journal.length, audit: journal.filter(j => j.target === 'audit').length, prodGetOnly: journal.filter(j => j.target !== 'audit').length, prodMutations: prodMutationsSent(), refusedByGuard: refused.length },
  failures: results.filter(r => !r.pass), results,
};
const tag = all ? 'full' : [...want].join('-');
fs.writeFileSync(path.join(OUT, `report-${tag}.json`), JSON.stringify(report, null, 1));
console.log('\n== SUMMARY', JSON.stringify(report.summary), 'endpoints', `${report.endpoints.tested}/${report.endpoints.discovered}`, 'untested:', untested.join(', ') || 'none');
console.log('requests', JSON.stringify(report.requests));
console.log('by suite', JSON.stringify(bySuite));
globalThis.__reported = true;
process.exit(report.summary.failed ? 1 : 0);
