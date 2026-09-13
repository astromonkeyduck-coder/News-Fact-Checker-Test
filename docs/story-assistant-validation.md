# Noteworthy article companion — validation and handoff

Validated locally on September 13, 2026. The design and application integration are implemented. ElevenLabs agent configuration and real provider validation remain for the next AI, using [the setup prompt](ElevenLabs-Setup-Prompt.md).

## Implemented

- Article-specific animated invitation, suggested questions, dismissal and reopening. It appears once per article/browser session without moving focus, scrolling, requesting microphone access, or sending an AI request.
- Responsive chat with source links, explicit unavailable/error messages, image mode, labeled explanatory illustrations and image saving.
- ElevenLabs spoken answers enabled by default, ordered text chunks, stop/mute/replay, cancellation and coordination with article narration. No browser speech fallback.
- ElevenLabs call interface with real connection/speaking states, final transcripts, microphone controls and end/retry controls. The pinned official SDK loads in a local iframe only after an explicit call and valid server configuration. Closing or canceling tears down owned resources.
- Server-side article lookup for image generation and call context. Unavailable, private, withheld, mismatched or empty article records fail before provider requests.
- Privacy disclosures and a permanent AI-generated/not-evidence caption for illustrations.

## Automated results

`npm run publication:test`: **200 passed, 0 failed, 0 skipped**.

This includes 58 focused companion tests: 29 UI/conversation tests, 15 ElevenLabs speech tests and 14 ElevenLabs call/host/SDK-contract tests. The publication suite also covers article grounding, backend image and voice routes, and existing publication behavior.

Meaningful cases include escaped source links, article context, preview isolation, pending-request cancellation, late audio/call responses, complete ordered speech chunks, bounded audio caching, microphone permission errors, call resource cleanup, and the actual pinned ElevenLabs SDK override serializer. Provider responses and media resources are mocked; these are not proof of live service connectivity.

`npm run publication:build`: **passed**, producing 186 listed records, six information pages, RSS and the supplemental sitemap. The existing build also regenerated Games and preserved its URL aliases. No network calls or service writes occurred during the build.

JavaScript syntax checks passed for the companion, speech adapter, call adapter, voice host and voice-session function. The official `@elevenlabs/client@1.25.0` SDK bundle was built with its licenses and checksum manifest; rebuild with `npm run build:story-voice`.

## Browser review

Reviewed the actual local article page at 375×812, 390×844, 768×1024, 1280×900 and 1440×900. The companion stayed within the viewport with no horizontal overflow; close and send controls remained visible. Screenshots are saved under `docs/screenshots/story-ai-*.png`.

Observed automatic entrance without focus/scroll changes, dismissal persisting after reload, explicit reopening with input focus, Escape restoring focus to the launcher, image-mode controls, speech preference controls and clear preview responses. The final ElevenLabs call screen reported that calls are disabled in this preview, created no voice iframe, and returned to chat correctly. No browser console errors appeared in the final check. Reduced-motion CSS is covered by automated checks; operating-system reduced-motion behavior and assistive technology were not separately exercised.

Preview: `http://127.0.0.1:4173/article.html?id=2096717577204502980`

The preview intentionally disables AI text requests, image generation, synthesized audio and live calls. It is a design/interaction preview, with no fabricated generated content or simulated connected call.

## Remaining live validation

The local ElevenLabs API key was present; an agent ID was not found. No agent was provisioned, no live microphone/audio/image request was made, and deployment configuration was not inspected or changed.

Use the setup prompt to configure the agent's security overrides and client events, set `ELEVENLABS_AGENT_ID` server-side, and verify real TTS, two-way calls, interruption, microphone release and image generation in an authorized development/staging environment. Confirm provider/model access, function execution limits and appropriate public endpoint usage protection before production release. Keep keys out of browser assets and do not bypass preview isolation.
