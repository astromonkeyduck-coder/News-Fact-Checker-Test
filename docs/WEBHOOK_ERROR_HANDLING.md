# Webhook Error Handling Guide

## Problem: Resend Webhook Returns 500 Errors

When webhooks return 500 errors, Resend retries them, causing:
- Multiple failure notifications
- Unnecessary load on your functions
- Confusing error messages

## Solution: Always Return 200 to Acknowledge Receipt

**CRITICAL RULE**: Webhooks should **ALWAYS** return `200 OK` to acknowledge receipt, even if processing fails internally.

### Why?

1. **Prevents Retries**: Resend (and most webhook providers) retry on 5xx errors
2. **Acknowledges Receipt**: Tells the provider "I got your message"
3. **Logs Errors**: Errors are logged but don't break the webhook flow
4. **Better UX**: Users don't get spammed with retry notifications

## Current Implementation

### ✅ Fixed Functions:

1. **`inbound-email.js`**:
   - Returns 200 even if `ingest-all` fails
   - Logs errors for debugging
   - Includes error details in response body

2. **`resend-webhook.js`**:
   - Returns 200 even on processing errors
   - Logs errors for debugging
   - Acknowledges receipt to prevent retries

### Error Response Format:

```json
{
  "success": false,
  "error": "Failed to trigger ingest-all",
  "message": "HTTP 500: Internal Error...",
  "note": "Webhook received but processing failed - check logs for details"
}
```

## Debugging ingest-all Failures

When `ingest-all` returns 500, check:

1. **Netlify Function Logs**:
   - Go to Netlify Dashboard → Functions → ingest-all → Logs
   - Look for initialization errors
   - Check for missing environment variables

2. **Common Causes**:
   - Missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`
   - Engine files missing in `netlify/functions/engines/`
   - Logger module not found
   - Dependencies not bundled correctly

3. **Error Response Includes**:
   - `hasSupabase`: Whether Supabase client loaded
   - `hasLogger`: Whether logger loaded
   - `enginesLoaded`: Number of engines loaded
   - `initError`: Initialization error details (if any)

## Testing

### Test ingest-all directly:

```bash
curl -X POST https://noteworthynews.co/.netlify/functions/ingest-all
```

### Test inbound-email webhook:

```bash
curl -X POST https://noteworthynews.co/.netlify/functions/inbound-email \
  -H "Content-Type: application/json" \
  -d '{"subject": "ingest", "from": "test@example.com", "to": "richard@noteworthynews.co"}'
```

## Best Practices

1. **Always return 200** from webhook handlers
2. **Log errors** for debugging
3. **Include error details** in response body (for debugging)
4. **Don't throw** - catch and handle gracefully
5. **Use try-catch** around all async operations

## Summary

✅ **Webhooks now return 200 even on errors**
✅ **Errors are logged for debugging**
✅ **Resend won't retry failed webhooks**
✅ **Better error messages in response body**
