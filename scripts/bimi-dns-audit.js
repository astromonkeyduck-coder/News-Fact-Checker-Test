#!/usr/bin/env node
/**
 * Audit email authentication DNS for noteworthynews.co BIMI readiness.
 * Run: node scripts/bimi-dns-audit.js
 */

const { execSync } = require('child_process');

const DOMAIN = process.env.BIMI_DOMAIN || 'noteworthynews.co';
const RESOLVER = process.env.DNS_RESOLVER || '8.8.8.8';

function dig(name, type = 'TXT') {
  try {
    const out = execSync(`dig @${RESOLVER} ${type} ${name} +short`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out ? out.split('\n').map((line) => line.replace(/^"|"$/g, '')) : [];
  } catch {
    return [];
  }
}

function parseDmarc(records) {
  const dmarc = records.find((r) => r.startsWith('v=DMARC1'));
  if (!dmarc) return { present: false };
  const policy = (dmarc.match(/;\s*p=([^;]+)/i) || [])[1] || 'none';
  const pct = (dmarc.match(/;\s*pct=(\d+)/i) || [])[1] || '100';
  const enforced = ['quarantine', 'reject'].includes(policy.toLowerCase()) && Number(pct) === 100;
  return { present: true, raw: dmarc, policy, pct, enforced };
}

function hasSpf(records) {
  return records.some((r) => r.startsWith('v=spf1'));
}

function main() {
  console.log(`Email auth audit for ${DOMAIN} (resolver ${RESOLVER})\n`);

  const apexTxt = dig(DOMAIN, 'TXT');
  const dmarcTxt = dig(`_dmarc.${DOMAIN}`, 'TXT');
  const bimiTxt = dig(`default._bimi.${DOMAIN}`, 'TXT');
  const dkimSelectors = ['resend._domainkey', 'default._domainkey', 'send._domainkey'];
  const dkim = dkimSelectors
    .map((sel) => ({ selector: sel, records: dig(`${sel}.${DOMAIN}`, 'TXT') }))
    .filter((entry) => entry.records.length);

  const sendSpf = dig(`send.${DOMAIN}`, 'TXT');
  const dmarc = parseDmarc(dmarcTxt);

  const checks = [];

  checks.push({
    name: 'SPF on apex',
    ok: hasSpf(apexTxt),
    detail: hasSpf(apexTxt) ? apexTxt.find((r) => r.startsWith('v=spf1')) : 'Missing — add Resend SPF to apex TXT',
  });

  checks.push({
    name: 'SPF on send subdomain (Return-Path)',
    ok: hasSpf(sendSpf),
    detail: hasSpf(sendSpf) ? sendSpf.find((r) => r.startsWith('v=spf1')) : 'Missing on send.* — verify domain in Resend',
  });

  checks.push({
    name: 'DKIM (Resend)',
    ok: dkim.length > 0,
    detail: dkim.length ? dkim.map((d) => d.selector).join(', ') : 'No DKIM selectors found',
  });

  checks.push({
    name: 'DMARC record',
    ok: dmarc.present,
    detail: dmarc.present ? dmarc.raw : 'Missing — publish _dmarc TXT (see docs/production/bimi-setup.md)',
  });

  checks.push({
    name: 'DMARC enforcement (BIMI requires p=quarantine|reject, pct=100)',
    ok: dmarc.enforced,
    detail: dmarc.present
      ? `p=${dmarc.policy}, pct=${dmarc.pct}`
      : 'Blocked until DMARC exists',
  });

  checks.push({
    name: 'BIMI record',
    ok: bimiTxt.some((r) => r.startsWith('v=BIMI1')),
    detail: bimiTxt[0] || 'Missing — publish default._bimi TXT after logo + certificate are hosted',
  });

  checks.forEach((c) => {
    const mark = c.ok ? 'PASS' : 'FAIL';
    console.log(`[${mark}] ${c.name}`);
    console.log(`       ${c.detail}\n`);
  });

  const blockers = checks.filter((c) => !c.ok);
  if (blockers.length === 0) {
    console.log('All checks passed. Send a test email to Gmail and confirm the logo appears (may take 24–48h).');
    process.exit(0);
  }

  console.log(`${blockers.length} blocker(s). See docs/production/bimi-setup.md for exact DNS values.`);
  process.exit(1);
}

main();
