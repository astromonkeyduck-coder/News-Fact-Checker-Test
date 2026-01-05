/**
 * Test Strict Event Binding - Direct Function Test
 * Tests the core functions without requiring full usgs.js module
 */

require('dotenv').config({ path: '.env.local' });

// Copy the functions we need directly (to avoid Supabase dependency)
async function fetchUsgsDetailGeoJson({ eventId, detailUrl, logger }) {
  let url = detailUrl;
  if (!url && eventId) {
    url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/${eventId}.geojson`;
  }
  if (!url) {
    if (logger) logger.warn('No detailUrl or eventId provided for GeoJSON fetch');
    return null;
  }
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NoteworthyNews/1.0)',
        'Accept': 'application/geo+json, application/json'
      }
    });
    if (!response.ok) {
      if (logger) logger.warn('Failed to fetch USGS detail GeoJSON', { url, status: response.status });
      return null;
    }
    const json = await response.json();
    if (logger) logger.info('✅ Fetched USGS detail GeoJSON', { eventId, url, hasProperties: !!json.properties });
    return json;
  } catch (error) {
    if (logger) logger.warn('Error fetching USGS detail GeoJSON', { error: error.message, url, eventId });
    return null;
  }
}

function extractUsgsProductImages(detailJson) {
  const candidates = [];
  if (!detailJson || !detailJson.properties || !detailJson.properties.products) {
    return candidates;
  }
  const products = detailJson.properties.products;
  const productPriority = {
    'shakemap': 1,
    'dyfi': 2,
    'losspager': 3,
    'pager': 3,
    'origin': 4,
    'location': 4,
    'moment-tensor': 5,
    'focal-mechanism': 5
  };
  const pathPreference = ['intensity', 'mmi', 'pga', 'pgv', 'map', 'plot'];
  function scorePath(path) {
    const lowerPath = path.toLowerCase();
    for (let i = 0; i < pathPreference.length; i++) {
      if (lowerPath.includes(pathPreference[i])) {
        return pathPreference.length - i;
      }
    }
    return 0;
  }
  function isImageContent(content) {
    if (!content || !content.url) return false;
    if (content.contentType && content.contentType.startsWith('image/')) {
      return true;
    }
    const url = content.url.toLowerCase();
    if (/\.(png|jpg|jpeg|gif|webp)(\?|$)/.test(url)) {
      if (url.includes('.xml') || url.includes('.json') || url.includes('.txt') ||
          url.includes('/contents') || url.includes('/metadata') || url.includes('/attenuation')) {
        return false;
      }
      return true;
    }
    return false;
  }
  for (const [productType, productList] of Object.entries(products)) {
    if (!Array.isArray(productList) || productList.length === 0) continue;
    const priority = productPriority[productType] || 999;
    for (const product of productList) {
      if (!product || !product.contents || typeof product.contents !== 'object') continue;
      const preferredWeight = product.preferredWeight || 0;
      const updateTime = product.updateTime || 0;
      for (const [path, content] of Object.entries(product.contents)) {
        if (!isImageContent(content)) continue;
        const url = content.url;
        if (candidates.some(c => c.url === url)) continue;
        const pathScore = scorePath(path);
        const candidateScore = priority * 1000 - pathScore * 10 - preferredWeight;
        candidates.push({
          url: url,
          contentType: content.contentType || 'image/jpeg',
          productType: productType,
          path: path,
          updateTime: updateTime,
          weight: preferredWeight,
          score: candidateScore,
          productId: product.id
        });
      }
    }
  }
  candidates.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return b.updateTime - a.updateTime;
  });
  return candidates.slice(0, 6);
}

// Test strict binding logic
function stripPrefix(id = '') {
  return id.toLowerCase().replace(/^(us|ak|ci|nc|nn|pr|tx|hv|mb|se|uw)/, '');
}

function verifyEventBinding(url, eventId) {
  if (!url || !eventId) return false;
  const u = url.toLowerCase();
  const id = eventId.toLowerCase();
  const segments = u.split(/[\/?#]/g);
  if (segments.includes(id)) return true;
  if (u.includes(`/eventpage/${id}/`)) return true;
  if (u.includes(`/product/`) && u.includes(`/${id}/`)) return true;
  return false;
}

async function testEventBinding(eventId, detailUrl) {
  console.log('\n' + '='.repeat(80));
  console.log(`TESTING EVENT: ${eventId}`);
  console.log('='.repeat(80));
  
  const logger = { info: console.log, warn: console.warn, error: console.error };
  
  // Fetch GeoJSON
  const detailJson = await fetchUsgsDetailGeoJson({ eventId, detailUrl, logger });
  
  if (!detailJson) {
    console.log('❌ Failed to fetch GeoJSON');
    return null;
  }
  
  // STRICT EVENT BINDING: Verify GeoJSON is for the same eventId
  const geoJsonEventId = detailJson.id || detailJson.properties?.ids?.split(',')[0]?.trim() || '';
  const geoId = geoJsonEventId.toLowerCase();
  const reqId = (eventId || '').toLowerCase();
  const geoIdStripped = stripPrefix(geoId);
  const reqIdStripped = stripPrefix(reqId);
  const strictMatch = geoId === reqId || geoIdStripped === reqIdStripped;
  
  console.log(`\n📊 STRICT EVENT BINDING CHECK:`);
  console.log(`  Request eventId: ${reqId} (stripped: ${reqIdStripped})`);
  console.log(`  GeoJSON eventId: ${geoId} (stripped: ${geoIdStripped})`);
  console.log(`  Strict Match: ${strictMatch ? '✅ PASS' : '❌ FAIL'}`);
  
  if (!strictMatch) {
    console.log(`\n❌ REJECTING ALL USGS IMAGES - GeoJSON mismatch`);
    return { strictMatch: false, candidates: [] };
  }
  
  // Extract products
  const products = detailJson.properties?.products || {};
  const productKeys = Object.keys(products);
  const productCounts = {};
  for (const [key, productList] of Object.entries(products)) {
    productCounts[key] = Array.isArray(productList) ? productList.length : 0;
  }
  
  let usgsCandidates = extractUsgsProductImages(detailJson);
  
  // Filter by URL event binding
  const originalCount = usgsCandidates.length;
  const rejectedCandidates = [];
  usgsCandidates = usgsCandidates.filter(candidate => {
    const isBound = verifyEventBinding(candidate.url, eventId);
    if (!isBound) {
      rejectedCandidates.push({
        url: candidate.url.substring(0, 100),
        productType: candidate.productType,
        path: candidate.path
      });
    }
    return isBound;
  });
  
  console.log(`\n📦 FORENSIC: Products present:`);
  console.log(`  eventId: ${reqId}`);
  console.log(`  geoJsonEventId: ${geoId}`);
  console.log(`  strictMatch: ${strictMatch}`);
  console.log(`  productKeys: ${productKeys.join(', ')}`);
  console.log(`  productCounts:`, productCounts);
  console.log(`  candidateCount: ${usgsCandidates.length} (after filtering)`);
  console.log(`  rejectedCount: ${rejectedCandidates.length}`);
  
  if (rejectedCandidates.length > 0) {
    console.log(`\n⚠️ REJECTED candidates (no eventId in URL):`);
    rejectedCandidates.slice(0, 5).forEach(c => {
      console.log(`  - ${c.productType}/${c.path}: ${c.url}`);
    });
  }
  
  console.log(`\n📸 TOP CANDIDATES (after filtering):`);
  usgsCandidates.slice(0, 6).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.productType}/${c.path}`);
    console.log(`     URL: ${c.url.substring(0, 100)}`);
    console.log(`     urlBindingPassed: ${verifyEventBinding(c.url, eventId)}`);
  });
  
  return {
    strictMatch,
    geoJsonEventId: geoId,
    requestEventId: reqId,
    productKeys,
    productCounts,
    candidateCount: usgsCandidates.length,
    rejectedCount: rejectedCandidates.length,
    topCandidates: usgsCandidates.slice(0, 6).map(c => ({
      url: c.url,
      productType: c.productType,
      path: c.path,
      urlBindingPassed: verifyEventBinding(c.url, eventId)
    }))
  };
}

async function runTests() {
  console.log('\n🔍 STRICT EVENT BINDING TEST\n');
  
  // Test 1: Los Angeles event
  const laResult = await testEventBinding(
    'ci41152183',
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/ci41152183.geojson'
  );
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: India event
  const indiaResult = await testEventBinding(
    'us7000rmhe',
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/us7000rmhe.geojson'
  );
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  
  console.log(`\nLA Event (ci41152183):`);
  console.log(`  Strict Match: ${laResult?.strictMatch ? '✅' : '❌'}`);
  console.log(`  GeoJSON ID: ${laResult?.geoJsonEventId}`);
  console.log(`  Candidates: ${laResult?.candidateCount || 0}`);
  console.log(`  Rejected: ${laResult?.rejectedCount || 0}`);
  
  console.log(`\nIndia Event (us7000rmhe):`);
  console.log(`  Strict Match: ${indiaResult?.strictMatch ? '✅' : '❌'}`);
  console.log(`  GeoJSON ID: ${indiaResult?.geoJsonEventId}`);
  console.log(`  Candidates: ${indiaResult?.candidateCount || 0}`);
  console.log(`  Rejected: ${indiaResult?.rejectedCount || 0}`);
  
  if (laResult?.strictMatch && indiaResult?.strictMatch) {
    console.log(`\n✅ Both events passed strict GeoJSON matching`);
  }
  
  if (laResult?.candidateCount === 0 && laResult?.strictMatch) {
    console.log(`\n⚠️ LA event: strictMatch passed but 0 candidates after URL filtering`);
    console.log(`   This suggests USGS URLs don't contain eventId in path`);
    console.log(`   Solution: Trust GeoJSON products if strictMatch passes, skip URL binding`);
  }
}

runTests().catch(console.error);

