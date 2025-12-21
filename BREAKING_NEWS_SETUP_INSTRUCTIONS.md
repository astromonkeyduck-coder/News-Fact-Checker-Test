# Instructions for Enabling Breaking News in AI Chat

## What Was Done (Current State)

**Newsletter Generation (`generate-newsletter-html.js`):**
- ✅ Added framework for OpenAI Responses API with web search
- ✅ Enhanced prompts to require real breaking news events
- ❌ **NOT ENABLED** - `useResponsesAPI = false` on line 363
- Currently uses Chat Completions API (no web search)

**AI Chat (`noteworthy-chat.js`):**
- ❌ **NO CHANGES MADE** - Still uses Chat Completions API
- ❌ **NO WEB SEARCH** - Cannot access current breaking news
- Only has knowledge up to April 2024 (GPT-4o cutoff)

## What Needs to Be Done

### Task: Enable Web Search for Breaking News in AI Chat

The AI chat needs to be able to access current breaking news. Here are the options:

### Option 1: Use OpenAI Responses API (Recommended when stable)

**File:** `netlify/functions/noteworthy-chat.js`

**Location:** Around line 1008, replace the Chat Completions API call:

**CURRENT CODE:**
```javascript
r = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-4o",
    temperature: 0.4,
    max_tokens: 450,
    messages: messages,
  }),
});
```

**NEW CODE (with web search):**
```javascript
r = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-4o",
    tools: [{ type: 'web_search_preview' }], // THIS ENABLES WEB SEARCH
    input: messages.map(msg => ({
      role: msg.role,
      content: [{ type: 'text', text: msg.content }]
    })),
    temperature: 0.4,
    max_output_tokens: 450,
  }),
});
```

**ALSO UPDATE RESPONSE PARSING** (around line 1033):

**CURRENT:**
```javascript
const text = data.choices[0].message.content;
```

**NEW:**
```javascript
// Handle Responses API format
let text = '';
if (data.output && Array.isArray(data.output)) {
  const textContent = data.output.find(item => item.type === 'text');
  text = textContent?.text || '';
} else if (data.choices && data.choices[0]?.message?.content) {
  // Fallback to Chat Completions format
  text = data.choices[0].message.content;
}
```

### Option 2: Add Custom Web Search Function

If Responses API isn't available, create a web search function that the AI can call as a tool.

1. Create `netlify/functions/search-web.js` that searches the web
2. Add it as a function/tool in the OpenAI API call
3. AI will automatically call it when it needs current information

## Testing

After enabling:
1. Ask: "What's the latest breaking news today?"
2. Verify AI responds with actual current events
3. Check that it includes specific details, dates, locations

## Important Notes

- Responses API is in preview - may have issues
- Web search adds latency (slower responses)
- May increase API costs
- Test before production

## Current Status Summary

- **Newsletter:** Framework ready, but disabled (line 363: `useResponsesAPI = false`)
- **Chat:** No web search capability - needs to be added
- **Knowledge:** AI only knows events up to April 2024 without web search














