'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const directory = path.join(__dirname, '../../publication/inside-story/data');
const data = require('../../publication/inside-story/data/java-sea-2026.json');
const provenance = require('../../publication/inside-story/data/provenance.json');
const history = JSON.parse(fs.readFileSync(path.join(directory, 'source/usgs-event-history.geojson')));
const catalogue = JSON.parse(fs.readFileSync(path.join(directory, 'source/catalogue.geojson')));
const grid = JSON.parse(fs.readFileSync(path.join(directory, 'source/shaking-current-grid.covjson')));
const read = name => JSON.parse(fs.readFileSync(path.join(directory, 'source', name)));

// .geojson is data, not JavaScript, so load through JSON explicitly.
test('saved source files retain byte-level provenance', () => {
  assert.equal(data.publishedAt, undefined, 'local preparation must not claim publication');
  assert.ok(Number.isFinite(Date.parse(data.preparedAt)));
  assert.equal(data.catalogue.minimumMagnitude, 3);
  assert.equal(data.catalogue.minMagnitude, undefined);
  for (const source of provenance.sources) {
    const bytes = fs.readFileSync(path.join(directory, source.file));
    assert.equal(bytes.length, source.bytes);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), source.sha256);
    assert.equal(new URL(source.url).hostname, 'earthquake.usgs.gov');
    assert.ok(Number.isFinite(Date.parse(source.retrievedAt)));
  }
  const bytes = fs.readFileSync(path.join(directory, provenance.dataFile));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), provenance.dataSha256);
});

test('preferred hypocentre and bounded catalogue preserve official coordinates and occurrence times', () => {
  assert.equal(data.event.id, history.id);
  assert.deepEqual([data.event.longitude, data.event.latitude, data.event.depthKm], history.geometry.coordinates);
  assert.equal(data.event.magnitude, history.properties.mag);
  assert.equal(Date.parse(data.event.time), history.properties.time);
  assert.equal(data.events.length, catalogue.metadata.count);
  assert.deepEqual(data.events.map(event => event.id), catalogue.features.map(feature => feature.id));
  let previous = -Infinity;
  const [west, south, east, north] = data.catalogue.bounds;
  for (const [index, event] of data.events.entries()) {
    const original = catalogue.features[index];
    const time = Date.parse(event.time);
    assert.equal(time, original.properties.time);
    assert.equal(Date.parse(event.updated), original.properties.updated);
    assert.deepEqual([event.longitude, event.latitude, event.depthKm], original.geometry.coordinates);
    assert.ok(time >= previous && time >= Date.parse(data.catalogue.startTime) && time <= Date.parse(data.catalogue.endTime));
    assert.ok(event.longitude >= west && event.longitude <= east && event.latitude >= south && event.latitude <= north);
    assert.ok(event.magnitude >= data.catalogue.minimumMagnitude);
    previous = time;
  }
  assert.match(data.catalogue.description, /does not establish an aftershock relationship/);
});

test('then-and-now milestones match actual preserved product versions, not occurrence-time filtering', () => {
  const products = history.properties.products;
  const sources = new Map(data.sources.map(source => [source.id, source]));
  assert.equal(sources.size, data.sources.length);
  let previous = -Infinity;
  for (const entry of data.evidence) {
    const source = sources.get(entry.sourceId);
    assert.ok(source);
    assert.equal(entry.time, source.issuedAt);
    assert.ok(Date.parse(entry.time) > Date.parse(data.event.time));
    assert.ok(Date.parse(entry.time) > previous);
    previous = Date.parse(entry.time);
    const product = [...products.origin, ...products.shakemap].find(product => product.updateTime === Date.parse(entry.time));
    assert.ok(product, 'each evidence milestone must be a real source product');
    assert.equal(entry.magnitude, Number(product.properties.magnitude));
    assert.equal(entry.depthKm, Number(product.properties.depth));
    if (entry.id.startsWith('origin-')) {
      const xml = fs.readFileSync(path.join(directory, 'source', entry.id + '.xml'), 'utf8');
      assert.match(xml, new RegExp('<depth>\\s*<value>' + entry.depthKm * 1000 + '</value>'));
      assert.equal(entry.eventTime, product.properties.eventtime);
      assert.equal(entry.originStations, Number(product.properties['num-stations-used']));
      assert.equal(entry.evaluationStatus, 'preliminary');
      assert.equal(entry.reviewStatus, 'reviewed');
    }
  }
  assert.equal(data.evidence[0].magnitude, 6.6);
  assert.equal(data.evidence.find(entry => entry.id === 'origin-current').magnitude, 6.5);
  assert.match(data.evidence[0].text, /not a claim about the very first public alert/);
  assert.ok(data.sources.filter(source => source.kind === 'explanation').every(source => source.issuedAt === undefined));
});

test('surface-shaking display represents every official grid sample exactly once', () => {
  const official = grid.ranges.MMI;
  const [rows, columns] = official.shape;
  assert.deepEqual(official.axisNames, ['y', 'x']);
  const represented = new Set();
  for (const feature of data.shaking.geojson.features) {
    assert.equal(feature.geometry.type, 'Polygon');
    const { row, columnStart, columnEnd, value } = feature.properties;
    for (let column = columnStart; column <= columnEnd; column += 1) {
      const index = row * columns + column;
      assert.equal(official.values[index], value);
      assert.ok(!represented.has(index), 'no sample is duplicated');
      represented.add(index);
    }
    const ring = feature.geometry.coordinates[0];
    assert.deepEqual(ring[0], ring.at(-1));
  }
  assert.equal(represented.size, rows * columns);
  assert.equal(data.shaking.grid.minimum, Math.min(...official.values));
  assert.equal(data.shaking.grid.maximum, Math.max(...official.values));
  assert.equal(read('shaking-current-contours.geojson').features.length, 0);
  assert.deepEqual(data.shaking.earlier.geojson, read('shaking-earlier-contours.geojson'));
  assert.match(data.shaking.description, /not an observed damage map/);
  assert.equal(data.shaking.reviewStatus, 'automatic');
});

test('geography stays within its documented bounds and every editorial claim has a listed source', () => {
  const [west, south, east, north] = data.bounds;
  assert.ok(data.geography.geojson.features.length);
  for (const feature of data.geography.geojson.features) {
    assert.equal(feature.geometry.type, 'Polygon');
    for (const ring of feature.geometry.coordinates) {
      assert.deepEqual(ring[0], ring.at(-1));
      for (const [longitude, latitude] of ring) assert.ok(longitude >= west && longitude <= east && latitude >= south && latitude <= north);
    }
  }
  const sourceIds = new Set(data.sources.map(source => source.id));
  for (const claim of data.context) assert.ok(claim.sourceIds.every(id => sourceIds.has(id)));
  for (const id of [data.event.sourceId, data.catalogue.sourceId, data.shaking.sourceId, data.geography.sourceId]) assert.ok(sourceIds.has(id));
  assert.ok(data.limitations.some(text => /not live monitoring/.test(text)));
  assert.ok(data.limitations.some(text => /does not recreate the information available/.test(text)));
});
