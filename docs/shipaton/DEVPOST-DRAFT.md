# CorkWill Log

**Target category: Next Gen Award only**

## Elevator pitch

A quiet daily reflection app with rules you control: answer five questions,
understand your day, and notice patterns without paying to access your own progress.

## Inspiration

A generic habit streak does not always capture what made a day feel meaningful.
CorkWill Log starts with a small set of questions about body, attention, and
connection, then lets each person change the questions, point values, and
evaluation labels. The aim is a clearer reflection at the end of the day, with
room for a person's priorities to change.

## What it does

CorkWill Log turns a few daily answers into a visible score and a history of
patterns. It saves answers as the person works, keeps local drafts and pending
syncs separate for each account, supports English and Japanese, and lets users
export their records. Timezone-aware day boundaries support people whose day
does not end at midnight. Records retain the rubric version used at the time.

Core features remain free. The Next Gen iOS build adds an optional **Support
CorkWill** experience using RevenueCat Test Store. A successful one-time test
purchase activates a supporter badge. Cancellation, failure, entitlement checks,
and restoration are handled explicitly. No real payment, card details, or
recurring subscription is involved in this submission build.

## How we built it

The existing app uses React, TypeScript, vinext, Cloudflare Workers, and D1.
For Shipaton, we added a Capacitor iOS target and the RevenueCat Capacitor SDK.
RevenueCat provides the offering, product information, native test purchase
dialog, customer purchase state, and `supporter` entitlement. The UI grants the
badge only after checking the active entitlement for the expected Test Store
product; it does not simulate a successful purchase with a local flag.

A local review harness runs the same application with an isolated database and
fictional records. Judges can reproduce the iOS experience without paid Apple or
Google developer accounts, production credentials, or access to personal logs.

## Challenges

Integrating a native purchase lifecycle into an existing web app required care
with account identity, asynchronous SDK operations, error states, and restoration.
The integration serializes SDK operations so an account change cannot accidentally
reuse another account's purchase state. It accepts only Test Store keys and the
expected non-recurring product. Local authentication for review is confined to a
separate loopback server instead of adding a sign-in bypass to production.

## What changed during Shipaton

CorkWill Log already existed as a web app. The work for this entry adds the iOS
review target, RevenueCat Test Store integration, supporter UI, purchase tests,
local reviewer setup, and submission materials. This entry does not claim a store
launch or real revenue. AI-assisted coding and research were used under the
entrant's direction.

## What's next

Learn whether optional support is useful without restricting access to personal
records, improve the native experience, and evaluate store distribution after the
prototype. There is no commitment to spend money or launch paid subscriptions.

## Built with

TypeScript, React, Capacitor, RevenueCat, Cloudflare Workers, Cloudflare D1,
vinext, Vite, Swift Package Manager.

## Fields to complete before submission

- Category: **Next Gen Award**.
- RevenueCat project ID: `0a055dbe`.
- Repository: [public Shipaton submission branch](https://github.com/ryoyamag51/corkwill_log/tree/codex/shipaton-next-gen).
  The `codex/shipaton-next-gen` branch is the repository default, and GitHub
  recognizes the visible MIT license.
- Demo video: insert the approved, publicly visible YouTube/Vimeo URL, under two
  minutes, showing this iOS build. Local video: `assets/demo-next-gen.mp4`
  (97 seconds; 1920 × 1080; English explanation).
- Icon: `assets/app-icon-1024.png` (1024 × 1024).
- Screenshots: `assets/history-1179x2556.png` and
  `assets/support-final-1179x2556.png`, each 1179 × 2556 with no device frame.
- Devpost account email: the UW student email was confirmed in the signed-in
  account settings on September 19, 2026. Academic eligibility remains the
  entrant's attestation.
- Registration: not yet completed. The registration form requires a country and
  agreement to the Official Rules and Devpost Terms of Service. Obtain the
  owner's country answer and consent before completing it.
- Testing instructions: use `REVIEW.md`.

**The GitHub repository was made public with owner approval on September 30,
2026. Public video release and final Devpost submission remain subject to the
owner's separate approval.**
This text is a draft; it has not been entered or submitted on Devpost.
