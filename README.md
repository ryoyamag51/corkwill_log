# CorkWill

CorkWill's service homepage is served at https://corkwill.com. Its first service,
CorkWill Log, runs at https://corkwill.com/log with a personal account, configurable
scoring, daily records, history, exports, account deletion, and English/Japanese UI.

## Shipaton 2026 — Next Gen

The existing app now includes a Capacitor iOS review target with RevenueCat
Test Store support. Core features remain free; the optional supporter badge uses
a simulated, one-time purchase with no actual charge. The public production
service does not enable this testing feature.

See [the iOS review instructions](docs/shipaton/REVIEW.md) for a reproducible local
setup using fictional records, without paid developer accounts or production
credentials. [Submission draft](docs/shipaton/DEVPOST-DRAFT.md) and
[demo plan](docs/shipaton/DEMO-SCRIPT.md) are prepared locally; publication and
final submission require the owner's approval. This repository uses the
[MIT license](LICENSE); dependencies retain their own licenses.

## Infrastructure

- Cloudflare Worker `corkwill-web`, deployed from this repository using vinext.
- Cloudflare D1 `corkwill-log` stores accounts, Google identities, hashed sessions,
  scoring rules, records, and synchronization metadata.
- The `corkwill.com/*` Worker route serves the homepage, `/log`, and APIs together.
- The existing `corkwill-log.ryoyamag51.workers.dev` address retains its owner-only
  Cloudflare Access protection on the separate `corkwill-log` Worker. Public requests cannot inject Access identities.
- IndexedDB drafts and upload queues are separated by account ID. Previous
  unscoped browser storage is preserved but never imported into another account.

## Sign-in configuration

Google sign-in uses server-side authorization-code exchange, PKCE, signed state,
nonce verification, and Google's signed ID token. It requests `openid email profile`
only, with no access to Gmail messages. Matching existing verified Gmail/Workspace
accounts keep their D1 records. Sessions use secure, HttpOnly cookies.

Configure a Google OAuth **Web application** client in project `CorkWill Log`
(`fast-haiku-508507-t5`):

- Homepage: `https://corkwill.com`
- Privacy: `https://corkwill.com/privacy`
- Authorized domain: `corkwill.com`
- Redirect URI: `https://corkwill.com/api/auth/google/callback`
- Audience: External, published to Production (not limited to test users).

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `SESSION_SECRET` as Worker
secrets using Wrangler. Never commit credential files. `/api/auth/providers`
reports available sign-in methods; unavailable methods cannot be selected.

Optional email-code sign-in requires `RESEND_API_KEY`, `RESEND_FROM`, and
`VERIFICATION_SECRET`. It remains disabled until all required settings exist.

**Launch status (2026-09-13):** Public on `corkwill.com`. Google Auth is External
and In production, and the OAuth credentials are installed as secrets on
`corkwill-web`. Live Google sign-up, authenticated Log/history access, and session
persistence after reload were verified. D1 contains the new Google-linked account;
the pre-existing daily record and its update timestamp remain unchanged.

## Develop and validate

Use Node.js 22.18 or newer and pnpm.

```sh
pnpm install
pnpm dev
pnpm build
pnpm exec tsc --noEmit
pnpm lint
node --test tests/rendered-html.test.mjs tests/scoring.test.mjs
```

Tests use local Miniflare D1 and mocked Google responses to check OAuth validation,
account persistence, record isolation, export, logout, account deletion, and CSRF
rejection. They do not send email or modify production data.

## Deploy

Back up the remote D1 database outside version control before migrations. Review
pending migrations and retain the previous Worker version for rollback.

```sh
pnpm exec wrangler d1 migrations list corkwill-log --remote
pnpm exec wrangler d1 migrations apply corkwill-log --remote
pnpm build
pnpm exec wrangler deploy --config dist/server/wrangler.json --dry-run
pnpm exec wrangler deploy --config dist/server/wrangler.json
```

Verify `/`, `/log`, `/log/signin`, `/privacy`, `/api/auth/providers`, and unauthenticated
API rejection on the live domain. Check D1 record counts after deployment.

## Release versions

`package.json` is the source of the app's semantic version. Log and sign-in footers display it, including on phones. Before a release, update that version and `CHANGELOG.md`; use the matching `vX.Y.Z` Git tag and Cloudflare deployment tag. Cloudflare also assigns its own deployment UUID, which identifies the upload rather than the app release number.
