// Minimal local SMTP server. The audit backend's EMAIL_HOST points here, so
// no email ever leaves the machine. Captured messages are decoded for checks.
import net from 'node:net';

const qp = s => s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
const utf8 = s => Buffer.from(s, 'latin1').toString('utf8');

function decodePart(headers, body) {
  const enc = (headers.match(/content-transfer-encoding:\s*([^\s;]+)/i) || [])[1] || '';
  if (/base64/i.test(enc)) return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
  if (/quoted-printable/i.test(enc)) return utf8(qp(body));
  return body;
}

export function parseMime(raw) {
  const [head, ...rest] = raw.split(/\r?\n\r?\n/);
  const body = rest.join('\r\n\r\n');
  const rawSubject = ((head.match(/^subject:\s*(.*(?:\r?\n[ \t].*)*)/im) || [])[1] || '').replace(/\r?\n[ \t]/g, ' ');
  // RFC 2047 encoded-words (=?UTF-8?B?...?= / =?UTF-8?Q?...?=)
  const subject = rawSubject.replace(/\?=\s+=\?/g, '?==?').replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (_, cs, enc, txt) =>
    enc.toUpperCase() === 'B' ? Buffer.from(txt, 'base64').toString('utf8') : utf8(qp(txt.replace(/_/g, ' '))));
  const out = { headers: head, subject, html: '', text: '' };
  const b = (head.match(/boundary="?([^";\r\n]+)"?/i) || [])[1];
  const parts = b ? body.split('--' + b).slice(1, -1) : [head + '\r\n\r\n' + body];
  for (const p of parts) {
    const [ph, ...pb] = p.replace(/^\r?\n/, '').split(/\r?\n\r?\n/);
    const content = decodePart(ph, pb.join('\r\n\r\n'));
    if (/content-type:\s*text\/html/i.test(ph)) out.html += content;
    else if (/content-type:\s*text\/plain/i.test(ph)) out.text += content;
  }
  return out;
}

export async function startSmtpSink(port) {
  const messages = [];
  const make = () => net.createServer(sock => {
    let buf = '', inData = false, cur = null, authStep = 0;
    const say = l => sock.write(l + '\r\n');
    say('220 audit-sink ESMTP');
    sock.on('data', chunk => {
      buf += chunk.toString('latin1');
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        if (inData) {
          const end = buf.indexOf('\r\n.\r\n');
          if (end < 0 && !buf.startsWith('.\r\n')) return;
          const raw = buf.startsWith('.\r\n') ? '' : buf.slice(0, end);
          buf = buf.slice(buf.startsWith('.\r\n') ? 3 : end + 5);
          inData = false; cur.raw = raw.replace(/\r\n\.\./g, '\r\n.');
          Object.assign(cur, parseMime(cur.raw)); messages.push(cur); cur = null;
          say('250 OK queued'); continue;
        }
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (authStep === 1) { authStep = 2; say('334 UGFzc3dvcmQ6'); continue; }
        if (authStep === 2) { authStep = 0; say('235 Authentication successful'); continue; }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO') { sock.write('250-audit-sink\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n'); }
        else if (cmd === 'HELO') say('250 audit-sink');
        else if (cmd === 'AUTH') { if (/^AUTH LOGIN/i.test(line)) { authStep = 1; say('334 VXNlcm5hbWU6'); } else say('235 Authentication successful'); }
        else if (cmd === 'MAIL') { cur = { from: (line.match(/<([^>]*)>/) || [])[1], to: [] }; say('250 OK'); }
        else if (cmd === 'RCPT') { cur && cur.to.push((line.match(/<([^>]*)>/) || [])[1]); say('250 OK'); }
        else if (cmd === 'DATA') { inData = true; say('354 End data with <CR><LF>.<CR><LF>'); }
        else if (cmd === 'RSET') { cur = null; say('250 OK'); }
        else if (cmd === 'NOOP') say('250 OK');
        else if (cmd === 'QUIT') { say('221 Bye'); sock.end(); }
        else say('250 OK');
      }
    });
    sock.on('error', () => {});
  });
  let server = null;
  const sockets = new Set();
  const listen = () => new Promise((res, rej) => {
    server = make();
    server.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
    server.once('error', rej);
    server.listen(port, '127.0.0.1', res);
  });
  await listen();
  return {
    messages,
    close: () => new Promise(r => { for (const s of sockets) s.destroy(); server.close(() => r()); }),
    reopen: listen,
  };
}
