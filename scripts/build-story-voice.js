'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const webpack = require('webpack');
const root = path.resolve(__dirname, '..');
const sdkRoot = path.dirname(path.dirname(require.resolve('@elevenlabs/client')));
const sdk = JSON.parse(fs.readFileSync(path.join(sdkRoot, 'package.json'), 'utf8'));
if (sdk.version !== '1.25.0') throw new Error('Review the voice adapter before changing its pinned ElevenLabs SDK.');
const output = path.join(root, 'publication/vendor');
fs.mkdirSync(output, { recursive: true });
const filename = `elevenlabs-client-${sdk.version}.min.js`;
webpack({
  mode: 'production', target: ['web', 'es2020'], devtool: false,
  entry: path.join(sdkRoot, 'dist/platform/web/index.js'),
  output: { path: output, filename, library: { name: 'ElevenLabsStoryClient', type: 'window' } },
  optimization: { splitChunks: false, runtimeChunk: false },
  performance: { hints: false },
}, (error, stats) => {
  if (error || stats.hasErrors()) { console.error(error || stats.toString({ all: false, errors: true })); process.exitCode = 1; return; }
  const seen = new Set(), licenses = [];
  function record(directory) {
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    const id = `${manifest.name}@${manifest.version}`;
    if (seen.has(id)) return;
    seen.add(id);
    const files = fs.readdirSync(directory).filter(name => /^(?:license|copying|notice)(?:\.|$)/i.test(name) && fs.statSync(path.join(directory, name)).isFile());
    licenses.push(`${id}\nLicense: ${manifest.license || 'See package notices'}\n${files.map(name => fs.readFileSync(path.join(directory, name), 'utf8')).join('\n')}`);
    for (const name of Object.keys(manifest.dependencies || {})) {
      const relative = path.join(root, 'node_modules', ...name.split('/'));
      if (fs.existsSync(path.join(relative, 'package.json'))) record(relative);
    }
  }
  record(sdkRoot);
  fs.writeFileSync(path.join(output, 'elevenlabs-LICENSES.txt'), licenses.join('\n\n--------------------\n\n') + '\n');
  const bytes = fs.readFileSync(path.join(output, filename));
  fs.writeFileSync(path.join(output, 'elevenlabs-manifest.json'), JSON.stringify({
    package: sdk.name, version: sdk.version, file: filename, bytes: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    documentation: 'https://elevenlabs.io/docs/eleven-agents/libraries/java-script',
    source: 'https://github.com/elevenlabs/packages/tree/main/packages/client',
    dependencies: [...seen].sort(), licenses: 'elevenlabs-LICENSES.txt', rebuild: 'npm run build:story-voice',
  }, null, 2) + '\n');
  console.log(`Built ${filename}: ${bytes.length} bytes; ${seen.size} package license records.`);
});
