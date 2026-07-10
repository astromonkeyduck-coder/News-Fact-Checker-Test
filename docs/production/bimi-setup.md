# BIMI setup — Noteworthy News inbox logo

Show the Noteworthy News logo next to outgoing mail in Gmail, Apple Mail, and Yahoo instead of Gmail’s auto-generated letter avatar (the purple **r** from `richard@noteworthynews.co`).

**What this repo provides**

| Asset | URL after deploy |
|-------|------------------|
| BIMI logo (SVG Tiny PS) | `https://noteworthynews.co/bimi/bimi-logo.svg` |
| Certificate PEM (you add after CA issues it) | `https://noteworthynews.co/bimi/bimi.pem` |

**What only you can do** (DNS is on NS1; certificate requires a CA)

1. Publish SPF + DMARC DNS records
2. Confirm Resend domain verification is green
3. Purchase a **VMC** (trademarked logo) or **CMC** (no trademark) from DigiCert, Sectigo, or SSL.com
4. Upload the issued PEM to `bimi/bimi.pem` and redeploy
5. Publish the BIMI TXT record

---

## Current audit (2026-07-07)

Run anytime:

```bash
node scripts/bimi-dns-audit.js
node scripts/validate-bimi-svg.js
```

| Check | Status |
|-------|--------|
| DKIM `resend._domainkey` | Present |
| SPF on `send.noteworthynews.co` | Present (`include:amazonses.com`) |
| SPF on apex `noteworthynews.co` | **Missing** |
| DMARC `_dmarc.noteworthynews.co` | **Missing** |
| BIMI `default._bimi.noteworthynews.co` | **Missing** |

DNS host: **NS1** (`dns1–4.p01.nsone.net`).

---

## Step 1 — Resend domain verification

1. Open [resend.com/domains](https://resend.com/domains) → `noteworthynews.co`
2. Confirm **Verified** with green checks for SPF, DKIM, and DMARC guidance
3. If Resend shows records that differ from below, **use Resend’s values** — they are authoritative for your account

---

## Step 2 — DNS records to add in NS1

Log in to [NS1](https://my.nsone.net/) → zone `noteworthynews.co`.

### 2a. Apex SPF (if missing)

| Type | Name / Host | Value |
|------|-------------|-------|
| TXT | `@` (or `noteworthynews.co`) | `v=spf1 include:amazonses.com ~all` |

> Resend sends through Amazon SES. The `send` subdomain already has this record; the apex needs it too for consistent alignment when `From:` is `richard@noteworthynews.co`.

### 2b. DMARC — phased rollout

**Phase A — monitor (publish first, wait 1–2 weeks)**

| Type | Name / Host | Value |
|------|-------------|-------|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@noteworthynews.co; ruf=mailto:dmarc@noteworthynews.co; fo=1; adkim=r; aspf=r; pct=100` |

Set up `dmarc@noteworthynews.co` to receive aggregate reports (or use a DMARC monitoring service).

**Phase B — enforce (required for BIMI)**

After reports show SPF/DKIM passing consistently:

| Type | Name / Host | Value |
|------|-------------|-------|
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@noteworthynews.co; adkim=r; aspf=r; pct=100` |

Optional final state: `p=reject` once you are confident nothing legitimate is failing.

BIMI **will not work** until `p=quarantine` or `p=reject` with `pct=100`.

### 2c. BIMI record (after certificate is issued and hosted)

| Type | Name / Host | Value |
|------|-------------|-------|
| TXT | `default._bimi` | `v=BIMI1; l=https://noteworthynews.co/bimi/bimi-logo.svg; a=https://noteworthynews.co/bimi/bimi.pem;` |

Your CA may supply a slightly different `l=` / `a=` format — use their exact string.

---

## Step 3 — Mark certificate (VMC or CMC)

Gmail and Apple Mail require a verified mark certificate.

| Type | Trademark required? | Gmail blue checkmark? | Typical cost |
|------|---------------------|----------------------|--------------|
| **VMC** | Yes — registered trademark on the logo | Yes | ~$1,200–1,500/yr |
| **CMC** | No — logo publicly on your domain 12+ months | No (logo only) | Lower |

**Recommended path without a trademark:** apply for a **CMC** from DigiCert or Sectigo, submitting:

- Domain: `noteworthynews.co`
- Logo file: `bimi/bimi-logo.svg` (already in this repo)
- Proof the NW globe mark has been on the site (screenshots, Wayback Machine)

When the CA issues the PEM:

1. Save it as `bimi/bimi.pem` in this repo
2. Commit and deploy
3. Confirm `https://noteworthynews.co/bimi/bimi.pem` loads over HTTPS
4. Publish the BIMI TXT record (Step 2c)

---

## Step 4 — Validate and test

```bash
# Local checks
node scripts/validate-bimi-svg.js
node scripts/bimi-dns-audit.js

# After DNS propagates (24–48h)
dig @8.8.8.8 TXT _dmarc.noteworthynews.co +short
dig @8.8.8.8 TXT default._bimi.noteworthynews.co +short
```

Online validators:

- [BIMI Group generator / inspector](https://bimigroup.org/bimi-generator/)
- [Signet BIMI checker](https://withsignet.com/tools/bimi-checker)

Send a test newsletter to a Gmail account. Logo display can lag DNS by days and also depends on sender reputation.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Purple letter avatar still shows | BIMI not live yet, or DMARC not at enforcement |
| Logo in Yahoo but not Gmail | Gmail needs VMC/CMC; Yahoo can show BIMI without VMC |
| BIMI record present, no logo | SVG fails Tiny PS validation, PEM chain incomplete, or HTTPS URL unreachable |
| Mail failing after DMARC enforce | SPF/DKIM misalignment — check Resend domain dashboard |

---

## Files in this repo

```
bimi/
  bimi-logo.svg     # BIMI-compliant brand mark (deployed statically)
  bimi.pem          # YOU add after CA issues certificate (gitignored until present)
scripts/
  validate-bimi-svg.js
  bimi-dns-audit.js
```

Netlify serves `/bimi/*` with `Content-Type: image/svg+xml` for the logo.
