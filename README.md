# CorkWill Log

CorkWill Log is a bilingual daily reflection app. It turns a small set of configurable answers into a daily score, preserves historical records, and makes trends easy to review.

## What works

- English and Japanese interfaces
- Configurable scoring criteria and evaluation levels
- Daily drafts and completion states
- Offline-first local saving with cloud sync when connectivity returns
- D1-backed accounts, preferences, rubrics, history, export, and account deletion
- Owner-only personal deployment through Sites authentication
- Optional email-code authentication for a later public release

## Local development

Use Node.js 22.13 or newer.

```bash
pnpm install
pnpm dev
```

The app is served at `http://localhost:3000`, with the main product at `/log`.

## Validation

```bash
pnpm build
pnpm lint
node --test tests/rendered-html.test.mjs tests/scoring.test.mjs
```

## Deployment model

The current release is deployed as an owner-only Site with a D1 database. Sites injects the authenticated owner identity, and the app creates the matching CorkWill Log profile and starter rubric on first use.

The public launch is intentionally separate:

1. Complete personal-use testing on the private Site.
2. Configure the final public sign-in policy and transactional email sender if email codes will remain available.
3. Route `corkwill.com/log*` and the related API/auth paths through Cloudflare without replacing the public `corkwill.com` origin.
4. Run privacy, abuse-prevention, accessibility, and data-recovery checks.
5. Change the Site access policy to public only after those launch checks pass.

Cloudflare routing is required for a path-based launch. A Pages or Sites custom domain attaches at the hostname level; it does not attach only one application at `/log`.
