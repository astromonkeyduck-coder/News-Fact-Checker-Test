#!/usr/bin/env node
/**
 * Vendor U.S. state geometry for the Food Safety map.
 *
 * Downloads the Census-derived us-atlas TopoJSON (states-10m), projects it
 * with geoAlbersUsa (includes Alaska/Hawaii insets), and writes precomputed
 * SVG path strings to assets/food-safety/us-states.json so the client never
 * depends on a runtime CDN or ships D3.
 *
 * Source: https://github.com/topojson/us-atlas (U.S. Census Bureau
 * cartographic boundaries). Run manually when geometry needs refreshing:
 *
 *   node scripts/food-safety/build-us-states.js [path-to-states-10m.json]
 */

const fs = require('fs');
const path = require('path');
const { geoAlbersUsa, geoPath } = require('d3-geo');
const { feature } = require('topojson-client');

const WIDTH = 975;
const HEIGHT = 610;

// FIPS → USPS abbreviation for states + DC + PR
const FIPS_TO_ABBR = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO',
  '09': 'CT', 10: 'DE', 11: 'DC', 12: 'FL', 13: 'GA', 15: 'HI', 16: 'ID',
  17: 'IL', 18: 'IN', 19: 'IA', 20: 'KS', 21: 'KY', 22: 'LA', 23: 'ME',
  24: 'MD', 25: 'MA', 26: 'MI', 27: 'MN', 28: 'MS', 29: 'MO', 30: 'MT',
  31: 'NE', 32: 'NV', 33: 'NH', 34: 'NJ', 35: 'NM', 36: 'NY', 37: 'NC',
  38: 'ND', 39: 'OH', 40: 'OK', 41: 'OR', 42: 'PA', 44: 'RI', 45: 'SC',
  46: 'SD', 47: 'TN', 48: 'TX', 49: 'UT', 50: 'VT', 51: 'VA', 53: 'WA',
  54: 'WV', 55: 'WI', 56: 'WY', 72: 'PR',
};

async function main() {
  const inputPath = process.argv[2];
  let topo;
  if (inputPath) {
    topo = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  } else {
    const res = await fetch('https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json');
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    topo = await res.json();
  }

  const states = feature(topo, topo.objects.states);
  const projection = geoAlbersUsa().fitSize([WIDTH, HEIGHT], states);
  const pathGen = geoPath(projection);

  const out = {
    meta: {
      source: 'us-atlas@3.0.1 states-10m.json (U.S. Census Bureau cartographic boundaries)',
      projection: 'geoAlbersUsa (Alaska/Hawaii insets included)',
      width: WIDTH,
      height: HEIGHT,
      generated_at: new Date().toISOString(),
    },
    states: [],
  };

  for (const f of states.features) {
    const fips = String(f.id).padStart(2, '0');
    const abbr = FIPS_TO_ABBR[fips] || FIPS_TO_ABBR[String(parseInt(fips, 10))];
    if (!abbr) continue; // territories not covered by AlbersUsa
    const d = pathGen(f);
    if (!d) continue; // outside projection (e.g. some territories)
    const centroid = pathGen.centroid(f);
    out.states.push({
      abbr,
      name: f.properties.name,
      fips,
      path: roundPath(d),
      centroid: [Math.round(centroid[0]), Math.round(centroid[1])],
    });
  }

  out.states.sort((a, b) => a.abbr.localeCompare(b.abbr));

  const outPath = path.resolve(__dirname, '../../assets/food-safety/us-states.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out));
  const kb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`Wrote ${out.states.length} states to ${outPath} (${kb} KB)`);
}

function roundPath(d) {
  // Round coordinates to 1 decimal to shrink the payload.
  return d.replace(/(\d+\.\d{2,})/g, (m) => Number(m).toFixed(1));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
