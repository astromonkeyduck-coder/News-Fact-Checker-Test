# DMARC Setup Guide for noteworthynews.co

## What is DMARC?

DMARC (Domain-based Message Authentication, Reporting & Conformance) is a DNS TXT record that tells email receivers how to handle emails from your domain that fail SPF or DKIM checks. It helps prevent email spoofing and improves deliverability.

## Current Status

- **Domain**: noteworthynews.co
- **Email Service**: Resend
- **From Email**: richard@noteworthynews.co (default)

## DMARC Record Setup

### Step 1: Verify SPF and DKIM are Set Up

Before setting up DMARC, ensure:
1. **SPF record** is configured (Resend should provide this when you verify your domain)
2. **DKIM records** are configured (Resend should provide this when you verify your domain)

You can verify these in your Resend dashboard at: https://resend.com/domains

### Step 2: Add DMARC Record

Add the following TXT record to your DNS:

**Record Type**: TXT  
**Name/Host**: `_dmarc`  
**Value**: `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@noteworthynews.co; ruf=mailto:dmarc-reports@noteworthynews.co; pct=100; sp=quarantine; aspf=r; adkim=r;`

### DMARC Policy Options

You can adjust the policy (`p=`) based on your needs:

#### For Testing (Recommended First Step)
```
v=DMARC1; p=none; rua=mailto:dmarc-reports@noteworthynews.co; ruf=mailto:dmarc-reports@noteworthynews.co; pct=100
```
- `p=none` - Monitor only, don't reject/quarantine any emails
- Use this first to see reports without affecting delivery

#### For Production (After Testing)
```
v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@noteworthynews.co; ruf=mailto:dmarc-reports@noteworthynews.co; pct=100; sp=quarantine
```
- `p=quarantine` - Quarantine emails that fail (send to spam)
- `sp=quarantine` - Same policy for subdomains

#### For Strict Enforcement (After Confirming Everything Works)
```
v=DMARC1; p=reject; rua=mailto:dmarc-reports@noteworthynews.co; ruf=mailto:dmarc-reports@noteworthynews.co; pct=100; sp=reject
```
- `p=reject` - Reject emails that fail (don't deliver at all)
- **Only use this after thorough testing!**

### DMARC Record Parameters Explained

- `v=DMARC1` - DMARC version (always DMARC1)
- `p=none|quarantine|reject` - Policy for failed emails
- `rua=mailto:...` - Email address for aggregate reports (daily summaries)
- `ruf=mailto:...` - Email address for forensic reports (individual failures)
- `pct=100` - Percentage of emails to apply policy to (100 = all emails)
- `sp=...` - Policy for subdomains (same options as `p`)
- `aspf=r` - SPF alignment mode (relaxed)
- `adkim=r` - DKIM alignment mode (relaxed)

### Step 3: Set Up Email for Reports

Create an email address to receive DMARC reports:
- `dmarc-reports@noteworthynews.co` (or use an existing email)

You can use a service like:
- [Postmark DMARC Reports](https://dmarc.postmarkapp.com/) (free)
- [Dmarcian](https://dmarcian.com/) (free tier available)
- [MXToolbox DMARC Analyzer](https://mxtoolbox.com/dmarc/) (free)

Or simply create the email address and set up forwarding to your main email.

### Step 4: Verify DMARC Record

After adding the DNS record, verify it's working:

1. **Check DNS propagation** (can take up to 48 hours):
   ```bash
   dig _dmarc.noteworthynews.co TXT
   ```
   Or use online tools:
   - https://mxtoolbox.com/dmarc.aspx
   - https://www.dmarcanalyzer.com/
   - https://dmarcian.com/dmarc-inspector/

2. **Test DMARC validation**:
   - Send a test email from your domain
   - Check email headers for DMARC pass/fail status
   - Monitor reports at your `rua` email address

### Step 5: Monitor and Adjust

1. **Start with `p=none`** for 1-2 weeks
2. **Review reports** to ensure legitimate emails are passing
3. **Gradually increase strictness**:
   - After 1-2 weeks: Change to `p=quarantine`
   - After another 1-2 weeks: Change to `p=reject` (if everything looks good)

## Resend Domain Verification

Make sure your domain is fully verified in Resend:

1. Go to https://resend.com/domains
2. Add `noteworthynews.co` as a domain
3. Add the DNS records Resend provides:
   - SPF record
   - DKIM records (usually 2-3 records)
4. Wait for verification (usually takes a few minutes)
5. Once verified, you can use `richard@noteworthynews.co` as your from address

## Troubleshooting

### "No DMARC record found"
- Check that the DNS record name is exactly `_dmarc` (with underscore)
- Verify DNS propagation (can take 24-48 hours)
- Check for typos in the record value

### "DMARC record is valid" but emails still failing
- Ensure SPF and DKIM are properly configured
- Check that Resend domain is verified
- Review DMARC reports to see what's failing
- Start with `p=none` to monitor without affecting delivery

### Emails going to spam
- This is normal with `p=quarantine` - legitimate emails should still arrive
- Check spam folder regularly during testing
- Ensure SPF and DKIM are passing
- Consider using `p=none` during initial setup

## Quick Start (Recommended)

1. **Add this DMARC record** (monitoring only):
   ```
   _dmarc TXT "v=DMARC1; p=none; rua=mailto:dmarc-reports@noteworthynews.co; pct=100"
   ```

2. **Wait 24-48 hours** for DNS propagation

3. **Verify** using https://mxtoolbox.com/dmarc.aspx

4. **Monitor reports** for 1-2 weeks

5. **Upgrade to quarantine** after confirming everything works:
   ```
   _dmarc TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@noteworthynews.co; pct=100; sp=quarantine"
   ```

## Additional Resources

- [DMARC.org](https://dmarc.org/) - Official DMARC documentation
- [Resend Domain Setup](https://resend.com/docs/dashboard/domains/introduction) - Resend's domain verification guide
- [Google DMARC Setup](https://support.google.com/a/answer/2466563) - Google's DMARC guide
- [Postmark DMARC Guide](https://postmarkapp.com/guides/dmarc) - Comprehensive DMARC guide

## Notes

- DMARC records can take 24-48 hours to propagate globally
- Always start with `p=none` to avoid blocking legitimate emails
- Monitor reports regularly, especially during the first few weeks
- Keep your Resend domain verified and SPF/DKIM records up to date

