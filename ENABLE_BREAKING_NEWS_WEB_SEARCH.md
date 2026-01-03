# How to Enable Breaking News / Web Search for AI Chat and Newsletter

## Current Status

**What was done:**
- Added framework for OpenAI Responses API with `web_search_preview` tool
- Enhanced prompts to require real breaking news events
- Framework is in place but **NOT ENABLED** (useResponsesAPI = false)

**Why it's disabled:**
- Responses API is still in preview (as of Dec 2025)
- Chat Completions API is more stable for production
- Need to test Responses API before enabling

## How to Enable Web Search for Breaking News

### Option 1: Enable Responses API (When Stable)

**For Newsletter Generation** (`netlify/functions/generate-newsletter-html.js`):
1. Find line 363: `const useResponsesAPI = false;`
2. Change to: `const useResponsesAPI = true;`
3. This enables real-time web search for current breaking news

**For AI Chat** (`netlify/functions/noteworthy-chat.js`):
1. Find the OpenAI API call around line 1005
2. Replace Chat Completions API with Responses API:

```javascript
// OLD (Chat Completions):
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

// NEW (Responses API with web search):
r = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-4o",
    tools: [{ type: 'web_search_preview' }], // Enable web search
    input: messages.map(msg => ({
      role: msg.role,
      content: [{ type: 'text', text: msg.content }]
    })),
    temperature: 0.4,
    max_output_tokens: 450,
  }),
});
```

3. Update response parsing (around line 1033):
```javascript
// OLD:
const text = data.choices[0].message.content;

// NEW (Responses API):
let text = '';
if (data.output && Array.isArray(data.output)) {
  const textContent = data.output.find(item => item.type === 'text');
  text = textContent?.text || '';
}
```

### Option 2: Add Custom Web Search Function (Alternative)

If Responses API isn't available, add a web search function that the AI can call:

1. Create a web search function in `netlify/functions/search-web.js`
2. Add it as a tool/function in the OpenAI API call
3. AI will call this function when it needs current information

## Testing

After enabling:
1. Test with: "What's the latest breaking news today?"
2. Verify AI can access current events
3. Check that responses include real, specific details

## Important Notes

- Responses API is in preview - may have rate limits or instability
- Web search adds latency (searches take time)
- May increase API costs
- Test thoroughly before production use

## Current Knowledge Cutoff

- GPT-4o: Knowledge cutoff is April 2024
- Without web search: AI only knows events up to April 2024
- With web search: AI can access current events in real-time

















