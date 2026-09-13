# Editorial identity and integration evidence

Inspected September 12, 2026 in the isolated development copy. This is a source-code audit, not confirmation of production secrets, delivery, account settings, contractual retention, legal compliance or ownership records. No live subscriber messages, account preference changes or production editorial writes were made.

## Identity, responsibility and funding

| Observation | Evidence | Safe reader wording / dependency |
| --- | --- | --- |
| Richard is identified as co-founder and site developer; the legacy footer also names Chase and Jack as founders. | `index.html` author metadata, opening comment and footer; `our-mission.html`; `v2/index.html` signatures. | Existing first-name attribution may be retained where relevant. It does not establish a full name, biography, reporting role, credentials or ownership entity. Ask the owner to verify these before publishing full profiles. |
| Public email is `richard@noteworthynews.co`. | `contact.html`; `send-contact-form.js` default recipient; `our-mission.html` contact links. | “Tips, corrections and general inquiries: richard@noteworthynews.co.” Delivery was not tested. Contact destination can be overridden with `ADMIN_NOTIFICATION_EMAIL`. |
| The mission and policy describe independent operation and advertising support; AdSense is configured in public pages. | `our-mission.html#...`, `editorial-policy.html#advertising`, AdSense script/placements. | “Noteworthy News describes itself as independently operated. The site carries advertising through Google AdSense.” Code does not establish revenue, sole funding source, legal owner, investors or donor policy. Avoid invented funding totals or affiliations. |
| Existing policy makes strict verification and human-review promises that imported records do not independently prove. | `editorial-policy.html#accuracy`, `#ai`; automated ingestion code. | Present these as editorial rules; label existing agency summaries accurately. Do not add a human author or “reviewed” stamp without an actual recorded review. |

No verified full names or author portraits were found for new profiles. No full name was inferred from local filesystem paths. No employees, readership figures, credentials or award claims were added by this work.

The contact page now removes unsupported response-time and anonymity promises. The form uses Resend to send an email to the configured inbox; `subject` differentiates tips and corrections in the email subject, not a proven staffed queue. `?subject=correction&article=<encoded URL>` preselects that form and includes the complete article URL. The form and ordinary email are not anonymous or secure-drop channels. Discuss confidentiality before sensitive material is sent.

## Subscription and authentication map

| Feature | Source evidence | Meaning and remaining verification |
| --- | --- | --- |
| Newsletter / important news emails | `netlify/functions/send-email.js`, `send-newsletter.js`, `emails/noteworthy/*`; `RESEND_AUDIENCE_ID` | Signup adds a contact to one Resend audience and sends a welcome message. `source: "breaking-story"` customizes the welcome; it does not create a distinct breaking-alert audience or per-story subscription. Do not offer independent digest/breaking toggles that have no backend representation. Do not promise an exact weekly schedule from templates alone. |
| Earthquake email alerts | `netlify/functions/lib/emailPreferences.js`, `email-preferences-link.js`, earthquake email sender | Explicit `earthquakeAlerts === true`, default false; minimum magnitude 6 or 7. Distinct from the general audience. Existing preferences are stored in `user-data`. |
| Location and game email settings | Same preference helper and page | `location` defaults false; `leaderboard` and `streak` default true. These are not alternate editorial newsletter types. |
| App announcements | `NewFeatureAnnouncementEmail.js`, newsletter templates; no separate preference field found | A template exists, but an independently selectable app-announcement email subscription was not found. Avoid offering a false toggle. |
| Preferences links | `newsletter-preferences.html`, `email-preferences-link.js`, `send-email.js` | This legacy path uses `?email=<base64 address>`, not a signature or authentication token. Public visits now show useful instructions without an API request. Existing parameterized links remain valid. Loading errors block edits; failed saves visibly revert to last loaded settings. |
| Unsubscribe | `unsubscribe.html`, `netlify/functions/unsubscribe.js`; sender links | Preserve all existing inbound link formats. This audit did not rewrite signing, remove audience entries or send confirmation emails. Some paths remove contacts and can send follow-up surveys. End-to-end behavior needs a test subscriber. |
| Public/admin login | `src/auth/auth0.js`, `@auth0/auth0-spa-js`, auth helpers | Auth0 exists, with public/admin flows and profile data. A configured test login is required to verify the hosted callback and actual permissions. Authentication code does not verify editorial biographies. |
| Browser push / live follows | `push-subscribe.js`, `notification-preferences.js`, Live Story functions | Distinct from email; browser endpoints/keys and subscription preferences. At least one unsubscribe path marks records inactive, so privacy copy must not promise immediate record deletion. |

The unsigned legacy email-preference endpoint is an access-control dependency: knowing an email can identify its preference record. Its migration needs owner review, a signed-link transition and backward compatibility; a cosmetic token label does not secure it. No such migration is represented as finished in this release.

## AI data flow and retention

| Flow | Repository evidence | Actual behavior / limitation |
| --- | --- | --- |
| Assistant requests | `netlify/functions/noteworthy-chat.js` request parsing, document extraction, OpenAI chat call; `src/widgets/noteworthy-chat.js` | Sends message, recent history (server caps to 10 messages), page URL/title/article ID, submitted images, and extracted PDF/DOCX/text/CSV content to OpenAI. Grounding uses publication data and optional search. Citations are requested in prompts; a prompt alone is not proof every generated answer is supported. |
| Web search | `netlify/functions/search-web.js` | Search queries go to Google News RSS and/or DuckDuckGo endpoints. Do not claim all questions remain inside Noteworthy's servers. |
| Uploaded assistant images | `noteworthy-chat.js` uploaded-images block; `get-uploaded-image.js` | Image data and metadata can be persisted in Netlify Blobs. Retrieval uses a generated URL; the image endpoint is not a private authenticated vault. No fixed cleanup for these uploads was found. |
| AI logging and personalization | `noteworthy-chat.js` log/history blocks; `log-data.js`; `get-ai-personalization.js` | Interaction/response data, upload URLs, IP information and associated email can enter `analytics-data`. Personalized context may contain inferred names, interests and preferences keyed by email or IP. No fixed expiration/deletion schedule is enforced in the reviewed code. Some logging is best effort; do not interpret code presence as proof every log was persisted. |
| Admin notification emails | `noteworthy-chat.js` Resend block | When `RESEND_API_KEY` and `AI_NOTIFICATION_EMAILS` are configured, excerpts, recent conversation and stored image links can be sent to configured recipients. Other analytics notifications can use `ADMIN_NOTIFICATION_EMAIL`. Actual configuration was not read or tested. |
| Live voice | `realtime-voice.js`, `src/widgets/noteworthy-chat.js` OpenAI realtime WebSocket | Uses OpenAI session/token flow and sends voice data to OpenAI. Device/browser speech synthesis is also used for read-aloud. `elevenlabs-tts.js` exists; `ENABLE_ELEVENLABS_VOICES` is currently false in the widget. |
| Image generation | `noteworthy-chat.js` image-generation/editing paths | OpenAI image APIs receive prompts and relevant images. Generated imagery must not be presented as documentary event photography. |
| Direct transcription | `transcribe-direct.js` | Small audio uploads go through the function to OpenAI Whisper, without the separate stored-upload path. Provider retention cannot be deduced from this. |
| Stored transcription | `get-upload-url.js`, `upload-blob.js`, `transcribe-from-url.js`, `create-job.js`, `process-job.js` | Netlify Blobs fallback / Cloudflare R2 direct upload. Successful transcription attempts source-audio deletion; large-job transcripts remain in R2 and job records in Supabase. Failed/abandoned uploads and cleanup failures are possible; no universal deadline is guaranteed. |

Accurate short reader disclosure: “AI answers are generated and may be wrong; they are not edited reporting. Messages, recent conversation and files you submit are processed by OpenAI. Noteworthy can store interactions and uploaded images. Do not submit confidential material. Contact richard@noteworthynews.co for data requests. Closing the assistant does not delete stored records.” The expanded disclosure is implemented at `/privacy.html#ai`.

There is no observed self-service deletion endpoint for assistant records or uploaded images. An owner needs to establish a retention schedule, cleanup procedures and provider account settings before making stronger privacy statements. This work documents actual limitations rather than claiming automatic deletion, no training, no logging, anonymity or a provider retention period unsupported by configuration.

### Assistant grounding repairs in this release

`noteworthy-chat.js` applies the publication source-quality projection before building model context. Draft, review, suppressed and ambiguous records are excluded. Agency records are labeled as automated summaries; ordinary updates no longer receive a blanket “verified reporting” label. Context distinguishes claim status from coverage lifecycle, preserves linked upstream/distribution source roles, and calls truncated body text an excerpt.

`publicationAiGrounding.js` supplies a transparent fallback for recognizable news requests when both the eligible publication registry and search-source registry are empty. Existing image, document, email-confirmation and spotlight functions retain their paths. Source chips now require an explicit citation to an exact offered registry URL; uncited search results and URL-prefix matches do not qualify. These checks establish citation membership, **not factual entailment**. Available but irrelevant context, incomplete excerpts, and generated answers to attached files still require judgment and prompt-level limitations.

`node --test tests/publication/ai-grounding.test.js` passed 8 local tests for source projection, private-state exclusion, agency attribution, distribution links, exact cited-source matching, balanced URL parentheses, missing-source fallback and preservation of other tools. `node --check netlify/functions/noteworthy-chat.js` passed. No model, search, voice, email or production-record calls were made for this validation.

## Advertising and consent

Existing pages load AdSense and the cookie banner. The original `src/components/cookie-banner.js` stores `cookieConsent` and dispatches a consent event; its legacy accept/reject path primarily updates `gtag`'s `analytics_storage`. It does not prove that preloaded ads are blocked or that all advertising consent signals reach providers. Preserve the existing stored consent choice; verify actual network behavior on the redesigned pages for accepted, rejected, absent and expired consent. Ad placement and consent changes in the publication release must be evaluated against their actual code and browser tests. Do not claim WCAG or legal compliance from a banner or automated score.

## Checks run and checks still needed

**Run locally:** `node --test tests/publication/editorial.test.js` — 17 tests passed. Covers substantive workflow behavior, a full local CLI trial without service credentials, safe preview HTML, empty preference landing without requests, visible failed loads, failed save rollback, preservation of the existing unsubscribe query, and article correction form context. No live records were read through private credentials or mutated by these tests.

**Not run with live accounts:** Resend audience enrollment, welcome delivery, newsletter/breaking delivery, earthquake delivery, unsubscribe/survey delivery, preference persistence, Auth0 login/callback, app pairing/APNs, OpenAI/voice/ElevenLabs requests, admin AI emails, blob cleanup and provider deletion. These require an owner-provided test account, test recipients and isolated service configuration. A successful mocked preference UI is not proof of Resend delivery or server authorization.

**Owner/editorial dependencies:** verified full identities and bios; actual ownership entity and complete funding description; primary evidence for stories with only distribution links; approval of ambiguous imported research/recall material; AI retention/deletion controls; a signed preference-link migration; provider/consent verification. These dependencies do not prevent the local reading experience and reviewable first release from being completed.
