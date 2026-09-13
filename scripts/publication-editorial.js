#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const workflow = require('../publication/editorial/store');

const usage = `Local editorial workflow (never writes to production)
  node scripts/publication-editorial.js create RECORD --input SOURCE.json --actor PERSON.json
  node scripts/publication-editorial.js submit RECORD --actor PERSON.json
  node scripts/publication-editorial.js preview RECORD --actor PERSON.json --out PREVIEW.html
  node scripts/publication-editorial.js approve RECORD --actor PERSON.json --note "Sources checked" [--resolve-import]
  node scripts/publication-editorial.js publish RECORD --actor PERSON.json
  node scripts/publication-editorial.js revise RECORD --patch PATCH.json --actor PERSON.json --note "What changed"
  node scripts/publication-editorial.js correct RECORD --patch PATCH.json --actor PERSON.json --note "Why corrected" --before "Original error" --after "Correct information"
  node scripts/publication-editorial.js validate RECORD
  node scripts/publication-editorial.js export RECORDS_DIRECTORY --out EXPORT.json
See docs/publication-maintenance.md. Publication means a local JSON export only.`;

function readJson(file) { return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')); }
function write(file, data) {
  const output = path.resolve(file);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, data, 'utf8');
  fs.renameSync(temporary, output);
}
function requireOption(options, name) {
  if (!options[name] || options[name] === true) throw new Error(`--${name} is required.`);
  return options[name];
}

function main(argv) {
  const [command, target, ...rest] = argv;
  if (!command || command === '--help') { process.stdout.write(usage + '\n'); return; }
  if (!target || target.startsWith('--')) throw new Error('Specify a local record path or records directory.');
  const options = {};
  for (let i = 0; i < rest.length; i++) {
    if (!rest[i].startsWith('--')) throw new Error(`Unexpected argument: ${rest[i]}`);
    const key = rest[i].slice(2);
    options[key] = key === 'resolve-import' ? true : rest[++i];
  }
  if (command === 'export') {
    const records = fs.readdirSync(target).filter(file => file.endsWith('.json')).sort().map(file => readJson(path.join(target, file)));
    const result = workflow.exportPublished(records);
    write(requireOption(options, 'out'), JSON.stringify(result, null, 2) + '\n');
    process.stdout.write(`Exported ${result.articles.length} published article(s) and ${result.corrections.length} correction(s) locally.\n`);
    return;
  }
  if (command === 'validate') {
    const errors = workflow.validateRecord(readJson(target), { ready: true });
    if (errors.length) throw new Error(errors.join('\n'));
    process.stdout.write('Content validation passed. Publication also requires a current preview and editor approval.\n');
    return;
  }
  const actor = readJson(requireOption(options, 'actor'));
  const at = new Date().toISOString();
  let record;
  if (command === 'create') {
    if (fs.existsSync(target)) throw new Error('Record already exists; preserve its history with revise or correct.');
    record = workflow.createDraft(readJson(requireOption(options, 'input')), actor, at);
  } else {
    record = readJson(target);
    switch (command) {
      case 'submit': record = workflow.submitReview(record, actor, at); break;
      case 'preview': {
        const output = requireOption(options, 'out');
        if (path.resolve(output) === path.resolve(target)) throw new Error('Preview output must differ from the record path.');
        record = workflow.markPreview(record, actor, at);
        write(output, workflow.previewRecord(record));
        break;
      }
      case 'approve': record = workflow.approveReview(record, actor, requireOption(options, 'note'), at, options['resolve-import'] === true); break;
      case 'publish': record = workflow.publishRecord(record, actor, at); break;
      case 'revise':
      case 'correct': {
        const change = { type: command === 'correct' ? 'correction' : 'update', note: requireOption(options, 'note') };
        if (command === 'correct') { change.before = requireOption(options, 'before'); change.after = requireOption(options, 'after'); }
        record = workflow.reviseRecord(record, readJson(requireOption(options, 'patch')), actor, change, at);
        break;
      }
      default: throw new Error(`Unknown command: ${command}`);
    }
  }
  write(target, JSON.stringify(record, null, 2) + '\n');
  process.stdout.write(`${command}: ${record.id} is ${record.state}. Local files only.\n`);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
module.exports = { main };
