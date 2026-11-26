// Mini serveur statique pour tester dist/ en local : node tools/serve.mjs [port]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const dir = path.resolve(new URL('../docs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const port = +process.argv[2] || 8765;
const types = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(dir, p); if (!f.startsWith(dir)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('404'); } res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d); });
}).listen(port, () => console.log('http://localhost:' + port));
