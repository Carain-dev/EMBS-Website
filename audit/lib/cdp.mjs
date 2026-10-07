// Headless Chrome over the DevTools protocol, with the API interceptor.
// Every request the page makes to an API (localhost:5000, localhost:5055,
// *.onrender.com) is paused and decided here:
//   mode 'audit' → rewritten to the verified audit backend (:5055); mutations
//                  only if guard.mutationAllowed() says the target is proven
//   mode 'prod'  → GET/HEAD/OPTIONS continue to production; anything else fails
//   simulate     → a synthetic response (failure simulation), nothing is sent
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { mutationAllowed, SAFE } from './guard.mjs';
import { AUDIT_BASE } from './env.mjs';

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
export const SITE = 'http://localhost:8765';
const API_RE = /^(https?:\/\/(localhost|127\.0\.0\.1):(5000|5055)\/api|https:\/\/[^/]*onrender\.com\/api)/;

export class Browser {
  constructor({ out, mode = 'audit' }) { this.out = out; this.mode = mode; this.simulate = null; this.reset(); }

  reset() { this.logs = []; this.exceptions = []; this.failed = []; this.api = []; this.blocked = []; this.hosts = new Set(); this.forwarded = this.forwarded || 0; }

  async launch() {
    this.port = 9600 + Math.floor(Math.random() * 300);
    this.profile = path.join(this.out, `chrome-${process.pid}-${this.port}`);
    this.proc = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--no-first-run', '--disable-background-networking', '--autoplay-policy=no-user-gesture-required',
      `--remote-debugging-port=${this.port}`, `--user-data-dir=${this.profile}`, 'about:blank'], { stdio: 'ignore' });
    let t;
    for (let i = 0; i < 80 && !t; i++) { try { t = (await (await fetch(`http://127.0.0.1:${this.port}/json`)).json()).find(x => x.type === 'page'); } catch {} if (!t) await sleep(250); }
    if (!t) throw new Error('chrome did not start');
    this.ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise(r => (this.ws.onopen = r));
    this.id = 0; this.pend = {};
    this.ws.onmessage = m => this.onMessage(JSON.parse(m.data));
    this.ws.onclose = () => console.log('  [cdp] websocket closed');
    for (const d of ['Runtime', 'Log', 'Page', 'Network']) await this.send(`${d}.enable`);
    await this.send('Fetch.enable', { patterns: [{ urlPattern: '*://localhost:5000/api*' }, { urlPattern: '*://localhost:5055/api*' }, { urlPattern: '*://127.0.0.1:5000/api*' }, { urlPattern: '*onrender.com/*' }] });
    await this.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await this.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__xss=[];window.__x=function(t){window.__xss.push(String(t))};
      window.__cls=0;try{new PerformanceObserver(function(l){l.getEntries().forEach(function(e){if(!e.hadRecentInput)window.__cls+=e.value})}).observe({type:'layout-shift',buffered:true})}catch(e){}` });
    return this;
  }

  send(method, params = {}) {
    return new Promise(r => {
      const i = ++this.id;
      const to = setTimeout(() => { delete this.pend[i]; r({ error: { message: `CDP timeout: ${method}` } }); }, 45000);
      this.pend[i] = v => { clearTimeout(to); r(v); };
      try { this.ws.send(JSON.stringify({ id: i, method, params })); } catch (e) { clearTimeout(to); r({ error: { message: e.message } }); }
    });
  }

  async onMessage(d) {
    if (d.id && this.pend[d.id]) { this.pend[d.id](d.result || { error: d.error }); delete this.pend[d.id]; return; }
    const p = d.params || {};
    if (d.method === 'Runtime.exceptionThrown') { const ex = p.exceptionDetails; this.exceptions.push(String((ex.exception && ex.exception.description) || ex.text).split('\n')[0]); }
    if (d.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(p.type)) this.logs.push('console.' + p.type + ': ' + p.args.map(a => a.value ?? a.description).join(' ').slice(0, 200));
    if (d.method === 'Log.entryAdded' && p.entry.level === 'error') this.logs.push('log: ' + p.entry.text.slice(0, 160) + ' ' + (p.entry.url || ''));
    if (d.method === 'Network.requestWillBeSent') { try { this.hosts.add(new URL(p.request.url).host); } catch {} }
    if (d.method === 'Network.loadingFailed' && !/ERR_ABORTED|ERR_BLOCKED_BY_CLIENT/.test(p.errorText)) this.failed.push(`${p.errorText} ${p.blockedReason || ''} ${this.urlOf?.[p.requestId] || ''}`.trim());
    if (d.method === 'Network.responseReceived') {
      (this.urlOf ||= {})[p.requestId] = p.response.url;
      if (p.response.status >= 400) this.failed.push(`${p.response.status} ${p.response.url}`);
    }
    if (d.method === 'Fetch.requestPaused') return this.decide(p);
  }

  async decide(p) {
    const rq = p.request, M = rq.method.toUpperCase();
    const rel = rq.url.replace(API_RE, '');
    if (!API_RE.test(rq.url)) return this.send('Fetch.continueRequest', { requestId: p.requestId });
    const entry = { method: M, path: rel, status: 0 };
    if (M !== 'OPTIONS') this.api.push(entry);
    if (/onrender\.com/.test(rq.url) && this.mode !== 'prod') { this.blocked.push(`${M} ${rq.url} (production host during audit run)`); return this.send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'BlockedByClient' }); }
    if (this.simulate && M !== 'OPTIONS') {
      const s = typeof this.simulate === 'function' ? this.simulate(M, rel) : this.simulate;
      if (s) {
        entry.status = s.status ?? 0; entry.simulated = s.name;
        if (s.delay) await sleep(s.delay);
        if (s.network) return this.send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'InternetDisconnected' });
        if (!s.passthrough) {
          const origin = (rq.headers.Origin || rq.headers.origin || SITE);
          return this.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: s.status, responseHeaders: [
            { name: 'Content-Type', value: s.type || 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' }],
            body: Buffer.from(s.body ?? '').toString('base64') });
        }
      }
    }
    if (this.mode === 'prod') {
      if (!SAFE.has(M)) { this.blocked.push(`${M} ${rq.url} (read-only production run)`); return this.send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'BlockedByClient' }); }
      return this.send('Fetch.continueRequest', { requestId: p.requestId });
    }
    const target = AUDIT_BASE + rel;
    const d = mutationAllowed(target, M);
    if (!d.ok) { this.blocked.push(`${M} ${rq.url}: ${d.why}`); return this.send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'BlockedByClient' }); }
    this.forwarded++;
    return this.send('Fetch.continueRequest', { requestId: p.requestId, url: target });
  }

  async viewport(w, h, { mobile = w < 900, reduced = false } = {}) {
    await this.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
    await this.send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 0 });
    await this.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] });
  }

  async goto(url, { wait = 6000, settled } = {}) {
    this.reset();
    await this.send('Page.navigate', { url: url.startsWith('http') ? url : `${SITE}/${url}` });
    const t0 = Date.now();
    await sleep(800);
    while (Date.now() - t0 < wait) {
      if (settled && await this.eval(settled)) { await sleep(700); break; }
      await sleep(300);
    }
    if (!settled) { /* fixed wait */ }
    return Date.now() - t0;
  }

  async eval(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result ? r.result.value : undefined; }
  async shot(name) { const r = await this.send('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); fs.writeFileSync(path.join(this.out, 'shots', name + '.jpg'), Buffer.from(r.data, 'base64')); }
  async scrollThrough() { await this.eval(`(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));for(let y=0;y<document.documentElement.scrollHeight;y+=Math.round(innerHeight*0.7)){scrollTo(0,y);await s(160)}await s(400);scrollTo(0,0);await s(200);return 1})()`); }
  async close() { try { this.ws.close(); } catch {} try { this.proc.kill(); } catch {} await sleep(500); try { fs.rmSync(this.profile, { recursive: true, force: true }); } catch {} }
}
