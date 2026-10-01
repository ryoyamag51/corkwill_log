# CorkWill Log — Shipaton 2026 Next Gen review

This is the **Next Gen Award** submission build of the existing CorkWill Log.
It runs the existing React application and Cloudflare Worker in a Capacitor iOS
app. It is a local review build, not an App Store release. All daily logging,
history, rubric editing, and exports remain free.

## Run without a paid developer account

Requirements: macOS, Xcode with an iOS simulator runtime, Node.js 22.18 or newer,
and pnpm. No Apple Developer Program membership, App Store Connect, Google Play,
Cloudflare account, production database, or email service is needed.

```sh
pnpm install --frozen-lockfile
cp .env.review.example .env.review
pnpm build
pnpm review
```

Keep the review server running. In another terminal:

```sh
pnpm ios:sync
pnpm ios:open
```

In Xcode, select the **App** scheme and an **iPhone simulator**, then Run.
Do not choose a physical device or archive/upload to a store. If the active
developer directory points at Command Line Tools, prefix Xcode CLI commands with
`DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`.

The app connects to `http://localhost:4173/`. The Mac server must stay running;
this prototype does not yet support an offline cold launch. A browser can inspect
the app at `http://localhost:4173/__review/start`, but native purchase dialogs
are available only in the iOS build.

## Sample data and isolation

The review server uses a fresh, in-memory local D1 database. It generates a
fictional `reviewer@example.test` account and seven fictional daily records.
Restarting the server resets this data and creates a new pseudonymous test
customer. Restart the simulator app after restarting the server.

The normal production Worker has no review-login route. The test-purchase
configuration endpoint is disabled unless `APP_ENV=review` and a Test Store key
are supplied by the separate local harness. Production credentials are never
loaded by this harness. Do not deploy this review server or expose port 4173
through a public tunnel.

## What to try

1. Dismiss the initial tour. Answer today's five questions. The score and saved
   state update as you answer. Complete the day after all required answers.
2. Open **History** to inspect the trend and the seven sample records.
3. Open **Settings** to inspect editable scoring, evaluation levels, language,
   day cutoff, and exports. Existing records preserve their rubric version.
4. Open **Settings → Support**. The screen explicitly labels the experience as
   free testing, and displays the price returned by RevenueCat as a *simulated*
   price. No card details or real payment are involved.
5. Tap **Try test purchase · no charge**. The native RevenueCat **Test Store
   Purchase** dialog offers valid purchase, failed purchase, and cancellation.
6. Cancel or choose a failed purchase: no supporter badge is granted. Choose a
   valid purchase: `CustomerInfo` must contain the active `supporter` entitlement
   for `corkwill_support_test` from `TEST_STORE` before the badge appears.
7. Tap **Restore test purchase** and confirm the restored message. Reopen the
   Support screen to verify that RevenueCat retains the test entitlement.

In Simulator, Page Down/Page Up can scroll the WebView using a hardware keyboard.

## RevenueCat configuration

| Setting | Value |
| --- | --- |
| Project | CorkWill Log |
| Project ID | `0a055dbe` |
| App | Test Store (`app4e91d4ce99`) |
| Offering | `default` |
| Package | Lifetime / one-time |
| Product | `corkwill_support_test` |
| Entitlement | `supporter` |
| SDK | `@revenuecat/purchases-capacitor` 13.6.0 |

The example environment file contains the **public client-side Test Store SDK
key**, which is intended to be embedded in clients. It is not a secret RevenueCat
API key. It cannot initiate a real-store payment. To use your own free RevenueCat
project, reproduce the table above and replace only that public `test_…` key.
The client rejects Apple, Google, and other real-store keys and rejects subscription
packages. There is no real-payment fallback.

Purchase identity is a hash-derived, test-prefixed ID. Daily answers, notes,
scores, and email addresses are not sent to RevenueCat by the integration.

## Validation

Verified on September 19, 2026: the web build, TypeScript check, lint, all **20
automated tests**, and the unsigned iOS Simulator build passed. Manual native
tests confirmed cancellation, failed purchase, successful Test Store purchase,
the supporter entitlement, empty restore, and successful restore. A separate
implementation review found no substantive blockers in the purchase integration
and local harness.

```sh
pnpm build
pnpm exec tsc --noEmit
pnpm lint
node --test tests/*.test.mjs
```

Tests cover scoring, sign-in, account isolation, synchronization, CSRF rejection,
disabled production purchase configuration, Test Store key restrictions,
purchase cancellation/failure, entitlement validation, restore, and concurrent
account switching. Automated purchase tests use SDK doubles; the native manual
test uses RevenueCat's real Test Store. No real store purchase is tested or claimed.

## Submission status and limitations

This entry targets **Next Gen only**. The web service predates this hackathon work;
the Capacitor iOS review build and RevenueCat integration were added for this
submission. This is not a claim that the entire app was built during Shipaton.

Next Gen replaces the paid developer account/store-listing requirement with a
public open-source repository and demo video. The project still needs a native
app and RevenueCat-powered purchase functionality. The official rules do not
explicitly guarantee acceptance of every Test Store-only implementation; the
submission must accurately disclose this build's testing-only status.

Before final submission, the owner must publish the public demo video, complete
hackathon registration, and approve the final entry and its rules. The signed-in
Devpost account was visually confirmed to use the entrant's UW student email on
September 19. Hackathon registration is still pending: its form requires a
country selection and explicit agreement to the Official Rules and Devpost Terms
of Service.

Prepared local materials:

- [97-second English demo](assets/demo-next-gen.mp4), 1920 × 1080, H.264, 24 fps.
- [Demo transcript](assets/demo-transcript.md).
- [1024 × 1024 app icon](assets/app-icon-1024.png).
- [1179 × 2556 History screenshot](assets/history-1179x2556.png).
- [1179 × 2556 restored-support screenshot](assets/support-final-1179x2556.png).
- [Devpost text](DEVPOST-DRAFT.md) and [video publication text](VIDEO-PUBLICATION.md).

The video uses the actual iOS Simulator build and fictional data. Its restore
section holds an actual screenshot of the successful restore for readability.
No production records, Mac desktop, personal tabs, or real payment appear.
The repository was made public on September 30, 2026, with the Shipaton branch
set as default. The video has not been uploaded or published; the entry has not
been submitted. The submission deadline shown by Devpost is
September 30, 2026 at 11:45 p.m. PDT.

Sources checked September 19, 2026:

- [Official Shipaton rules](https://revenuecat-shipaton-2026.devpost.com/rules)
- [RevenueCat Test Store](https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store)
- [RevenueCat Capacitor SDK](https://www.revenuecat.com/docs/getting-started/installation/capacitor)
