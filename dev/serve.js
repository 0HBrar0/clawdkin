// Tiny static server for previewing the renderer in a browser: npm run preview, then open
// http://127.0.0.1:5251/dev/gallery.html (or /renderer/index.html; keys 1-5 switch state, a = a trick).
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const port = +process.argv[2] || 5251;
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' };
http.createServer((req, res) => {
  if (req.url.startsWith('/debug/')) {
    const d = path.join(require('../paths').DEBUG, path.basename(req.url.split('?')[0]));
    return fs.readFile(d, (err, data) => { res.writeHead(err ? 404 : 200, { 'Content-Type': 'image/png' }); res.end(data); });
  }
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'dev/gallery.html');
  if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`Clawdkin preview on http://127.0.0.1:${port}`));
