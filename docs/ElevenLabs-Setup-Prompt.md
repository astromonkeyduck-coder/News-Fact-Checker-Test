# Ready-to-paste prompt: finish the Noteworthy ElevenLabs connection

Work in `/Users/richarda/breaking-news-game`. Finish connecting and validating the existing Noteworthy article AI companion. Its design, automatic entrance, chat, image controls, speech controls and voice-call interface have already been built. Preserve that design and the user's other changes.

**ElevenLabs is mandatory for spoken answers and live voice calls. Do not substitute browser speech synthesis, OpenAI Realtime, or another voice provider.** Text answers and explanatory images use the existing OpenAI-backed Noteworthy chat service; that is separate from the voice requirement.

Read `docs/article-companion-backend.md` and the current implementation before editing. The important files are `publication/story-assistant.js`, `publication/story-assistant.css`, `publication/story-speech.js`, `publication/story-voice.js`, `netlify/functions/elevenlabs-tts.js`, `netlify/functions/story-voice-session.js`, and `netlify/functions/lib/articleCompanion.js`. Inspect the dedicated SDK build script, vendor files and voice-frame files alongside them. The official browser SDK is pinned to `@elevenlabs/client@1.25.0` and bundled locally; retain the lockfile and regenerate its bundle when changing it.

## Connect the ElevenLabs agent

The local configuration had `ELEVENLABS_API_KEY`, but no `ELEVENLABS_AGENT_ID` was found. Deployment configuration has not been checked. Inspect the existing ElevenLabs/Netlify setup without printing secrets. Reuse a suitable existing Noteworthy agent if one exists, or configure a dedicated article companion in the authorized ElevenLabs account. Keep the agent ID in server configuration as `ELEVENLABS_AGENT_ID` and the API key as `ELEVENLABS_API_KEY`; never place the durable API key in browser assets.

The agent must support authenticated WebRTC conversation tokens and permit these Security overrides: **System prompt, First message, Tools, Knowledge base, Language**. Enable the Advanced/client events **`agent_response`, `user_transcript`, and `audio`** so the SDK receives the final transcripts and voice events used by the interface. Configure the base agent with no unrelated tools, external actions, or unrelated knowledge base. Use a natural editorial voice; keep answer narration and call voice consistent where practical. The existing narration endpoint defaults to ElevenLabs Rachel (`21m00Tcm4TlvDq8ikWAM`) with `eleven_multilingual_v2`; inspect the actual current constants before choosing configuration.

`POST /.netlify/functions/story-voice-session` receives `{pageContext:{articleId}}`. The server loads that exact eligible public record and returns `{provider:'elevenlabs',conversationToken,overrides,articleId,articleUrl}`. Pass the returned token and overrides intact to the ElevenLabs SDK. For the pinned SDK, nested prompt fields are `prompt`, `tool_ids:[]`, and `knowledge_base:[]`; `agent.firstMessage` is camelCase in the client interface and `agent.language` is `en`. Never recover an override error by dropping the article context or empty tool/knowledge lists. Inspect the real agent and SDK handshake to confirm the override permissions and field names are accepted.

Keep the source restrictions: the AI identifies itself as AI, attributes claims to the article, distinguishes uncertainty, and does not claim to have fetched source links or verified the story independently. Missing, withheld, draft, mismatched or empty records must fail clearly before a voice session or explanatory image is generated.

## Verify spoken answers and calls

Spoken answers are on by default after a successful reader question. They use `POST /.netlify/functions/elevenlabs-tts` with `{storyAnswer:true,text}`. The browser sends ordered chunks of at most 900 characters; the server rejects oversized answer chunks rather than silently shortening them. Confirm the whole answer is read, in order, with working mute, stop and replay. Replay uses only a bounded in-memory audio cache. Test muted state while a question is pending, stale responses, permission/autoplay failures and interruption by article narration. No audio request should happen merely because the invitation opened.

For voice calls, verify an explicit Call click, microphone permission, connection, greeting, two-way conversation, visible final transcripts, microphone mute/unmute, interruption, and end-call behavior. Verify the microphone indicator turns off and that pending startup, errors, closing the companion, backgrounding and navigation release all owned microphone, SDK, peer-connection and audio resources. Review the same-origin voice iframe and its permissions/cleanup; the SDK does not expose a general startup AbortSignal. Do not allow a timed-out or canceled startup to revive a call later.

Confirm appropriate agent concurrency/usage limits and endpoint protection for the intended public site before enabling production traffic. Report real provider errors rather than replacing them with simulated success.

## Preserve images and the finished interface

“Make a visual” sends `{articleImage:true,message,pageContext:{articleId}}` to `/.netlify/functions/noteworthy-chat`. It uses the authoritative article record, returns a bounded PNG data URL, and displays a permanent AI-generated/not-evidence caption. Verify a real explanatory image request, source-unavailable behavior, provider timeout and image save. Do not remove the caption or present generated imagery as a news photograph. Check the current deployed image model access and function execution limit; the existing backend uses a 45-second provider timeout plus source lookup.

Keep the assistant article-scoped. Its invitation opens once per story/browser session, with no focus steal or AI request on appearance. Preserve dismissal/reopening, the suggested questions, reduced-motion styling, readable source links and the responsive design. Update the privacy text only to reflect the actual configured data flows.

## Validate and hand back

Run `npm run build:story-voice` when changing the SDK bundle, followed by `npm run publication:test` and `npm run publication:build`. The dedicated voice frame is `publication/vendor/story-voice-frame.html`; its resource cleanup is in `publication/vendor/story-voice-host.js`. Preserve the bundled SDK license and checksum manifest. Test at 375/390/768/1280/1440-pixel widths and with keyboard controls. Read `docs/story-assistant-validation.md` for the checks already completed. Document the exact agent settings, environment variable names, remaining limitations, and the live checks actually completed.

**The server at `http://127.0.0.1:4173/` intentionally disables live AI requests, image generation, ElevenLabs speech and calls.** Its unavailable notices are deliberate. Use an appropriate Netlify development/staging environment with server credentials for live validation; do not defeat that preview isolation by exposing keys in the client. Apply changes to production only if the user has separately authorized deployment.

Return a working test URL, a concise explanation of what you configured, and concrete evidence that ElevenLabs speech and calls both work. Do not claim live verification based only on mocks.

Official references: [ElevenLabs JavaScript SDK](https://elevenlabs.io/docs/eleven-agents/libraries/java-script), [conversation token](https://elevenlabs.io/docs/api-reference/conversations/get-webrtc-token), [overrides](https://elevenlabs.io/docs/eleven-agents/customization/personalization/overrides), [text-to-speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert).
