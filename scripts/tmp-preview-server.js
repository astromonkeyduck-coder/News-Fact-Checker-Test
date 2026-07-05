/**
 * Temporary local preview server for redesign verification.
 * Serves the repo statically, mirrors the Netlify rewrites we care about,
 * and proxies /.netlify/functions/* and /media/video/* to production so
 * pages run against real data. Delete after use.
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PORT = 8899;
const PROD = 'noteworthynews.co';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

function proxy(req, res) {
  const options = {
    hostname: PROD,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: PROD },
  };
  const up = https.request(options, (upRes) => {
    res.writeHead(upRes.statusCode, upRes.headers);
    upRes.pipe(res);
  });
  up.on('error', (e) => {
    res.writeHead(502);
    res.end('proxy error: ' + e.message);
  });
  req.pipe(up);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let p = decodeURIComponent(url.pathname);

  if (p.startsWith('/.netlify/functions/') || p.startsWith('/media/video/')) {
    return proxy(req, res);
  }
  if (p === '/') p = '/v2/index.html';
  if (p.startsWith('/story/')) p = '/story.html';
  if (p === '/article') p = '/article.html';
  if (p === '/favicon.ico') p = '/IMG_5794.PNG';

  const filePath = path.join(ROOT, p);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('forbidden');
  }
  serveFile(res, filePath);
}).listen(PORT, () => {
  console.log('preview server on http://localhost:' + PORT);
});
