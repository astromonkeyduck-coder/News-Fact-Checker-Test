#!/usr/bin/env node
'use strict';

/**
 * Localhost WebM → MP4 converter for the Chrome clip extension.
 * Run: npm run clip:convert-server
 */

const http = require('http');
const {
  convertWebmChunksToMp4Buffer,
  ffmpegPath,
  hasWebmHeader,
} = require('./lib/convert-webm-chunks');

const PORT = Number(process.env.CLIP_CONVERT_PORT || 39284);
const HOST = '127.0.0.1';
const MAX_BODY = 120 * 1024 * 1024;

function checkExistingServer() {
  return new Promise((resolve) => {
    const req = http.get(`http://${HOST}:${PORT}/health`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(res.statusCode === 200 && JSON.parse(body).ok === true);
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function readBody(req, { json = false } = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      if (!json) {
        resolve(buf);
        return;
      }
      try {
        resolve(JSON.parse(buf.toString('utf8')));
      } catch (err) {
        reject(new Error(`Invalid JSON: ${err.message}`));
      }
    });

    req.on('error', reject);
  });
}

function readJsonBody(req) {
  return readBody(req, { json: true });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Filename',
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Filename, X-Trim-Seconds');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true, ffmpeg: ffmpegPath, port: PORT });
    return;
  }

  if (req.method === 'POST' && req.url === '/convert') {
    try {
      const body = await readJsonBody(req);
      const chunks = Array.isArray(body.webmChunksBase64) ? body.webmChunksBase64.filter(Boolean) : [];
      if (!body.webmBase64 && chunks.length === 0) {
        sendJson(res, 400, { ok: false, error: 'Missing webmChunksBase64' });
        return;
      }
      const mp4 = convertWebmChunksToMp4Buffer(body.webmBase64, chunks.length ? chunks : body.webmChunksBase64);
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(mp4);
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err.message || String(err) });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/convert/raw') {
    try {
      const webm = await readBody(req);
      if (!webm || webm.length === 0) {
        sendJson(res, 400, { ok: false, error: 'Missing WebM body' });
        return;
      }
      if (!hasWebmHeader(webm)) {
        sendJson(res, 400, { ok: false, error: 'Invalid WebM capture (missing header).' });
        return;
      }
      const mp4 = convertWebmChunksToMp4Buffer(null, [webm.toString('base64')], {
        trimSeconds: Number(req.headers['x-trim-seconds']) || 0,
      });
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(mp4);
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err.message || String(err) });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: 'Not found' });
});

server.on('error', async (err) => {
  if (err.code === 'EADDRINUSE') {
    if (await checkExistingServer()) {
      console.log(`[clip:convert-server] Already running at http://${HOST}:${PORT}`);
      console.log('[clip:convert-server] No need to start another copy — use the extension now.');
      process.exit(0);
    }
    console.error(`[clip:convert-server] Port ${PORT} is in use by another process.`);
    console.error(`[clip:convert-server] Free it with: lsof -i :${PORT}   then kill the PID,`);
    console.error(`[clip:convert-server] or use another port: CLIP_CONVERT_PORT=39285 npm run clip:convert-server`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log(`[clip:convert-server] http://${HOST}:${PORT} (ffmpeg: ${ffmpegPath})`);
  console.log('[clip:convert-server] Leave this running while using the YouTube clip extension.');
});
