// Keep the original preview address on the current local application.
// Forwarding preserves this origin's offline queue and browser storage.
import http from 'node:http';
const target = 'http://127.0.0.1:3001';
http.createServer(async (req, res) => {
  if (!['127.0.0.1:3000', 'localhost:3000'].includes(req.headers.host)) { res.writeHead(403); res.end(); return; }
  if (req.headers.origin && !['http://127.0.0.1:3000', 'http://localhost:3000'].includes(req.headers.origin)) { res.writeHead(403); res.end(); return; }
  try {
    const chunks = []; let length = 0;
    for await (const chunk of req) { length += chunk.length; if (length > 1000000) { res.writeHead(413); res.end(); return; } chunks.push(chunk); }
    const headers = { ...req.headers };
    for (const key of ['host', 'connection', 'content-length', 'accept-encoding']) delete headers[key];
    if (headers.origin) headers.origin = target;
    const upstream = await fetch(target + req.url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks), redirect: 'manual' });
    const outgoing = Object.fromEntries(upstream.headers);
    for (const key of ['content-encoding', 'content-length', 'transfer-encoding']) delete outgoing[key];
    outgoing['cache-control'] = 'no-cache';
    res.writeHead(upstream.status, outgoing); res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch { res.writeHead(503); res.end('The local app is starting. Try again shortly.'); }
}).listen(3000, '127.0.0.1', () => console.log('Original local address ready: http://127.0.0.1:3000'));
