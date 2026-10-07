// Fail-closed request guard. Every HTTP request the audit makes goes through
// http(). Mutating methods are allowed ONLY to the verified audit backend.
// Production (local :5000 against the live DB, or Render) is GET/HEAD/OPTIONS only.
import { AUDIT_BASE, PROD_LOCAL_BASE, PROD_RENDER_BASE } from './env.mjs';

export const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
export const TARGETS = { audit: AUDIT_BASE, 'prod-local': PROD_LOCAL_BASE, 'prod-render': PROD_RENDER_BASE };
export class GuardError extends Error {}

const nativeFetch = globalThis.fetch.bind(globalThis);
let auditEnv = null;
export const journal = [];          // every request actually sent
export const refused = [];          // every request the guard blocked
export function bindAuditEnv(env) { auditEnv = env; }

/* The one decision function, also used by the browser interceptor. */
export function mutationAllowed(url, method) {
  const M = String(method || 'GET').toUpperCase();
  if (SAFE.has(M)) return { ok: true };
  let u; try { u = new URL(url); } catch { return { ok: false, why: 'unparseable URL' }; }
  if (!(u.hostname === 'localhost' && u.port === '5055' && u.pathname.startsWith('/api'))) return { ok: false, why: `mutation to non-audit target ${u.host}` };
  if (!auditEnv || !auditEnv.isLive()) return { ok: false, why: 'audit isolation not verified / backend not live' };
  return { ok: true };
}

function guardOrThrow(url, method, via) {
  const d = mutationAllowed(url, method);
  if (!d.ok) { refused.push({ via, method, url, why: d.why }); throw new GuardError(`GUARD REFUSED ${method} ${url}: ${d.why}`); }
}

/* Belt and braces: any stray fetch() in this process is guarded too. */
globalThis.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  const method = (init.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
  guardOrThrow(url, method, 'global-fetch');
  return nativeFetch(input, init);
};

/* http(target, method, path, { token, cookie, json, body, headers, timeout }) */
export async function http(target, method, path, o = {}) {
  const base = TARGETS[target];
  if (!base) throw new GuardError(`unknown target ${target}`);
  const M = method.toUpperCase();
  const url = base + path;
  guardOrThrow(url, M, 'http');
  const headers = { ...(o.headers || {}) };
  if (o.token) headers.Authorization = `Bearer ${o.token}`;
  if (o.cookie) headers.Cookie = o.cookie;
  let body = o.body;
  if (o.json !== undefined) { headers['Content-Type'] = 'application/json'; body = typeof o.json === 'string' ? o.json : JSON.stringify(o.json); }
  const t0 = Date.now();
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), o.timeout || 30000);
  let res, text = '', err = null;
  try { res = await nativeFetch(url, { method: M, headers, body, signal: ctl.signal, redirect: 'manual' }); text = M === 'HEAD' ? '' : await res.text(); }
  catch (e) { err = e.message; } finally { clearTimeout(to); }
  const ms = Date.now() - t0;
  let data = null; try { data = JSON.parse(text); } catch {}
  journal.push({ target, method: M, path, status: res ? res.status : 0, ms });
  return { status: res ? res.status : 0, headers: res ? res.headers : new Headers(), text, data, ms, err, setCookie: res ? res.headers.getSetCookie?.() || [] : [] };
}

export function prodMutationsSent() { return journal.filter(j => j.target !== 'audit' && !SAFE.has(j.method)).length; }
