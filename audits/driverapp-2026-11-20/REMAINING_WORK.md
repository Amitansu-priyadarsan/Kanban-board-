# DriverApp — what is left after the 20 November audit

This turns the [20 November screen and backend audit](README.md) into a work list: the bugs to fix first, the work left in the frontend, in the backend, and in both. It is built from the audit's 139 current-plan rows and its 20 findings. The app was not re-run for this document; branch status was rechecked on 20 November 2026.

- **Frontend** means the DriverApp repo (React Native). **Backend** means main-backend.
- File and line references come from the audit and point at the audited commits.
- Plan IDs (A01, D05, M15 …) are the audit's IDs. Every one of the 139 rows appears in [Appendix A](#appendix-a--all-139-plan-rows).
- Sections 1–8 describe the audited commits. The update below and Appendix A show the state after the fixes.

## Update — after the fixes (20 Nov)

All 11 defects in section 1 are fixed in code and pushed to the release branches. None has been run on a device yet, so no row moved to Done. PR #27 is also merged into DriverApp `main` (`5a0de18`), so merging the release branch into `main` later adds only `21aff0e`.

| Commit | Branch | Fixes |
|---|---|---|
| `77ec5482` | backend `release/en-24-nov-backend` | I04, I05 — v2 responses are checked as the JSON the app receives |
| `21aff0e` | DriverApp `release/en-24-nov-driver-app` | I01 (app 2.0.0 sends `X-App-Version`), I02, I03, I07, I15, I20 |
| `42d0cb9` | DriverApp `release/en-24-nov-driver-app` | Merge of PR #27 (Rahul): I06, I08, I09 |

| Bucket | At the audit | Now | What moved |
|---|---|---|---|
| Bug | 8 | **0** | All 8 failing screens work in code now |
| Frontend left | 61 | **61** | In: D03, D05, D42, M01 (they work, but planned parts are still missing). Out: M14, O01, F03, F04 (only the bug was left) |
| Frontend and backend left | 17 | **17** | — |
| Phase 2 navigation | 11 | **11** | — |
| Built, needs device testing | 12 | **20** | In: O13, F02, F05, F07, M14, O01, F03, F04 |
| Done | 29 | **29** | — |
| Legacy, do not build | 1 | **1** | — |
| **Total** | **139** | **139** | |

**Findings:** 11 defects fixed; 9 still open — 8 planned gaps (I10, I11, I12, I13, I14, I16, I17, I19) and 1 decision (I18).

**Found while fixing, not in the audit:**

- The app calls `stopQuestions` with GET and `routeOptions` with GET, but the contracts are `POST /app/v2/stops/:vehicleId/questions` and `POST /app/v2/routes`. Neither screen has a menu entry yet (D32, Phase 2), so nothing breaks today.
- Two backend tests fail on the release branch with or without these fixes: `driverDuty.db.test.js` ("answers 409 when the open-interval index refuses the new F1 row" gets 500) and `fuelFills.db.test.js` ("a driver sees the fill the backend detected, with his bill attached").
- The app is now version 2.0.0. Its `runtimeVersion` follows the app version, so this release needs a new binary; an OTA update will not reach 1.0.1 installs.
- The crew screen no longer shows a handover history list or paging: the v2 crew API has no history endpoint. The timeline shows the at-wheel intervals with their status.

## Branch status

| Repo | Status on 20 Nov | What it means |
|---|---|---|
| DriverApp | `main` and `release/en-24-nov-driver-app` are the same commit, `73a415f`, which is the audited commit. `feat/owner-experience-completion` is already merged into it. | Every finding below still applies. |
| Backend | `release/en-24-nov-backend` is still the audited commit `77d257c5`. `main` has 37 newer commits; all are fuel-integrity, DEF-balance and performance work, and none touch the mobile API. | No finding is fixed on either branch. |
| Backend risk | `main` is missing 15 commits that are only on the release branch. They include 7 owner-experience services that do not exist on `main`: `ownerCrew`, `ownerPromise`, `ownerTripCosts`, `ownerEtaRisk`, `ownerEvidence`, `ownerGroups` and `ownerDistribution`, plus explicit crew handovers, the driver SSE stream and owner capture/document review. | Merge the release branch into `main` before `main` becomes the deploy branch, or the backend for O15–O18 and the owner capture review disappears. |

## Summary at the audit

| Bucket | Plan rows | Meaning |
|---|---|---|
| **Bug** | 8 | The screen exists but failed in the tested flow. Section 1 lists the 11 defects behind these and other rows. |
| **Frontend left** | 61 | The backend is ready (or not needed); the work is in DriverApp (section 2). |
| **Backend only** | 0 | No screen waits on the backend alone. Backend work is 2 bugs, 1 contract, 1 policy and 1 merge (section 3). |
| **Frontend and backend left** | 17 | Both sides are missing or partial (section 4). |
| **Phase 2 navigation** | 11 | Navigate and driving journey, kept out of Phase 1 (section 5). |
| **Built, needs device testing** | 12 | Code exists but was only checked in source (section 7). |
| **Done** | 29 | Verified within the tested scope (section 8). |
| **Legacy, do not build** | 1 | F06, old fuel wizard pages that the current form replaces. |
| **Total** | **139** | |

**The backend is ahead of the app.** 108 of the 139 rows already have a backend endpoint, and 12 more need none. Most remaining work is in the frontend: wiring existing APIs, adding menu entries for screens that are already built, and finishing partial screens.

**Fix I01 first.** The app does not send the app version that the v2 API requires, and this alone blocks Manager Home, the Driver's crew, help and rest screens, and the Owner capture review. Fixing it will then expose two backend crashes (I04, I05) that it currently hides, so ship all three together.

---

## 1. Bugs — fix these first

Eleven of the audit's 20 findings are defects. The other nine are planned gaps or a policy question; they appear in sections 2–6.

| ID | Bug | Fix in | Severity | Screens it breaks | Fix |
|---|---|---|---|---|---|
| **I01** | The app does not send `X-App-Version`. The server then assumes 1.0.0, but v2 routes need 2.0.0, so they answer HTTP 426. The app's configured version is 1.0.1, so sending the header alone still fails. Screens show a raw "Request failed with status code 426". | Both | Blocker | M01 Manager Home, D03 crew widget on My truck, D05 Crew, D06 Rest & hours, D42 Driver help, O13 Capture review | Agree the release version contract. The app sends its real build version; the backend returns an update-required response the app can act on; the app shows an update screen (A13). Evidence: `telematicsApi.js` |
| **I06** | The Field Agent Orgs tab crashes on load: "Cannot read property length of null". `useApi` starts with `data: null` and the screen reads `orgs.length` before checking. | Frontend | Blocker | F02 Organisation selection | Treat null or error data as an empty list; retest first load, retry and org switching. Evidence: `FieldAgentOrgsScreen.js`, `hooks/useApi.js` |
| **I02** | The Owner capture queue calls the driver endpoint `/app/v2/captures?page=1`, which returns 403 to an owner. The owner endpoint `/app/v2/captures/review` works (200). | Frontend | High | O13 Capture review, O14 paper decisions | Call `/captures/review` with its response schema and paging, then test review decisions. Evidence: `telematicsApi.js:514` |
| **I03** | Crew calls the wrong URLs (`/crew/me`, `/crew/vehicles/:id` instead of `/crew`, `/crew/:vehicleId`, `/crew/:vehicleId/actions`), sends `expectedVersion` and `safelyStopped`, which the schema rejects, and expects a flat response while the API returns nested `crew`/`atWheel`. | Frontend | High | D05 Crew, M14 Crew management, M05 crew reader | Align the API helpers and screen adapters with the mounted contracts, then test join, at-wheel, handover and history. Evidence: `CrewScreens.js`, `crew.schema.js` |
| **I04** | `GET /app/v2/duty/today` returns 500 with real duty data: `evidence.counted[0].start must be string or null`. Date objects are not serialised before response validation. | Backend | High | D06 Rest & hours, D07 Break planner (hidden behind I01 today) | Serialise Date fields before the response check; test populated and empty duty days. Evidence: `app/driverApp/api/routes/duty.controller.js` |
| **I05** | `GET /app/v2/help` returns 500 with real alerts: `cards[0].raisedAt must be string or null`. Same cause as I04. | Backend | High | D42 Driver help, D41 Helpful cards (hidden behind I01 today) | Serialise Date fields before the response check; retest real alert cards. |
| **I20** | v2 writes need an `Idempotency-Key` header, and the app never sends one. Consent POST returns 400 even though its minimum version is 1.0.0; crew actions also return 400. | Frontend | High | A08 Consent, D05 Crew actions, D14 Capture, D31 Prompts | Create one stable key per submission, keep it across retries, and handle conflicts. Evidence: `telematicsApi.js`, backend `app/driverApp/api/router.js:409` |
| **I07** | Field Agent logout: `POST /app/v1/auth/logout` returns 400 because `X-Org-Id` is missing. The phone signs out, but the server session stays alive. | Frontend | High | F07 Profile / logout, A14 Session recovery | Pass the active org into `revokeAppSession`; keep local sign-out working if the network call fails. Evidence: `AuthContext.js:149`, `services/api.js:169` |
| **I08** | The truck chosen in the Field Agent picker is lost: `FuelLogFormScreen` ignores the route params and starts with no vehicle ("Vehicle: Choose"). | Frontend | Medium | F03 Vehicle picker, F04 Fuel capture | Read the chosen truck from the params, check it belongs to the current org, and load its driver and last reading. Evidence: `FuelLogFormScreen.js:69` |
| **I09** | The Fuel log always shows "August" and "Improving", even in November and for an org with no data. Both are hard-coded text. | Frontend | Medium | F05 Fuel log | Compute the period and trend from the loaded records, or show "unknown" when there is no usable history. Evidence: `FuelLogScreen.js:84` |
| **I15** | Owner → More → "Today's business report" opens a full-screen report with no back button and no tab bar. | Frontend | Medium | O01 Today report | Add a back control to this stack route, or send it to the Today tab; test on iOS and web. Evidence: `OwnerScreens.js`, `OwnerReportScreens.js` |

The plan matrix also notes one smaller frontend bug: **D21** "Request an advance" has an empty button handler. It is inside the inactive wallet screens, so it only matters once those are wired (section 2.1).

**Suggested order**

1. I01, I04 and I05 in one release. This clears the version error on 6 screens (M01, D03, D05, D06, D42, O13) and makes Rest & hours and Driver help load. D05 and O13 then still need I03/I20 and I02.
2. I06, I02, I03 and I20. These make the Field Agent org switch, owner capture review, crew and consent work.
3. I07, I08, I09 and I15. These are smaller fixes to individual flows.

---

## 2. Frontend left — the backend is ready (61 rows)

### 2.1 Quick wins: built but hidden (14 rows)

These screens are already written. Users can't reach them because no menu item points to them (9 rows) or because the component is never mounted (5 rows). Mostly this is navigation wiring, then a test of each flow.

| ID | Screen | State | What to do |
|---|---|---|---|
| A08 | Privacy and consent | Route, no menu entry | Add a Settings entry. Also fix I20 (writes fail) and note that withdrawing consent does not stop all location sampling. |
| D02 | Operational Home | Route, no menu entry | Decide whether it returns as a tab or entry point; the older wallet hero and on/off-duty designs are not in it. |
| D06 | Rest & hours | Route, no menu entry | Add an entry. Blocked by I01 and I04. |
| D16 | Document reminders / renew / retake | Route, no menu entry | Add an entry; the reminder list, correct-record actions and retake decision are still to build. |
| D29 | Road report form | Route, no menu entry | Add it to Capture; also needs I01 and a stable ID per attempt for retries. |
| D32 | Manual stop explanation | Route, behind a secondary Quick add menu | Expose it in the main Capture menu. |
| D33 | Plant / gate Site Card | Route, no menu entry or push tap | Add an entry and a push-tap route; waiting/loading and exit-POD actions are incomplete. |
| D41 | Driver helpful cards / right of reply | Route, no menu entry | Add an entry. The Reply button opens generic Messages and loses the manager card; keep the card identity. Blocked by I05. |
| O28 | Branch overview | Route; the only link is in the unused `Owner.Today` | Link it from the current Owner home or report flow. |
| D17 | DigiLocker verification | Component not mounted | The active Documents screen (`OperationalScreens`) does not mount this card. |
| D18 | Wallet: bills, ledger, empty state | Component not mounted | Register and integrate; verify balances, rows, retry and payment meaning. Scope decision first (I11). |
| D19 | Add reimbursement bill / resubmit | Component not mounted | Wire it from Capture, More and Wallet; finish retry, trip/date, rejection and resubmit. Scope decision first (I11). |
| D20 | Bill sent / pending confirmation | Component not mounted | Wire it from the bill form; keep "pending" and "paid" distinct. Scope decision first (I11). |
| D21 | My advances / request advance | Component not mounted | Wire the list and detail; the "Request an advance" button has an empty handler. Scope decision first (I11). |

### 2.2 Not built yet (13 rows)

The backend for these exists (or none is needed); the screens do not.

| ID | Screen | Notes |
|---|---|---|
| A04 | Phone + OTP login | The backend supports OTP; the app offers password only. Build it only if product still wants OTP (section 6). |
| A11 | Data saver, simple mode, survey settings | I16. Needs both the controls and the behaviour behind them. |
| A13 | Update-required screen | Part of the I01 fix. |
| D07 | Break planner | No result screen or next-rest choices. Its data comes from duty, which has I04. |
| D30 | Nearby hazards / "still there?" | Authorised nearby list, confirmation and expired-report state. |
| D31 | Shared yes/no question chip and queued prompts | A shared host with ten-second fade, dismissal and timeout, motion-safe gating and answers from the stopped inbox. Writes need I20. |
| M03 | Manager card actions: call, outcome, handled, snooze, escalate | I12. Each action needs a reason, an outcome and the same card identity; returning from the dialer must not mark a card resolved. |
| M17 | Act-rate / card feedback view | I12. Per-type useful/handled/dismissed dashboard. |
| O09 | Report delivery history and provider errors | I19. Show accepted, failed, unknown and cancelled; "accepted" is not "delivered". |
| O15 | Arrival promise form and version history | I14. Port the reference implementation to the current versioned backend and link it from trips and reports. Backend is release-only (see Branch status). |
| O16 | Trip-cost review, closure and actual margin | I14. Evidence, allocations, completeness/version/fingerprint controls and a qualified result with history. Backend is release-only. |
| O17 | Owner crew declarations / roster | I14. The audit notes an `OwnerCrewScreens` implementation on a follow-up branch; find it before rebuilding. Backend `/crews` and driver declaration APIs exist (release-only). |
| O18 | Owner crew policy settings | I14. Nullable, scoped policy controls with history and reason. A declaration is not verified driving. |

### 2.3 Partly built (34 rows)

The screen exists and works in part. The text is the audit's description of what is missing.

**Shared**

| ID | Screen | What is missing |
|---|---|---|
| A02 | Language selection | en/hi/bn selection exists. Fully translated screens, spoken confirmation and language/device review remain. |
| A07 | Location permission / sharing | No navigation-triggered staged onboarding; duty, consent and refresh eligibility and recovery are unfinished. |
| A09 | Battery help | Generic instructions and an OS-settings button exist; phone-brand detection, screenshots and tracking-gap recovery are missing. |
| A10 | Language and voice settings | Language and a test phrase exist; voice choice, rate controls and the full preference UI are incomplete. |
| A14 | Session reconnect / expired-offline recovery | Rotated credentials, coordinated foreground/background refresh and explicit recovery remain. Related bug: I07. |

**Driver**

| ID | Screen | What is missing |
|---|---|---|
| D01 | Driver shell | Navigate is an unavailable page; several planned services have no normal entry. |
| D11 | Consignment note / POD upload | Stores an attachment only. Multi-page CN quality, stage unlock, and POD-driven trip closure and earning release are missing. |
| D13 | Capture action sheet | Camera-first default, Road Report entry and motion-based locking/reminders are missing. |
| D14 | Photo-any-paper / universal capture | v2 intake, multiple pages, retake, original fingerprint and the full review lifecycle are incomplete; the alias has no menu link. Related: I18, I20. |
| D15 | My papers / documents | Files, expiry and saved/verified state exist. The received/read/approved/rejected/paid lifecycle is missing. |
| D22 | Fuel capture / OCR / details | The real receipt/odometer/form flow exists. Pocket-paid reimbursement and wallet projection are not done. |
| D24 | Workshop bill upload / OCR / history | Evidence upload and extracted fields exist; not reimbursement approval/payment or the parts/labour repair editor. |
| D27 | Inbox / unread badge | Alerts, unread and ack exist. Owner messages are a separate view; queued questions and expiry/financial actions are not unified. |
| D35 | Driver profile | Identity, nickname, push settings and logout exist. Wallet/advance grouping and an actionable language row are incomplete. |
| D36 | More / tools menu | Wallet, rest, privacy, nearby reports and several registered services are not in the menu (ties to section 2.1). |

**Manager**

| ID | Screen | What is missing |
|---|---|---|
| M02 | Action-card detail | Fact, evidence and links exist. Map, timeline, driver side and the actions themselves are missing (I12, M03). |
| M05 | Vehicle detail / trail / crew | The crew reader is incompatible (I03); active-route ETA, card and call context are incomplete. |
| M06 | Driver roster / duty board | Paginated assignments exist. Driving/rest/plant status, hours and per-driver score trend are not shown. |
| M07 | Driver detail | Identity, linked truck and handover exist. The full timeline and the manager call flow are missing. |
| M14 | Crew management / history | UI exists; the API contract mismatch (I03) stops it working. |
| M16 | Manager chats / broadcasts | Only OWNER can create new conversations; the create/audience APIs are owner-only. The manager branch composer and permissions are not built. |

**Owner**

| ID | Screen | What is missing |
|---|---|---|
| O01 | Today / Aaj ka hisaab | The dated, branch-scoped report works. Some source-dependent metrics stay qualified/unknown. Entry from More has no back button (I15). |
| O05 | Finance evidence / bills / cash / receivables | Billed/cash/evidence views exist; the old Money, driver settlement and company books UI is inactive, and the wallet loop is incomplete. |
| O08 | Morning report preferences | Enable, time, language and branch are saved. Email and WhatsApp opt-ins are missing (I19). |
| O14 | Original vs extracted paper / decisions | File link, suggestions, missing fields, warnings and VERIFY exist. Correction, retake and disagreement lifecycle is incomplete; a note is not a driver-visible rejection. Related: I02, I18. |
| O19 | Fuel/sensor and trip-margin report evidence | Generic evidence display exists; specialised reconciliation and cost/promise actions need UI. |

**Communication**

| ID | Screen | What is missing |
|---|---|---|
| C03 | Create conversation / manual group | Owner selection exists with a driver-only audience. Manager-started and driver-to-co-driver conversations are not provided. |
| C05 | Voice record / playback | Voice works. Hold-release-send with slide-cancel, 60-second low-bitrate recording and transcripts are not this implementation. |
| C06 | Photo / location pin / structured update | Photo, current location and generic CARD send exist; automatic photo-to-paper capture linkage is missing. |
| C07 | Card explanation / right of reply | Escalation-linked text reply works. The helpful-card button still opens generic Messages; the manager card-to-thread link needs finishing. |
| C08 | Broadcast compose / schedule / cancel | Text, fixed recipients and scheduling exist. Manager branch composer, urgent/needs-OK priority and voice broadcast are incomplete (I19). |
| C10 | Audience filter / preview | Crew/plant/lane preview is absent; heading-to, near-point, model and full plan filters are not in the UI (I19). |

**Field Agent**

| ID | Screen | What is missing |
|---|---|---|
| F03 | Vehicle picker | Forwards the pick to fuel capture, but the form drops it (I08); truck-bound restrictions need verifying. |
| F04 | Fuel capture / OCR / submit | A single form with an inline saved state; not the older capture→details→success wizard. Selected truck is lost (I08). |

---

## 3. Backend left

No screen is waiting on the backend alone. This is the complete backend list:

| # | Item | What to do | Unblocks |
|---|---|---|---|
| 1 | I04 duty/today crash | Serialise Date fields before response validation. | D06, D07 |
| 2 | I05 help crash | Same fix for `raisedAt`. Because I04 and I05 have the same cause, check every v2 response contract that returns dates, not only these two. | D42, D41 |
| 3 | I01 backend side | Agree minimum versions per route and return an update-required response (code and message) with the 426 that the app can show. | A13 and all v2 screens |
| 4 | M15 manager branch report (I17) | Add an authorised branch-report contract for managers. Don't simply remove the OWNER check from the owner report. | M15 |
| 5 | I18 capture scope | If product decides captures are driver-self, enforce it in list and by-id reads (section 6). | D14, O14 |
| 6 | Release → main merge | Merge `release/en-24-nov-backend` into `main` (Branch status). | O13, O15–O18 and the owner capture/document review |
| 7 | Backend half of section 4 | The 17 rows where both sides are partial. | Section 4 |

---

## 4. Frontend and backend both left (17 rows)

| ID | Screen | Frontend | Backend | What is missing |
|---|---|---|---|---|
| A05 | Set PIN / unlock / wallet gate | Missing | Not found | PIN setup, secure storage, unlock and the wallet gate. Decision first (section 6). |
| A06 | Forgot password | Partial | Unverified | A dialog says to contact a manager; there is no self-service reset. |
| D12 | Post-trip journey summary | Placeholder | Partial | Per-crew hours, uncertain intervals, lane comparison, paper/money status and the summary itself. |
| D37 | Pre-trip inspection | Placeholder | Partial | Inspection form, result and persistence. Older/additional scope, decision first. |
| D38 | Standalone delivery confirmation | Placeholder | Partial | A dedicated confirmation flow; ERP attachment upload exists separately. Decision first. |
| D39 | Standalone Add expense | Placeholder | Partial | A generic expense form; the inactive AddBill is the reimbursement reference. |
| D40 | My earnings | Placeholder | Partial | Earning calculation, detail and settlement. Don't infer earnings from capture or GPS trips. Decision first. |
| M08 | Driver timeline | Placeholder | Partial | A chronological timeline of trips, fuel, cards, replies, handovers, score and evidence. |
| M10 | Approvals: fuel / documents / workshop | Partial | Partial | Workshop field decisions exist. Fuel approval workflow and the delegated reimbursement/ERP decision queue are missing. |
| M15 | Branch daily report | Missing | Not for manager | Manager-authorised branch contract (section 3) and a manager report screen (I17). |
| M21 | SOS centre / SOS detail | Placeholder | Partial | A dedicated manager incident centre; alerts and issues are the current stand-ins. |
| O27 | Truth / model-quality / readiness dashboards | Placeholder | Partial | Benchmark, source-disagreement and coverage dashboards, plus a menu entry. |
| C11 | Truck / trip / location / ETA conversation header | Missing | Partial | A context strip with live truck, trip and ETA, and a one-tap scoped call. |
| C12 | Moving-safe conversation | Missing | Partial | Motion-gated text lock, voice-only mode, safe announcements and stopped playback. |
| C13 | Quiet hours / deliver when on duty | Missing | Partial | Off-duty message deferral and the sender's view of it. |
| C14 | Automatic voice transcription | Missing | Partial | Optional; needs a provider and audio-quality decision first. Label transcripts clearly. |
| F08 | Field Agent SOS / emergency status | Partial | Partial | Role-specific API and device acceptance for the legacy Field Agent SOS screens. |

---

## 5. Phase 2 — Navigation and driving (11 rows, finding I10)

The Navigate tab is an "unavailable" page. The backend has contracts for most of this, but the app has no live driving journey, and the custom native navigation engine is not installed. Keep this separate from Phase 1 acceptance.

| ID | Screen | Frontend | Backend |
|---|---|---|---|
| N01 | Map-first idle Navigate | Placeholder | Yes |
| N02 | Destination search / voice / suggestions | Missing | Yes |
| N03 | Route preview / two alternatives / start | Missing | Yes |
| N04 | Truck restrictions / unknown warnings | Missing | Yes |
| N05 | Turn-by-turn guidance | Missing | Yes |
| N06 | Ahead row: tolls, pumps, parking, hazards | Missing | Partial |
| N07 | Driving voice / day-night / orientation | Missing | Not needed (device) |
| N08 | Stopped navigation state | Missing | Yes |
| N09 | Degraded / offline / weak GPS states | Missing | Not needed (device) |
| N10 | Offline map packs | Placeholder | Not needed (device) |
| N11 | Route weather / traffic / predictive jam | Missing | Partial |

---

## 6. Decisions needed before building

These need a product answer first; building before the answer risks wasted work.

| Decision | Rows | Question |
|---|---|---|
| Capture read scope (I18) | D14, O14 | Can a driver read a co-driver's captures in the same org (current behaviour), or only their own (what the contract declares)? Other-org isolation was verified, so this is not a cross-tenant leak. |
| Wallet, reimbursement and advances (I11) | D18–D21, D39, O05 | Keep the older wallet design in scope? The components and backend exist but are not connected. |
| OTP login and PIN | A04, A05 | Is phone + OTP still required next to password login? Is a PIN/wallet gate wanted? |
| Older/additional driver screens | D37, D38, D40 | Are pre-trip inspection, standalone delivery confirmation and My earnings in scope? |
| Manager branch report (I17) | M15 | What should a manager see, scoped to which branches? |
| Report delivery channels (I19) | O08, O09, C08, C10 | Email and WhatsApp delivery and full audience filters: which channels and providers are approved? |
| Data saver, simple mode, surveys (I16) | A11 | What does each setting actually change? |
| Voice transcription | C14 | Which provider, if any? |

---

## 7. Not tested yet — needs a real device or real services

The audit ran on a simulator, a local Docker backend and synthetic data. These areas still need acceptance testing; they are not known bugs.

| Area | Why it is untested |
|---|---|
| Push notifications | The simulator has no push and the local server had `pushEnabled=false`. Needs a physical build, credentials and a received notification. |
| File originals and OCR | File keys and OCR fields were synthetic; no real uploads or scans. |
| Live GPS and background tracking | Synthetic positions only; no real movement, background permission, battery or restart behaviour. |
| Speech, calls, WhatsApp, email, DigiLocker, OTP | No real calls, messages or provider approvals were triggered. |
| Financial lifecycle | Report arithmetic matched, but no complete approval, settlement, payroll/advance or posted trip-margin case. |
| Offline, expiry, reconnect, concurrency | Not exhaustively exercised. |
| Deployed web | Browser checks used a CORS-bypassed local Chrome, so they don't prove web deployment works. |

These 12 rows exist in code but were only checked in source, not run: A01 Welcome, A03 Password sign-in, A15 Startup/unsupported role, D04 Choose truck, D28 Alert detail, D34 SOS, M13 Truck assignment, O02 Report sections, O03 Report drill-downs, O07 Listen to report, C04 Group member editing, C09 Read receipts.

---

## 8. Already working

These 29 rows passed within the tested scope:

- **Shared:** A12 Push permission and registration.
- **Driver:** D08 Recorded trips, D09 Trip detail, D10 ERP trips, D23 Fuel history, D25 Truck issues, D26 Support tickets.
- **Manager:** M04 Live fleet, M09 Alerts, M11 Maintenance review, M12 Fleet trips, M18 AdBlue/DEF, M19 Team and access, M20 More/settings.
- **Owner:** O04 Trip history, O06 Trends, O10 Alerts, O11 Escalation detail, O12 Calls and follow-ups, O20 Live fleet, O21 Fleet summary, O22 Fuel and AdBlue ledger, O23 Maintenance, O24 Compliance documents, O25 Team and roles, O26 More/settings.
- **Communication:** C01 Messages list, C02 Conversation.
- **Field Agent:** F01 Home.

All 5 saved UI actions were confirmed in MongoDB (report preference, text messages, driver issue, support ticket, owner explanation), and all 17 checked report figures matched the fixture data.

---

## Appendix A — all 139 plan rows

Columns: audit status, whether the frontend component exists, whether a user can reach it, whether the backend exists, linked findings, and the bucket after the fixes (see the update at the top). The first five columns are the audit's.

| ID | Screen | Group | Audit status | FE exists | Reachable | Backend | Findings | Bucket |
|---|---|---|---|---|---|---|---|---|
| A01 | Welcome / value introduction | Shared entry | Exists, not runtime-tested | YES | YES | N/A |  | Built - needs testing |
| A02 | Language selection | Shared entry | Partial | YES | YES | N/A |  | FE |
| A03 | Password sign-in | Shared entry | Exists, not runtime-tested | YES | YES | YES |  | Built - needs testing |
| A04 | Phone + OTP verification | Shared entry | Missing | NO | No: not implemented | YES |  | FE |
| A05 | Set PIN / unlock / wallet gate | Shared entry | Missing | NO | No: not implemented | NOT FOUND |  | FE + BE |
| A06 | Forgot password | Shared entry | Partial | YES | YES | UNVERIFIED |  | FE + BE |
| A07 | Location permission / sharing | Shared entry | Partial | YES | YES | YES |  | FE |
| A08 | Privacy and consent | Shared entry | Unreachable | YES | No: route only | YES | I13; I20 | FE |
| A09 | Battery help | Shared entry | Partial | YES | YES | N/A |  | FE |
| A10 | Language and voice settings | Shared entry | Partial | YES | YES | N/A |  | FE |
| A11 | Data saver / simple mode / survey settings | Shared entry | Missing | NO | No: not implemented | N/A | I16 | FE |
| A12 | Push permission / registration settings | Shared entry | Verified | YES | YES | YES |  | Done |
| A13 | Update-required screen | Shared entry | Missing | NO | No: not implemented | YES | I01 | FE |
| A14 | Session reconnect / expired-offline recovery | Shared entry | Partial | YES | YES | YES | I07 | FE |
| A15 | Startup loading / unsupported role | Shared entry | Exists, not runtime-tested | YES | YES | N/A |  | Built - needs testing |
| D01 | Driver shell | Driver operational | Partial | YES | YES | YES |  | FE |
| D02 | Operational Home / on-duty / off-duty states | Driver operational | Unreachable | YES | No: retained Home route, no ordinary menu entry | YES |  | FE |
| D03 | My truck | Driver operational | Failed | YES | YES | YES | I01 (crew widget) | FE |
| D04 | Choose / change truck | Driver operational | Exists, not runtime-tested | YES | YES | YES |  | Built - needs testing |
| D05 | My crew / handover / history | Driver operational | Failed | YES | YES | YES | I01; I03; I20 | FE |
| D06 | Rest & hours | Driver operational | Unreachable | YES | No: route only | YES | I01; I04; I13 | FE |
| D07 | Break planner | Driver operational | Missing | NO | No: not implemented | YES | I04 | FE |
| D08 | Recorded trips list | Driver operational | Verified | YES | YES | YES |  | Done |
| D09 | Recorded trip detail / route / stops | Driver operational | Verified | YES | YES | YES |  | Done |
| D10 | ERP trips list | Driver operational | Verified | YES | YES | YES |  | Done |
| D11 | Consignment note / POD upload | Driver operational | Partial | YES | YES | YES |  | FE |
| D12 | Post-trip journey summary | Driver operational | Placeholder | YES | YES | PARTIAL |  | FE + BE |
| D13 | Capture action sheet | Driver operational | Partial | YES | YES | N/A |  | FE |
| D14 | Photo-any-paper / universal capture | Driver operational | Partial | YES | YES | YES | I18; I20 | FE |
| D15 | My papers / document list and detail | Driver operational | Partial | YES | YES | YES |  | FE |
| D16 | Document reminders / renew / retake | Driver operational | Unreachable | YES | No: route only | YES | I13 | FE |
| D17 | DigiLocker verification | Driver operational | Inactive | YES | No: inactive component | YES |  | FE |
| D18 | Wallet: bills / ledger / empty state | Driver operational | Inactive | YES | No: inactive component | YES | I11 | FE |
| D19 | Add reimbursement bill / resubmit | Driver operational | Inactive | YES | No: inactive component | YES | I11 | FE |
| D20 | Bill sent / pending confirmation | Driver operational | Inactive | YES | No: inactive component | YES | I11 | FE |
| D21 | My advances / request advance | Driver operational | Inactive | YES | No: inactive component | YES | I11 | FE |
| D22 | Fuel capture / OCR / details / saved | Driver operational | Partial | YES | YES | YES |  | FE |
| D23 | Fuel history / record evidence | Driver operational | Verified | YES | YES | YES |  | Done |
| D24 | Workshop bill upload / OCR / history | Driver operational | Partial | YES | YES | YES |  | FE |
| D25 | Truck issue / incident list and detail | Driver operational | Verified | YES | YES | YES |  | Done |
| D26 | Support ticket / conversation / reply | Driver operational | Verified | YES | YES | YES |  | Done |
| D27 | Inbox / unread badge | Driver operational | Partial | YES | YES | YES |  | FE |
| D28 | Alert detail / acknowledgement | Driver operational | Exists, not runtime-tested | YES | YES | YES |  | Built - needs testing |
| D29 | Road-report form | Driver operational | Unreachable | YES | No: route only | YES | I13 | FE |
| D30 | Nearby hazards / still-there report | Driver operational | Missing | NO | No: not implemented | YES |  | FE |
| D31 | Shared yes/no question chip / queued prompts | Driver operational | Missing | NO | No: not implemented | YES | I20 | FE |
| D32 | Manual stop explanation | Driver operational | Unreachable | YES | No: route only | YES | I13 | FE |
| D33 | Plant / gate Site Card | Driver operational | Unreachable | YES | No: route only | YES | I13 | FE |
| D34 | SOS choice / send / saved status | Driver operational | Exists, not runtime-tested | YES | YES | YES |  | Built - needs testing |
| D35 | Driver profile | Driver operational | Partial | YES | YES | N/A |  | FE |
| D36 | More / tools menu | Driver operational | Partial | YES | YES | N/A |  | FE |
| D37 | Pre-trip inspection | Driver operational | Placeholder | YES | YES | PARTIAL |  | FE + BE |
| D38 | Standalone delivery confirmation | Driver operational | Placeholder | YES | YES | PARTIAL |  | FE + BE |
| D39 | Standalone Add expense | Driver operational | Placeholder | YES | YES | PARTIAL |  | FE + BE |
| D40 | My earnings | Driver operational | Placeholder | YES | YES | PARTIAL |  | FE + BE |
| D41 | Driver helpful cards / right of reply | Driver operational | Unreachable | YES | No: route only | YES | I05; I13 | FE |
| D42 | Driver Help / contact office / breakdown help | Driver operational | Failed | YES | YES | YES | I01; I05 | FE |
| N01 | Map-first idle Navigate | Navigation | Placeholder | YES | YES | YES | I10 | Phase 2 |
| N02 | Destination search / voice / suggestions / pick on map | Navigation | Missing | NO | No: not implemented | YES | I10 | Phase 2 |
| N03 | Route preview / two alternatives / start | Navigation | Missing | NO | No: not implemented | YES | I10 | Phase 2 |
| N04 | Truck restrictions / unknown warnings | Navigation | Missing | NO | No: not implemented | YES | I10 | Phase 2 |
| N05 | Active turn-by-turn guidance | Navigation | Missing | NO | No: not implemented | YES | I10 | Phase 2 |
| N06 | Ahead row: tolls / pumps / parking / hazards | Navigation | Missing | NO | No: not implemented | PARTIAL | I10 | Phase 2 |
| N07 | Driving voice / day-night / orientation | Navigation | Missing | NO | No: not implemented | N/A | I10 | Phase 2 |
| N08 | Stopped navigation state | Navigation | Missing | NO | No: not implemented | YES | I10 | Phase 2 |
| N09 | Degraded / offline / weak GPS / estimated states | Navigation | Missing | NO | No: not implemented | N/A | I10 | Phase 2 |
| N10 | Offline map packs: download / size / readiness / delete | Navigation | Placeholder | YES | YES | N/A | I10 | Phase 2 |
| N11 | Route weather / traffic / predictive jam | Navigation | Missing | NO | No: not implemented | PARTIAL | I10 | Phase 2 |
| M01 | Home ranked action-card stack | Manager | Failed | YES | YES | YES | I01 | FE |
| M02 | Action-card detail | Manager | Partial | YES | YES | YES | I12 | FE |
| M03 | Card Call / outcome / handled / snooze / escalate | Manager | Missing | NO | No: not implemented | YES | I12 | FE |
| M04 | Live fleet list/map/filter | Manager | Verified | YES | YES | YES |  | Done |
| M05 | Vehicle detail / recorded trail / crew | Manager | Partial | YES | YES | YES |  | FE |
| M06 | Driver roster / assignments / duty board | Manager | Partial | YES | YES | YES |  | FE |
| M07 | Driver detail | Manager | Partial | YES | YES | YES |  | FE |
| M08 | Driver timeline | Manager | Placeholder | YES | YES | PARTIAL |  | FE + BE |
| M09 | Full Alerts / alert detail | Manager | Verified | YES | YES | YES |  | Done |
| M10 | Approvals / fuel / documents / workshop review | Manager | Partial | YES | YES | PARTIAL |  | FE + BE |
| M11 | Maintenance creation / OCR review | Manager | Verified | YES | YES | YES |  | Done |
| M12 | Fleet trip list / historical detail | Manager | Verified | YES | YES | YES |  | Done |
| M13 | Truck assignment / handover | Manager | Exists, not runtime-tested | YES | YES | YES |  | Built - needs testing |
| M14 | Crew management / history | Manager | Partial | YES | YES | YES | I03 | Built - needs testing |
| M15 | Branch daily report | Manager | Missing | NO | No: not implemented | NO (FOR MANAGER) | I17 | FE + BE |
| M16 | Manager-created chats / broadcasts | Manager | Partial | YES | YES | YES |  | FE |
| M17 | Act-rate / card feedback view | Manager | Missing | NO | No: not implemented | YES | I12 | FE |
| M18 | AdBlue / DEF evidence | Manager | Verified | YES | YES | YES |  | Done |
| M19 | Team and access | Manager | Verified | YES | YES - current runtime entry found | YES |  | Done |
| M20 | More / settings / push / logout | Manager | Verified | YES | YES | YES |  | Done |
| M21 | SOS centre / SOS detail | Manager | Placeholder | YES | YES | PARTIAL |  | FE + BE |
| O01 | Today / Aaj ka hisaab | Owner | Partial | YES | YES | YES | I15 | Built - needs testing |
| O02 | Report section / source evidence | Owner | Exists, not runtime-tested | YES | YES | YES |  | Built - needs testing |
| O03 | Report rows / drilldowns | Owner | Exists, not runtime-tested | YES | YES | YES |  | Built - needs testing |
| O04 | Trip history / truck-filtered trips | Owner | Verified | YES | YES | YES |  | Done |
| O05 | Finance evidence / bills / cash / receivables | Owner | Partial | YES | YES | YES |  | FE |
| O06 | Trends and comparisons | Owner | Verified | YES | YES | YES |  | Done |
| O07 | Listen to report | Owner | Exists, not runtime-tested | YES | YES | YES |  | Built - needs testing |
| O08 | Morning report preferences | Owner | Partial | YES | YES | YES | I19 | FE |
| O09 | Delivery history / provider errors | Owner | Missing | NO | No: not implemented | YES | I19 | FE |
| O10 | Alerts / ranked escalations / full history | Owner | Verified | YES | YES | YES |  | Done |
| O11 | Escalation detail / actions / history | Owner | Verified | YES | YES | YES |  | Done |
| O12 | Calls / outcomes / follow-ups | Owner | Verified | YES | YES | YES |  | Done |
| O13 | Capture review queue | Owner | Failed | YES | YES | YES | I01; I02 | Built - needs testing |
| O14 | Original versus extracted paper / decisions | Owner | Partial | YES | YES | YES | I02; I18 | FE |
| O15 | Arrival promise form / version history | Owner | Missing | NO | No: not implemented | YES | I14 | FE |
| O16 | Trip-cost review / closure / actual-margin detail | Owner | Missing | NO | No: not implemented | YES | I14 | FE |
| O17 | Owner crew declarations / roster | Owner | Missing | NO | No: not implemented | YES | I14 | FE |
| O18 | Owner crew policy settings | Owner | Missing | NO | No: not implemented | YES | I14 | FE |
| O19 | Fuel/register/sensor and trip-margin report evidence | Owner | Partial | YES | YES | YES |  | FE |
| O20 | Live / fleet / vehicle / driver | Owner | Verified | YES | YES | YES |  | Done |
| O21 | Fleet home summary | Owner | Verified | YES | YES | YES |  | Done |
| O22 | Fuel and AdBlue ledger | Owner | Verified | YES | YES | YES |  | Done |
| O23 | Maintenance / issues / workshop evidence | Owner | Verified | YES | YES | YES |  | Done |
| O24 | Fleet compliance documents | Owner | Verified | YES | YES | YES |  | Done |
| O25 | Team / employee / role / access controls | Owner | Verified | YES | YES | YES |  | Done |
| O26 | More / account / push settings | Owner | Verified | YES | YES | YES |  | Done |
| O27 | Truth / model-quality / readiness dashboards | Owner | Placeholder | YES | YES | PARTIAL |  | FE + BE |
| O28 | Branch overview | Owner | Unreachable | YES | No: route only | YES |  | FE |
| C01 | Messages list | Communication | Verified | YES | YES | YES |  | Done |
| C02 | Conversation / history | Communication | Verified | YES | YES | YES |  | Done |
| C03 | Create direct conversation / manual group | Communication | Partial | YES | YES | YES |  | FE |
| C04 | Group member editing | Communication | Exists, not runtime-tested | YES | YES | YES |  | Built - needs testing |
| C05 | Voice record / playback | Communication | Partial | YES | YES | YES |  | FE |
| C06 | Photo attachment / location pin / structured update | Communication | Partial | YES | YES | YES |  | FE |
| C07 | Card explanation / right of reply | Communication | Partial | YES | YES | YES |  | FE |
| C08 | Broadcast compose / scheduling / cancellation | Communication | Partial | YES | YES | YES | I19 | FE |
| C09 | Delivery / read / acknowledgement receipts | Communication | Exists, not runtime-tested | YES | YES | YES |  | Built - needs testing |
| C10 | Audience filter / preview | Communication | Partial | YES | YES | YES | I19 | FE |
| C11 | Automatic truck / trip / location / ETA conversation header | Communication | Missing | NO | No: not implemented | PARTIAL |  | FE + BE |
| C12 | Moving-safe conversation / typing lock / announcements | Communication | Missing | NO | No: not implemented | PARTIAL |  | FE + BE |
| C13 | Quiet hours / delivered-when-on-duty UI | Communication | Missing | NO | No: not implemented | PARTIAL |  | FE + BE |
| C14 | Optional automatic voice transcription | Communication | Missing | NO | No: not implemented | PARTIAL |  | FE + BE |
| F01 | Home / recent fuel / capture entry | Field Agent | Verified | YES | YES | YES |  | Done |
| F02 | Organisation selection | Field Agent | Failed | YES | YES | YES | I06 | Built - needs testing |
| F03 | Vehicle picker | Field Agent | Partial | YES | YES | YES | I08 | Built - needs testing |
| F04 | Fuel capture / OCR / submit | Field Agent | Partial | YES | YES | YES | I08 | Built - needs testing |
| F05 | Fuel log / history | Field Agent | Failed | YES | YES | YES | I09 | Built - needs testing |
| F06 | Fuel details / separate saved screen | Field Agent | Unreachable | YES | No: route only | YES |  | Legacy - do not build |
| F07 | Profile / alerts / language | Field Agent | Failed | YES | YES | YES | I07 | Built - needs testing |
| F08 | SOS options / emergency status | Field Agent | Partial | YES | YES | PARTIAL |  | FE + BE |

## Appendix B — the older 52-screen design

The audit also lists all 52 entries of the original design catalog. They are older visual designs mapped to the current screens above, not separate screens to build: 24 are inactive, 23 partial, 3 exist without runtime testing and 2 are missing. Their status follows the current row they map to (for example, the older wallet screens follow D18–D21). Build them only if product wants the older design back. Full mapping: [screen-matrix.csv](evidence/screen-matrix.csv).
