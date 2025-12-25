# Critical Fix - storedEvent Missing Fields

## The Problem

When `storeEvent` returns an existing event, it only returns:
- `existing` (from database query - only has `id, alert_sent, alert_sent_at`)
- `updateData` (only has the fields being updated)

**Missing fields:**
- `engine` - Required for `createPostFromEvent` to build postId
- `canonical_id` - Required for `createPostFromEvent` to build postId
- `event_type` - Required for post object
- Other fields that might be needed

## The Fix

Changed line 456 to include the original `event` object:
```javascript
// Before:
return { isNew: false, event: { ...existing, ...updateData } };

// After:
return { isNew: false, event: { ...event, ...existing, ...updateData } };
```

This ensures `storedEvent` has ALL fields from the original event, plus any updates from the database.

## Why This Matters

`createPostFromEvent` needs:
- `event.engine` - to build `postId = ${event.engine}-${event.canonical_id.split(':')[1]}`
- `event.canonical_id` - to build postId and set eventId
- `event.event_type` - to set in post object

Without these fields, post creation would fail silently or throw errors.

