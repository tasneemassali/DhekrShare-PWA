# ذِكر ❤️ — DhekrShare PWA

A private Arabic-first reminder app for two paired iPhones. **This repository contains the PWA only.** It is independent of `tasneemassali/DhekrShare`; there is no Swift, Xcode project, native wrapper, or subtitle.

## Use it

Open the published site in Safari and add it to the Home Screen on each iPhone. Open the installed icon, pair the devices with a six-digit code, and explicitly allow notifications. See [SETUP.md](SETUP.md).

Seven buttons send the corresponding dhikr to the other paired device. The success message is exactly **تم الذكر ❤️**. The notification title is **تذكير ❤️**, and its body is only the dhikr. There are no sender names.

## Features

- Arabic RTL, warm rounded cards, light/dark mode, large touch targets, accessible status messages.
- Home Screen manifest, dedicated icons, service worker, notification clicks, and browser-managed navigation.
- Ten-minute, single-use pairing codes and exactly one two-device pair per deployment.
- Two-second client and atomic server cooldown; no automatic resend after ambiguous failures.
- Push subscriptions update when the app reopens; expired subscriptions are invalidated server-side.
- No Apple Developer membership, APNs key, Firebase project, or Mac is needed for this PWA.
- iPhone Safari does **not** support `navigator.vibrate`. The app uses a subtle press animation; vibration is best-effort on browsers that support it. It does not promise native iPhone haptics.

## Architecture

React/TypeScript (Vinext) → same-origin Worker API → Cloudflare D1 → encrypted standards-based Web Push → service worker notification.

The app uses `@block65/webcrypto-web-push` 2.x with RFC 8291 `aes128gcm` and RFC 8292 VAPID. Version 1.x is unsuitable for Apple; do not downgrade. Only an allowlisted dhikr ID can be sent. Push acceptance is not a delivery receipt.

| Path | Purpose |
| --- | --- |
| `app/page.tsx` | Home, pairing, installation and permission flows |
| `app/api/dhikr/route.ts`, `lib/api.ts` | Pairing, subscription, status and send API |
| `lib/dhikr.ts` | Exact seven dhikr strings |
| `lib/policy.mjs` | Validation, cryptographic randomness and token hashing |
| `db/schema.ts`, `drizzle/` | Durable database schema and migrations |
| `public/sw.js` | Push handling and notification clicks; no navigation interception |
| `public/manifest.webmanifest` | Home Screen installation metadata |
| `tests/` | Validation, real encryption and SQLite security checks |
| `.openai/hosting.json` | Site identity and logical D1 binding; no credentials |

## Access and pairing security

The Site is publicly reachable, while pairing and sending remain private. Only the Site owner may create the first pairing invitation, using the owner's verified ChatGPT sign-in once. The second phone joins with the six-digit code and does not need a ChatGPT account. After pairing, both phones authenticate using their own device cookies.

First-device enrollment verifies Sites' trusted `oai-authenticated-user-email` against the server-only `OWNER_EMAIL_HASH`. Status and invitation redemption no longer require a ChatGPT identity header. Sending and subscription changes still require a paired device credential. Sites must sanitize/verify the identity header; never expose this handler through a proxy that accepts forged identity headers.

Each browser installation receives a random 256-bit credential in a `Secure`, `HttpOnly`, `SameSite=Strict`, host-only cookie. Only its SHA-256 hash is stored in D1. The first owner-authorized device atomically claims the first slot; it can regenerate its pending code. If pairing began in a different browser, the signed-in owner can explicitly recover only an unfinished pair, revoking the old browser cookie and subscription. A completed pair cannot be taken over through this recovery action. Joining atomically consumes the code and fills the second slot. The UI never receives another device's token or push endpoint. Mutations require the configured exact Origin and JSON; joining has a global throttle.

Push endpoints are restricted to known Apple, Google and Mozilla push hosts. Redirects are rejected to prevent server-side request forgery. Only encrypted payloads go to the push service. App infrastructure processes the plaintext dhikr before encryption; this is not independently verifiable end-to-end encryption between the two phones.

No names, contacts or message history are saved. D1 retains two credential hashes, two push subscriptions and operational timestamps. The service worker never caches authenticated pages or API responses. Opening the app requires a connection; an already-open app shows its offline state and cannot send or queue messages. An administrator can erase the pair/subscriptions with the reset instructions in SETUP.

## Configuration

Server-only runtime variables:

| Name | Purpose | Secret? |
| --- | --- | --- |
| `VAPID_PUBLIC_KEY` | Browser application server key | No |
| `VAPID_PRIVATE_KEY` | Server signing key | **Yes** |
| `VAPID_SUBJECT` | Valid HTTPS contact/site URL | No |
| `APP_ORIGIN` | Exact canonical HTTPS origin for CSRF validation | No |
| `OWNER_EMAIL_HASH` | SHA-256 of the verified owner email; restricts first-device enrollment | Server-only |

These are configured through the hosting platform; values never belong in source or `.openai/hosting.json`. `.env.example` is a placeholder only. Real `.env*`, private keys, local databases and generated output are excluded from Git. Retain the VAPID key pair across deployments; replacing it requires both devices to re-subscribe.

`DB` is a persistent D1 binding. Schema migrations are generated from `db/schema.ts`, inspected, committed and applied during publication. Do not create database tables in request handlers.

## Development and validation

Use Node 22.13+ and the pnpm version in `package.json`:

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
node --experimental-strip-types --test tests/*.test.mjs
python3 tests/sql_test.py
pnpm build
```

The hosting workflow builds a Cloudflare-compatible Worker and applies the D1 migration. A GitHub source repository alone does not host the database or push backend; GitHub Pages cannot run this backend.

The actual API handler is dependency-injected for tests. Integration tests execute it against SQLite with two independent device cookies, verified-owner fixtures, an anonymous guest, real encryption, and an intercepted push transport. They do not send test notifications to real phones. Production enrollment trusts only identity verified by Sites; no test authentication bypass is deployed.

Validation covers TypeScript, policy checks, real Web Crypto encryption, SQLite pairing exclusivity and cooldowns, and production build. Actual background delivery, installation and notification permissions need acceptance testing on the user's two iPhones. Browser-specific WebMCP validation was unavailable in this environment; its optional read-only tool does not affect normal use.

## Platform limits

- iOS/iPadOS 16.4+ supports Web Push for apps installed on the Home Screen; permission must follow a user gesture.
- Delivery depends on connectivity, permission, Focus settings, OS behavior and the push provider. No silent background polling is used.
- Keep both installations and their browser data; deleting them may remove the device identity and require administrator reset.
- Owner sign-in is required for first enrollment or unfinished-pair recovery only. Paired phones use device credentials, so an expired ChatGPT login does not prevent reminders.
- Keep the pairing code private. A public page link alone cannot join a completed pair or send reminders.

Official sources: [WebKit iPhone Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Apple Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers), [Web Push library](https://github.com/block65/webcrypto-web-push).

## Pairing fix (2026-10-02)

Production logs showed HTTP 401 on guest status and pairing requests: the original handler required a ChatGPT identity even after the Site became public. The API now separates owner-only invitation creation from anonymous code redemption and paired-device operations. Regression tests run the actual API with independent sessions and cover completed-pair protection, unfinished-pair recovery, CSRF and server cooldowns.
