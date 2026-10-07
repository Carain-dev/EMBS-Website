// Isolated audit environment: starts backend/server.js on port 5055 against
// the throwaway database `embs-audit-tmp`, with test-only secrets and a local
// fake SMTP server, then PROVES the isolation before anything may mutate.
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const BACKEND = path.join(ROOT, 'backend');
export const breq = createRequire(path.join(BACKEND, 'package.json'));
export const mongoose = breq('mongoose');
export const jwt = breq('jsonwebtoken');
const dotenv = breq('dotenv');

export const AUDIT_PORT = 5055;
export const AUDIT_DB = 'embs-audit-tmp';
export const PROD_DB = 'embs-kpriet';
export const AUDIT_BASE = `http://localhost:${AUDIT_PORT}/api`;
export const PROD_LOCAL_BASE = 'http://localhost:5000/api';
export const PROD_RENDER_BASE = 'https://embs-website-b3de.onrender.com/api';

const fileEnv = () => dotenv.parse(fs.readFileSync(path.join(BACKEND, '.env')));

/* Same cluster + credentials as .env, but the database path swapped to the
   throwaway one. Throws rather than guessing if the URI shape is unexpected. */
export function auditMongoUri() {
  const u = fileEnv().MONGO_URI || '';
  const m = u.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)\/([^?]*)(\?.*)?$/);
  if (!m) throw new Error('ENV GUARD: cannot parse MONGO_URI; refusing to start audit backend');
  const out = `${m[1]}/${AUDIT_DB}${m[3] || ''}`;
  if (out.includes(`/${PROD_DB}`) || !out.includes(`/${AUDIT_DB}`)) throw new Error('ENV GUARD: audit URI not isolated');
  return out;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const realFetch = globalThis.fetch.bind(globalThis);

function listenerPid(port) {
  try {
    const out = execFileSync('powershell', ['-NoProfile', '-Command',
      `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess`], { encoding: 'utf8' });
    return parseInt(out.trim(), 10) || null;
  } catch { return null; }
}

export class AuditEnv {
  constructor({ smtpPort, logFile }) {
    this.smtpPort = smtpPort; this.logFile = logFile;
    this.verified = false; this.child = null; this.proof = null;
    this.secrets = { JWT_SECRET: crypto.randomBytes(32).toString('hex'), ADMIN_PASSWORD: 'audit-' + crypto.randomBytes(9).toString('hex') };
  }

  async start() {
    if (listenerPid(AUDIT_PORT)) throw new Error(`ENV GUARD: port ${AUDIT_PORT} already in use by another process; refusing`);
    const fe = fileEnv();
    const env = {
      ...process.env,
      // Cloudinary stays real (only the explicit disposable-upload test uses it).
      CLOUDINARY_CLOUD_NAME: fe.CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY: fe.CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET: fe.CLOUDINARY_API_SECRET,
      MONGO_URI: auditMongoUri(),
      PORT: String(AUDIT_PORT),
      NODE_ENV: 'audit',
      JWT_SECRET: this.secrets.JWT_SECRET,
      ADMIN_PASSWORD: this.secrets.ADMIN_PASSWORD,
      EMAIL_HOST: '127.0.0.1', EMAIL_PORT: String(this.smtpPort),
      EMAIL_USER: 'audit-inbox@example.test', EMAIL_PASS: 'audit', EMAIL_TO: 'audit-inbox@example.test',
      CLIENT_URL: 'http://localhost:8765',
      AUDIT_ENV: 'embs-audit-tmp',
    };
    this.childEnv = env;
    const log = fs.openSync(this.logFile, 'a');
    const child = spawn(process.execPath, ['server.js'], { cwd: BACKEND, env, stdio: ['ignore', log, log] });
    this.child = child; this.exited = false;
    child.on('exit', () => { if (this.child === child) { this.verified = false; this.exited = true; } });
    for (let i = 0; i < 80; i++) {
      try { if ((await realFetch(`${AUDIT_BASE}/health`)).ok) break; } catch {}
      if (this.exited) throw new Error('audit backend exited during startup (see log)');
      await sleep(500);
    }
    await this.verify();
    return this;
  }

  /* All five checks must pass or nothing may mutate. */
  async verify() {
    this.verified = false;
    const checks = {};
    // 1. port is 5055 and owned by the child we spawned
    checks.port = listenerPid(AUDIT_PORT) === this.child.pid;
    // 2/4. database is embs-audit-tmp, production URI not active in the child
    checks.childUri = this.childEnv.MONGO_URI.includes(`/${AUDIT_DB}?`) && !this.childEnv.MONGO_URI.includes(`/${PROD_DB}`);
    // direct DB connection (used for seeding) must be the audit DB
    if (mongoose.connection.readyState !== 1) await mongoose.connect(auditMongoUri());
    checks.dbName = mongoose.connection.name === AUDIT_DB;
    // canary written to embs-audit-tmp must be visible through :5055 and NOT through :5000
    const nonce = 'audit-canary-' + crypto.randomBytes(6).toString('hex');
    const TL = breq('./models/TimelineEntry');
    if (checks.dbName) await TL.create({ year: '1900', title: nonce, active: true });
    const seen = async base => { try { const r = await realFetch(`${base}/timeline`); return (await r.text()).includes(nonce); } catch { return false; } };
    checks.canaryOnAudit = checks.dbName && await seen(AUDIT_BASE);
    checks.canaryAbsentOnProd = !(await seen(PROD_LOCAL_BASE));
    if (checks.dbName) await TL.deleteMany({ title: nonce });
    // 3. test secrets loaded: a token signed with the per-run test secret is accepted
    const tok = jwt.sign({ id: 'admin', role: 'admin' }, this.secrets.JWT_SECRET, { expiresIn: '5m' });
    try { checks.testSecrets = (await realFetch(`${AUDIT_BASE}/dashboard/stats`, { headers: { Authorization: `Bearer ${tok}` } })).status === 200; } catch { checks.testSecrets = false; }
    // 5. mutation target constant is the audit API, never a production base
    checks.target = AUDIT_BASE !== PROD_LOCAL_BASE && AUDIT_BASE !== PROD_RENDER_BASE && new URL(AUDIT_BASE).port === String(AUDIT_PORT);
    this.proof = checks;
    this.verified = Object.values(checks).every(Boolean);
    if (!this.verified) throw new Error('ENV GUARD: isolation NOT proven, mutations disabled: ' + JSON.stringify(checks));
    return checks;
  }

  isLive() { return this.verified && this.child && !this.exited && this.child.exitCode === null; }

  /* Direct DB writes (seeding) only through here. */
  async dbWrite(fn) {
    if (!this.isLive() || mongoose.connection.name !== AUDIT_DB) throw new Error('ENV GUARD: refusing DB write, connection is not ' + AUDIT_DB);
    return fn();
  }

  token(payload, opts = { expiresIn: '1h' }) { return jwt.sign(payload, this.secrets.JWT_SECRET, opts); }

  async restart() { await this.stopServer(); await this.start(); }

  async stopServer() {
    this.verified = false;
    const c = this.child; this.child = null;
    if (c && c.exitCode === null) {
      await new Promise(r => { c.once('exit', r); c.kill(); });
      for (let i = 0; i < 40 && listenerPid(AUDIT_PORT); i++) await sleep(250);
    }
  }

  async teardown() {
    await this.stopServer();
    if (mongoose.connection.readyState === 1) {
      if (mongoose.connection.name !== AUDIT_DB) throw new Error('ENV GUARD: refusing to drop non-audit DB');
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
}
