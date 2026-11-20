# DriverApp — what is left, by role

State on the release branches after the 20 November fixes (DriverApp `release/en-24-nov-driver-app`, backend `release/en-24-nov-backend`). Plan IDs are from the [audit](README.md); details are in [REMAINING_WORK.md](REMAINING_WORK.md).

How to read the tags:

- **Wire up** — the screen is built; it only needs a menu entry or to be mounted.
- **Finish** — the screen works; planned parts are missing.
- **Build** — no screen yet; the backend API is ready.
- **Build FE+BE** — both the app and the backend still need work.
- **Decision first** — product must confirm the scope before anyone builds it.

---

## Driver

### 1. Features left

**Wire up**

1. Rest & hours (D06) — add a More entry.
2. Document reminders / renew / retake (D16) — add an entry; the reminder list and retake decision are still to build.
3. Road report (D29) — add it to the Capture menu.
4. Stop explanation (D32) — move it into the main Capture menu (fix bug 3 first).
5. Plant / gate Site card (D33) — add an entry and a push-tap route; waiting/loading and exit-POD actions are missing.
6. Helpful cards from the office (D41) — add an entry.
7. Privacy and consent (A08) — add a Settings entry.
8. DigiLocker verification card (D17) — mount it in Documents.
9. Operational Home with on/off-duty states (D02) — hidden route; decide whether it comes back.
10. Wallet: bills, add/resubmit bill, bill sent, advances (D18–D21) — components exist but are not mounted. **Decision first.**

**Finish**

11. My truck (D03) — papers, service and wallet summary.
12. Crew & driving (D05) — two-phone "who is driving" prompts.
13. Driver help (D42) — short-video help library; Ask Sahayak later.
14. CN / POD upload (D11) — multi-page CN, stage unlock, POD closes the trip and releases earnings.
15. Capture menu (D13) — camera first, Road report entry, lock while moving.
16. Photo any paper (D14) — multiple pages, retake, review lifecycle, menu entry.
17. My papers (D15) — received / approved / rejected / paid status.
18. Fuel capture (D22) — fuel paid from pocket goes to the wallet.
19. Workshop bill (D24) — reimbursement approval and payment.
20. Inbox (D27) — one place for alerts, messages, questions and expiry actions.
21. Profile (D35) — wallet/advance group and a language row.
22. More menu (D36) — entries for wallet, rest, privacy and nearby reports.
23. Location permission (A07) — staged onboarding and recovery.
24. Battery help (A09) — phone-brand steps and tracking-gap recovery.

**Build**

25. Break planner (D07).
26. Nearby hazards / "still there?" (D30).
27. Yes/no question chip and queued prompts (D31).

**Build FE+BE**

28. Post-trip journey summary (D12).
29. Moving-safe chat: typing lock, voice-only mode, announcements (C12).
30. Add expense (D39).
31. Pre-trip inspection (D37) — **Decision first.**
32. Delivery confirmation (D38) — **Decision first.**
33. My earnings (D40) — **Decision first.**

**Phase 2**

34. Navigation, 11 screens (N01–N11): map, destination search, route preview, truck restrictions, turn-by-turn, ahead row, voice and day/night, stopped state, weak-GPS and offline states, offline map packs, route weather.

### 2. Bugs

**Open**

1. The Reply button on a helpful card opens generic Messages, so the reply is not tied to the manager's card (D41, C07). Frontend.
2. Withdrawing location consent does not stop all location sampling (A08). Frontend.
3. Stop explanation: the app calls `GET /app/v2/stops/:vehicleId/questions`, the backend only has `POST`, so it gets a 404 (D32; the screen is hidden today). Frontend.
4. "Request an advance" does nothing: its button handler is empty (D21; the wallet screens are not wired yet). Frontend.
5. Truck pairing / duty: the backend answers 500 instead of 409 when an open driving interval already exists (`driverDuty.db.test.js` fails). Backend; cause not investigated yet.
6. Fuel fills: the fill the backend detected reaches the driver without the bill attached (`fuelFills.db.test.js` fails). Backend; cause not investigated yet.
7. Navigation route options: the app calls `GET /app/v2/routes`, the backend only has `POST` (Phase 2; not used yet). Frontend.
8. A driver can read a co-driver's captures in the same org, while the contract says "own captures only" (I18). **Decision first**, then the backend enforces it.

**Fixed on the release branch — test on a device**

- My truck: the crew widget showed "status code 426" (D03).
- Crew & driving called the wrong API (D05).
- Rest & hours and break planner crashed with 500 on real duty data (D06, D07).
- Driver help showed 426, then 500 on real cards (D42, D41).
- Saving consent failed: no Idempotency-Key (A08).

---

## Manager

### 1. Features left

**Finish**

1. Home action cards (M01) — top three expanded, the rest collapsed, a count summary, swipe actions.
2. Action-card detail (M02) — map, timeline, the driver's side, actions.
3. Vehicle detail (M05) — active-route ETA, card and call context.
4. Driver roster / duty board (M06) — driving / rest / plant status, hours, score trend.
5. Driver detail (M07) — full timeline and the call flow.

**Build**

6. Card actions: call, outcome, handled, snooze, escalate (M03).
7. Card feedback / act-rate view (M17).

**Build FE+BE**

8. Managers can start chats and branch broadcasts (M16, C03) — today the create and audience APIs are owner-only.
9. Branch daily report (M15) — needs a manager-scoped report API; don't just open the owner report.
10. Driver timeline (M08).
11. Approvals queue (M10) — fuel approval and reimbursement decisions.
12. SOS centre (M21).

### 2. Bugs

**Open:** none known.

**Fixed on the release branch — test on a device**

- Home cards showed "status code 426" (M01).
- Crew management called the wrong API (M14).

---

## Owner

### 1. Features left

**Wire up**

1. Branch overview (O28) — today it is linked only from an unused screen.

**Finish**

2. Morning report (O08) — email and WhatsApp opt-ins.
3. Paper decisions (O14) — correction, retake and disagreement.
4. Finance (O05) — driver settlement and company books; the wallet loop.
5. Fuel/sensor and trip-margin evidence (O19) — reconciliation and cost/promise actions.
6. Broadcasts (C08, C10) — urgent / needs-OK priority, voice broadcast, crew / plant / lane audience.

**Build**

7. Report delivery history (O09).
8. Arrival promise form and history (O15).
9. Trip-cost review, closure and margin (O16).
10. Crew declarations / roster (O17) — an `OwnerCrewScreens` implementation exists on a follow-up branch; check it first.
11. Crew policy settings (O18).

**Build FE+BE**

12. Truth / model-quality dashboard (O27).

### 2. Bugs

**Open:** none known.

**Fixed on the release branch — test on a device**

- Capture review called the driver endpoint and got 403 (O13).
- Today's report opened from More had no back button (O01).

---

## All roles

### 1. Features left

**Finish**

1. Full Hindi and Bengali screens, spoken confirmation (A02).
2. Voice choice and speech rate settings (A10).
3. Session reconnect and offline recovery (A14).
4. Voice messages: hold to send, slide to cancel, 60-second limit (C05).
5. A photo sent in chat goes to paper review (C06).
6. Replying to a card keeps the card linked to its thread (C07).

**Build**

7. Full update-required screen (A13) — a 426 is now explained in place, but there is no dedicated screen.
8. Data saver, simple mode and survey settings (A11).
9. Phone + OTP login (A04) — **Decision first.**

**Build FE+BE**

10. Self-service forgot password (A06).
11. Truck / trip / ETA header in conversations (C11).
12. Quiet hours: deliver normal messages when the driver is on duty (C13).
13. PIN / unlock / wallet gate (A05) — **Decision first.**
14. Automatic voice transcription (C14) — optional, **Decision first.**

### 2. Bugs

**Fixed on the release branch — test on a device**

- The app did not send its version, so every v2 screen could answer 426 (I01). The app is now 2.0.0 and needs a new binary build.

---

## Totals

| Role | Features left | Open bugs |
|---|---|---|
| Driver | 34 (navigation counted as 1; it is 11 screens) | 8 (1 is a decision) |
| Manager | 12 | 0 |
| Owner | 12 | 0 |
| All roles | 14 | 0 |

Field Agent is not listed: its 4 bugs are fixed (I06, I07, I08, I09) and only the SOS screens (F08) are left.
