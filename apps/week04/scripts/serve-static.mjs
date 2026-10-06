import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, process.argv[3] || '../www/pku-aihis/week04');
const port = Number(process.argv[2] || 8769);
const types = {'.pdf':'application/pdf','.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.dat':'application/octet-stream','.svg':'image/svg+xml'};
// Intentional Pages-style subpath and no COOP/COEP headers.
http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (!pathname.startsWith('/week04/')) {response.writeHead(404); response.end('Use /week04/'); return;}
    const relative = decodeURIComponent(pathname.slice('/week04/'.length)) || 'index.html';
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep)) {response.writeHead(403); response.end(); return;}
    const bytes = await fs.readFile(target);
    response.writeHead(200, {'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control':'no-cache'});
    response.end(bytes);
  } catch {response.writeHead(404); response.end('Not found');}
}).listen(port, '127.0.0.1', () => console.log(`Static verification: http://127.0.0.1:${port}/week04/ (no isolation headers)`));
