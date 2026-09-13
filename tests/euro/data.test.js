const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const euroDir = path.resolve(__dirname, '../../euro');
const timeline = JSON.parse(fs.readFileSync(path.join(euroDir, 'timeline_data.json'), 'utf8'));
const html = fs.readFileSync(path.join(euroDir, 'index.html'), 'utf8');
const inlineScripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1]).filter(source => source.trim());
const studyScript = inlineScripts.find(source => source.includes('const ERAS ='));

function nonempty(value, label) {
  assert.equal(typeof value, 'string', `${label} must be text`);
  assert.ok(value.trim(), `${label} must not be empty`);
}

function validUnit(unit, label) {
  assert.ok(Number.isInteger(unit) && unit >= 1 && unit <= 9, `${label} must be AP unit 1–9`);
}

function sourceLink(source, label) {
  nonempty(source?.label, `${label}.label`);
  const url = new URL(source.url);
  assert.equal(url.protocol, 'https:', `${label} must use an HTTPS source`);
}

function loadStudyConstants() {
  assert.ok(studyScript, 'The study guide must contain its teaching collections');
  const end = studyScript.indexOf('function eraOf(');
  assert.ok(end > 0, 'The study guide must expose its era helper after its teaching collections');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(studyScript.slice(0, end) + `
    globalThis.collections = {
      ERAS, KEY_WORKS, KEY_PAINTINGS, KEY_WARS, KEY_TREATIES,
      KEY_INNOVATIONS, KEY_MUSIC, KEY_POPES, INFLUENTIAL_WOMEN,
      INTELLECTUAL_ERAS, EXTRA_EVENTS, PERIOD_ANCHORS, AP_VOCAB, CED_GAPS
    };
  `, sandbox, { timeout: 1000 });
  return sandbox.collections;
}

function loadClassroomContent() {
  const source = fs.readFileSync(path.join(euroDir, 'classroom-content.js'), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { timeout: 1000 });
  assert.ok(sandbox.window.EURO_CLASSROOM_CONTENT, 'Classroom content must be available to the page');
  return sandbox.window.EURO_CLASSROOM_CONTENT;
}

function loadStudyHelpers(localStorage = { getItem: () => null }) {
  const sandbox = { localStorage, timeline };
  vm.createContext(sandbox);
  vm.runInContext(studyScript + `
    DATA = timeline;
    globalThis.helpers = {
      eras: ERAS,
      getEventsForEra, getStudyProgress, getBookmarks,
      selectUnit(unit) { currentUnit = unit; }
    };
  `, sandbox, { timeout: 1000 });
  return sandbox.helpers;
}

test('all authored JavaScript parses before students load the page', () => {
  for (const source of inlineScripts) new vm.Script(source);
  for (const file of ['classroom-content.js', 'classroom-app.js']) {
    new vm.Script(fs.readFileSync(path.join(euroDir, file), 'utf8'), { filename: file });
  }
});

test('timeline records have unique IDs, usable dates and instructional content', () => {
  assert.ok(Array.isArray(timeline) && timeline.length > 0);
  const ids = new Set();
  const units = new Set();
  const textFields = ['id', 'date', 'title', 'type', 'description', 'whyItMatters', 'memoryHook', 'sourceNote'];
  const arrayFields = [
    'region', 'category', 'apTheme', 'causes', 'effects', 'connectedBefore',
    'connectedAfter', 'overlaps', 'comparisonOpportunities', 'continuityChangeOpportunities'
  ];
  for (const record of timeline) {
    for (const field of textFields) nonempty(record[field], `${record.id}.${field}`);
    assert.match(record.id, /^[a-z0-9]+(?:-[a-z0-9]+)+$/, `${record.id} must be safe in card attributes`);
    assert.ok(!ids.has(record.id), `${record.id} is duplicated`);
    ids.add(record.id);
    validUnit(record.apUnit, record.id);
    units.add(record.apUnit);
    assert.match(record.apTopic, /^\d+\.\d+$/, `${record.id} has an invalid topic`);
    assert.equal(Number(record.apTopic.split('.')[0]), record.apUnit, `${record.id} topic and unit disagree`);
    assert.ok([1, 2, 3].includes(record.tier), `${record.id} has an invalid priority tier`);
    assert.ok(Number.isInteger(record.startYear), `${record.id} must have a sortable start year`);
    assert.ok(Number.isInteger(record.endYear) && record.endYear >= record.startYear,
      `${record.id} must have a valid end year`);
    assert.ok(['exact', 'approximate', 'range'].includes(record.precision), `${record.id} needs date precision`);
    for (const field of arrayFields) {
      assert.ok(Array.isArray(record[field]), `${record.id}.${field} must be a list`);
      for (const value of record[field]) nonempty(value, `${record.id}.${field}`);
    }
    for (const skill of ['contextualization', 'evidence', 'complexity', 'comparison', 'causation', 'continuityChange']) {
      assert.equal(typeof record.examUse?.[skill], 'boolean', `${record.id}.examUse.${skill} must be boolean`);
    }
    if (record.sourceUrls) {
      assert.ok(Array.isArray(record.sourceUrls));
      for (const url of record.sourceUrls) assert.equal(new URL(url).protocol, 'https:', `${record.id} has an invalid source URL`);
    }
  }
  assert.deepEqual([...units].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('every connected event resolves, with no duplicate or self links', () => {
  const ids = new Set(timeline.map(record => record.id));
  for (const record of timeline) {
    for (const field of ['connectedBefore', 'connectedAfter', 'overlaps']) {
      assert.equal(new Set(record[field]).size, record[field].length, `${record.id}.${field} repeats a link`);
      for (const id of record[field]) {
        assert.ok(ids.has(id), `${record.id}.${field} points to missing event ${id}`);
        assert.notEqual(id, record.id, `${record.id}.${field} links to itself`);
      }
    }
  }
});

test('before and after links do not contradict the events’ dates', () => {
  const records = new Map(timeline.map(record => [record.id, record]));
  for (const record of timeline) {
    for (const id of record.connectedBefore) {
      const before = records.get(id);
      assert.ok(before, `${record.id} links to missing event ${id}`);
      assert.ok(before.startYear <= record.endYear,
        `${record.id} cannot label later event ${id} as Before`);
    }
    for (const id of record.connectedAfter) {
      const after = records.get(id);
      assert.ok(after, `${record.id} links to missing event ${id}`);
      assert.ok(after.endYear >= record.startYear,
        `${record.id} cannot label earlier event ${id} as After`);
    }
  }
});

test('study supplements reference existing eras and AP topics', () => {
  const collections = loadStudyConstants();
  const eras = new Set(collections.ERAS.map(era => era.id));
  assert.equal(eras.size, collections.ERAS.length, 'Era IDs must be unique');
  for (const [name, items] of Object.entries(collections)) {
    for (const item of items) {
      if (item.era) assert.ok(eras.has(item.era), `${name}: ${item.title || item.name} has unknown era ${item.era}`);
      if (item.ced) {
        assert.match(item.ced, /^\d+\.\d+$/, `${name} has an invalid AP topic`);
        validUnit(Number(item.ced.split('.')[0]), item.title);
      }
    }
  }
});

test('period browsing shows each timeline event exactly once and honors unit selection', () => {
  const helpers = loadStudyHelpers();
  for (let unit = 0; unit <= 9; unit++) {
    helpers.selectUnit(unit);
    const shown = helpers.eras.flatMap(era => helpers.getEventsForEra(era.id));
    const expected = timeline.filter(record => !unit || record.apUnit === unit);
    assert.equal(shown.length, expected.length, `Unit ${unit} lost or duplicated timeline events`);
    assert.equal(new Set(shown.map(record => record.id)).size, shown.length, `Unit ${unit} duplicates events across periods`);
    assert.deepEqual(Array.from(shown, record => record.id).sort(), expected.map(record => record.id).sort());
  }
  assert.equal(helpers.getEventsForEra('unknown-era').length, 0);
});

test('corrupted or unavailable local storage cannot break study progress or bookmarks', () => {
  for (const stored of ['null', 'false', '42', '"text"', '{broken', '[]', '{}']) {
    const helpers = loadStudyHelpers({ getItem: () => stored });
    const progress = helpers.getStudyProgress();
    assert.ok(progress && typeof progress === 'object' && !Array.isArray(progress), `Unsafe progress for ${stored}`);
    assert.ok(Array.isArray(helpers.getBookmarks()), `Unsafe bookmarks for ${stored}`);
  }
  const denied = loadStudyHelpers({ getItem() { throw new Error('Storage disabled'); } });
  assert.equal(Object.keys(denied.getStudyProgress()).length, 0);
  assert.equal(denied.getBookmarks().length, 0);
  const mixedBookmarks = loadStudyHelpers({ getItem: () => '[null,123,"u2-001"]' });
  assert.deepEqual(Array.from(mixedBookmarks.getBookmarks()), ['u2-001']);
});

test('a full browser storage quota preserves the newest draft for the current session', () => {
  const app = fs.readFileSync(path.join(euroDir, 'classroom-app.js'), 'utf8');
  const start = app.indexOf('const memory =');
  const end = app.indexOf('function unitOptions(');
  assert.ok(start >= 0 && end > start, 'Classroom controller must retain its session storage fallback');
  const sandbox = {
    localStorage: {
      getItem: () => JSON.stringify('Previously saved draft'),
      setItem() { throw new Error('QuotaExceededError'); }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(app.slice(start, end) + 'globalThis.storage = { read, save };', sandbox, { timeout: 1000 });
  assert.equal(sandbox.storage.read('draft', ''), 'Previously saved draft');
  assert.equal(sandbox.storage.save('draft', 'Latest student response'), false);
  assert.equal(sandbox.storage.read('draft', ''), 'Latest student response',
    'Navigating away and back must not replace a newer in-memory response with an older persisted response');
});

test('classroom units cover all nine AP units and provide usable lesson framing', () => {
  const content = loadClassroomContent();
  assert.ok(content.version, 'Content must identify its version');
  nonempty(content.reviewed, 'Review date');
  nonempty(content.notice, 'Curriculum notice');
  assert.ok(Array.isArray(content.sources) && content.sources.length > 0);
  content.sources.forEach((source, index) => sourceLink(source, `sources[${index}]`));
  assert.deepEqual(Array.from(content.units, unit => unit.id).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (const unit of content.units) {
    for (const field of ['title', 'dates', 'question']) nonempty(unit[field], `Unit ${unit.id}.${field}`);
    assert.ok(Array.isArray(unit.focus) && unit.focus.length > 0, `Unit ${unit.id} needs learning targets`);
    unit.focus.forEach(focus => nonempty(focus, `Unit ${unit.id}.focus`));
  }
});

test('practice questions have distinct answer choices, valid keys and explanations in every unit', () => {
  const { practice } = loadClassroomContent();
  assert.ok(Array.isArray(practice) && practice.length > 0);
  const ids = new Set();
  const units = new Set();
  for (const question of practice) {
    nonempty(question.id, 'Question ID');
    assert.ok(!ids.has(question.id), `Question ${question.id} is duplicated`);
    ids.add(question.id);
    validUnit(question.unit, question.id);
    units.add(question.unit);
    for (const field of ['skill', 'stem', 'explanation']) nonempty(question[field], `${question.id}.${field}`);
    assert.ok(Array.isArray(question.options) && question.options.length >= 2, `${question.id} needs answer choices`);
    question.options.forEach(option => nonempty(option, `${question.id}.options`));
    assert.equal(new Set(question.options).size, question.options.length, `${question.id} repeats an answer choice`);
    assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.options.length,
      `${question.id} answer key must point to an available choice`);
    assert.notEqual(question.explanation, question.options[question.answer], `${question.id} must explain its answer`);
    if (question.source) sourceLink(question.source, `${question.id}.source`);
  }
  assert.deepEqual([...units].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('every unit has a writing prompt and a student self-check', () => {
  const { writing } = loadClassroomContent();
  assert.ok(Array.isArray(writing) && writing.length > 0);
  const units = new Set();
  for (const prompt of writing) {
    validUnit(prompt.unit, 'Writing prompt');
    units.add(prompt.unit);
    nonempty(prompt.prompt, `Unit ${prompt.unit} writing prompt`);
    assert.ok(Array.isArray(prompt.checklist) && prompt.checklist.length > 0,
      `Unit ${prompt.unit} writing prompt needs a self-check`);
    prompt.checklist.forEach(item => nonempty(item, `Unit ${prompt.unit} self-check`));
  }
  assert.deepEqual([...units].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});
