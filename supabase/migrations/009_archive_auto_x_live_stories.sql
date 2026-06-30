-- Auto-created live_stories rows (category X) back iOS push-to-start Live
-- Activities for new X posts. They must not appear in Developing Now — only
-- stories created manually in the admin Live Stories editor should.

UPDATE live_stories
SET archived = true,
    updated_at = NOW()
WHERE category = 'X'
  AND archived = false;
