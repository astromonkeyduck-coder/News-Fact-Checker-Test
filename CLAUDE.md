# Noteworthy News Engineering Instructions

You are working on Noteworthy News, a serious social-first news product with an existing deployed website/backend and a planned full native iOS app.

This project is NOT greenfield.

## Core stack

Preserve the existing stack unless an audit proves it is structurally bad:

- Static-first HTML/CSS/JS public site
- V2 lives in /v2/ and is served at / through Netlify rewrite
- Netlify Functions, Node 20, CommonJS, for APIs
- Supabase Postgres for structured data
- Supabase accessed server-side with service-role key
- RLS blocks anon access
- Netlify Blobs for web-push subscriptions
- Web Push through VAPID/web-push
- Service worker at /sw.js
- Auth0 for public/admin login
- Existing Live Story / Follow Live system
- Native iOS app should use SwiftUI, ActivityKit, WidgetKit, APNs, and UserNotifications

Do not migrate the website to Next.js, React, React Native, Expo, Capacitor, or a WebView wrapper unless explicitly instructed.

## Product direction

The native iOS app is now a full flagship Noteworthy News app, not just a thin companion.

The website/backend remains the production engine:
- public site
- admin/newsroom dashboard
- Live Story OS
- Supabase/Netlify API layer
- web push/PWA surface

The iOS app should become the best user experience:
- native
- premium
- fast
- smooth
- serious
- modern
- editorial
- trustworthy
- social-first
- not obviously AI-generated
- not a generic app template
- not a WebView

The iOS app must feel 10x better than the website while preserving the existing backend unless the backend audit proves the base is bad.

## Backend rule

Before building major app features on the existing backend, audit the backend honestly.

Do not blindly preserve the backend.
Do not blindly rebuild the backend.

Use this decision model:
- Keep: backend is solid and only needs app endpoints/docs/tests.
- Harden: backend is basically good but needs rate limits, tests, cleanup jobs, better logs, or APNs audit persistence.
- Partial rebuild: some parts are bad, but the data model/deployment stack can stay.
- Full rebuild: only if the current foundation would seriously hurt the native app.

If recommending a rebuild, explain:
- exact structural problems
- why hardening is insufficient
- migration path
- risks
- files/tables/functions affected
- what can be preserved

## Output style

Be concise and high-density.

For normal explanations:
- no fluff
- no generic encouragement
- no long intros
- no repeated summaries
- no “here’s what I did” essays unless asked

For small code changes:
- output only the modified code block, patch, or diff
- do not rewrite the entire file unless the whole file truly changed
- do not include setup guides or explanations unless needed
- if a change touches 1 function, show only that function
- if a change touches 2-3 small areas, show a minimal unified diff

For large implementation tasks:
- inspect first
- give a short plan
- implement
- summarize files changed, what works, what remains blocked

Never hide important blockers. If Apple credentials, signing, APNs keys, or real-device testing are required, say so clearly.

## Context management

Manage context aggressively.

Before reading many files, state what you need to inspect.
Do not reread unrelated files.
Do not keep restating the entire project brief.
Use the repo as source of truth.
If old assumptions conflict with actual files, follow actual files.
Prefer targeted edits over massive rewrites.
Clean up temporary files after using them.

## Model / effort guidance

For big engineering work:
- use Opus 4.8 xhigh / Extra

For backend architecture audits and final bug hunts:
- use Opus 4.8 max

For small patches:
- use high or Sonnet-level effort if available
- use patch-only output

Do not use Max for every tiny edit.

## Design quality

The app must not look AI-generated.

Avoid:
- purple gradients
- beige editorial templates
- generic SaaS cards
- boring white list apps
- childish emojis
- random glassmorphism
- fake futuristic UI
- over-spaced placeholder layouts
- obvious Apple News clone
- obvious Twitter/X clone
- generic dashboard look

Noteworthy News visual direction:
- dark mode first
- near-black base
- graphite surfaces
- crisp white typography
- Noteworthy red accent
- thin borders
- compact editorial density
- live pulse language
- status chips
- ticker-inspired motion
- premium newsroom command-center feel

The app should feel like:
Apple News polish + Bloomberg urgency + live election tracker + social-first breaking news speed.

But it must still feel like Noteworthy News.

## Native iOS requirements

Use native SwiftUI.

Required iOS surfaces:
- main app
- Live Activities
- Lock Screen
- Dynamic Island compact/minimal/expanded states
- APNs push notifications
- Notification Service Extension for rich notifications if useful
- deep links into exact stories/live stories
- notification preferences
- pairing with web/PWA identity/device state if preserving existing bridge

Do not fake Apple capabilities.
Do not claim the website alone can create Live Activities or Dynamic Island experiences.
