/**
 * Focused assertions for lib/contentNormalize.js
 * Run: node scripts/test-content-normalize.js
 */
const assert = require('assert');
const cn = require('../lib/contentNormalize');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('contentNormalize');

// 1. Raw t.co URL stripped from headline
test('strips trailing t.co URL from headline', () => {
  const post = { title: 'Evacuation underway near the capitol https://t.co/abc123' };
  const h = cn.cleanHeadline(post);
  assert.ok(!/t\.co/.test(h), `headline still has t.co: ${h}`);
  assert.strictEqual(h, 'Evacuation underway near the capitol');
});

// 2. Source URL preserved separately via extractUrls
test('source URL preserved separately', () => {
  const text = 'Big story develops https://t.co/abc123';
  const urls = cn.extractUrls(text);
  assert.ok(urls.includes('https://t.co/abc123'), `urls: ${JSON.stringify(urls)}`);
});

// 3. Editorial prefix preserved
test('preserves BREAKING/WATCH editorial prefix', () => {
  assert.strictEqual(
    cn.cleanHeadline({ title: 'BREAKING: Gas leak forces evacuation' }),
    'BREAKING: Gas leak forces evacuation'
  );
  assert.strictEqual(
    cn.cleanHeadline({ title: 'WATCH: Storm makes landfall https://t.co/x' }),
    'WATCH: Storm makes landfall'
  );
});

// 4. Falls back to first body line when no title
test('derives headline from body when title missing', () => {
  const post = { text: 'Officials confirm a controlled venting is underway.\nMore soon https://t.co/zzz' };
  const h = cn.cleanHeadline(post);
  assert.strictEqual(h, 'Officials confirm a controlled venting is underway.');
});

// 5. Duplicate source label removed (but real headlines kept)
test('removes duplicated source label prefix', () => {
  assert.strictEqual(
    cn.cleanHeadline({ title: 'Reuters: Markets tumble after rate decision overnight' }),
    'Markets tumble after rate decision overnight'
  );
});

// 6. Media URL extracted; logo flagged
test('getPrimaryMedia returns image url', () => {
  const m = cn.getPrimaryMedia({ image_url: 'https://example.com/photo.jpg' });
  assert.strictEqual(m.type, 'image');
  assert.strictEqual(m.url, 'https://example.com/photo.jpg');
});

test('flags X profile/logo image and skips it as hero', () => {
  assert.strictEqual(cn.isLikelyLogo('https://pbs.twimg.com/profile_images/123/avatar.png'), true);
  const media = cn.normalizeMedia({ image_url: 'https://pbs.twimg.com/profile_images/1/a.png' });
  assert.strictEqual(media.primary, null, 'logo became hero');
  assert.strictEqual(media.isLikelyLogo, true);
});

// 7. Video primary detection + twimg rewrite
test('detects video and rewrites twimg host', () => {
  const m = cn.getPrimaryMedia({ video_url: 'https://video.twimg.com/abc/clip.mp4', image_url: 'https://x/p.jpg' });
  assert.strictEqual(m.type, 'video');
  assert.strictEqual(m.url, '/media/video/abc/clip.mp4');
  assert.strictEqual(m.poster, 'https://x/p.jpg');
});

// 8. normalizeSocialPostText strips urls but keeps text
test('normalizeSocialPostText cleans urls, keeps content', () => {
  const out = cn.normalizeSocialPostText('Live updates here\n\nFollow https://t.co/x');
  assert.ok(!/t\.co/.test(out));
  assert.ok(out.includes('Live updates here'));
});

console.log(`\n${passed} passed`);
