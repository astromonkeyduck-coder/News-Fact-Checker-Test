#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const zlib = require('zlib');

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, 'audit-artifacts');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: options.encoding || 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
}

function trackedFiles() {
  return git(['ls-files', '-z']).split('\0').filter(Boolean);
}

function parseTree() {
  const raw = git(['ls-tree', '-r', '-l', '-z', 'HEAD']);
  return raw.split('\0').filter(Boolean).map((entry) => {
    const tab = entry.indexOf('\t');
    const metadata = entry.slice(0, tab).trim().split(/\s+/);
    return {
      mode: metadata[0],
      type: metadata[1],
      sha: metadata[2],
      size: Number(metadata[3]) || 0,
      file: entry.slice(tab + 1),
    };
  });
}

const TEXT_EXTENSIONS = new Set([
  '.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.html', '.css', '.scss',
  '.json', '.toml', '.yml', '.yaml', '.md', '.txt', '.swift', '.sql',
  '.xml', '.plist', '.pbxproj', '.entitlements', '.sh', '.py', '.env.example',
]);

function isTextSource(file, size) {
  if (size > 5_000_000) return false;
  const ext = path.extname(file).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;
  return [
    'CNAME', 'Dockerfile', 'Makefile', 'Procfile', '.gitignore', '.npmrc',
    'robots.txt', 'ads.txt', 'site.webmanifest', 'package-lock.json', 'package.json',
  ].includes(path.basename(file));
}

function countLines(file) {
  try {
    const buffer = fs.readFileSync(path.join(ROOT, file));
    let lines = buffer.length ? 1 : 0;
    for (const byte of buffer) if (byte === 10) lines += 1;
    return lines;
  } catch {
    return 0;
  }
}

function writeSourceSnapshot(files, treeByPath) {
  // Store a gzip-compressed JSON map rather than invoking platform-specific zip
  // tooling. The artifact is deterministic, text-only, and easy to inspect.
  const snapshot = {
    generatedAt: new Date().toISOString(),
    head: git(['rev-parse', 'HEAD']).trim(),
    files: {},
  };

  for (const file of files) {
    const size = treeByPath.get(file)?.size || 0;
    if (!isTextSource(file, size)) continue;
    try {
      snapshot.files[file] = fs.readFileSync(path.join(ROOT, file), 'utf8');
    } catch {
      // Ignore files that disappear or cannot be decoded during the audit.
    }
  }

  const payload = Buffer.from(JSON.stringify(snapshot));
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'source-snapshot.json.gz'),
    zlib.gzipSync(payload, { level: 9 }),
  );
}

const files = trackedFiles();
const tree = parseTree();
const treeByPath = new Map(tree.map((entry) => [entry.file, entry]));
const topLevel = new Map();
const extensions = new Map();
const lineCounts = [];

for (const file of files) {
  const root = file.includes('/') ? file.split('/')[0] : '[root]';
  topLevel.set(root, (topLevel.get(root) || 0) + 1);

  const ext = path.extname(file).toLowerCase() || '[none]';
  extensions.set(ext, (extensions.get(ext) || 0) + 1);

  const size = treeByPath.get(file)?.size || 0;
  if (isTextSource(file, size)) {
    lineCounts.push({ file, lines: countLines(file), size });
  }
}

const byCount = (map) => [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const largestBlobs = [...tree].sort((a, b) => b.size - a.size).slice(0, 60);
const largestSources = [...lineCounts].sort((a, b) => b.lines - a.lines || b.size - a.size).slice(0, 60);

const report = [];
report.push(`head=${git(['rev-parse', 'HEAD']).trim()}`);
report.push(`tracked_files=${files.length}`);
report.push(`tracked_bytes=${tree.reduce((sum, entry) => sum + entry.size, 0)}`);
report.push('');
report.push('Top-level entries by tracked file count:');
for (const [name, count] of byCount(topLevel).slice(0, 40)) report.push(`${String(count).padStart(6)}  ${name}`);
report.push('');
report.push('Extensions:');
for (const [ext, count] of byCount(extensions).slice(0, 40)) report.push(`${String(count).padStart(6)}  ${ext}`);
report.push('');
report.push('Largest source/config files by line count:');
for (const entry of largestSources) report.push(`${String(entry.lines).padStart(8)}  ${String(entry.size).padStart(10)}  ${entry.file}`);
report.push('');
report.push('Largest tracked blobs in HEAD:');
for (const entry of largestBlobs) report.push(`${String(entry.size).padStart(12)}  ${entry.sha}  ${entry.file}`);
report.push('');

const reportText = `${report.join('\n')}\n`;
fs.writeFileSync(path.join(OUTPUT_DIR, 'inventory.txt'), reportText);
fs.writeFileSync(path.join(OUTPUT_DIR, 'inventory.json'), JSON.stringify({
  head: git(['rev-parse', 'HEAD']).trim(),
  trackedFiles: files.length,
  trackedBytes: tree.reduce((sum, entry) => sum + entry.size, 0),
  topLevel: Object.fromEntries(byCount(topLevel)),
  extensions: Object.fromEntries(byCount(extensions)),
  largestSources,
  largestBlobs,
}, null, 2));

writeSourceSnapshot(files, treeByPath);
process.stdout.write(reportText);
