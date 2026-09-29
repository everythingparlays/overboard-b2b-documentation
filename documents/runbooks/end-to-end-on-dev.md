# Runbook: the end-to-end flow on dev

Real game → contest in the console → fan board → stats → bingo → prize, run by hand on the shared dev
database. For Arthur and Nick. What was built and why is in
[`spec/core-modules/1-draft/end-to-end-flow.spec.md`](../../spec/core-modules/1-draft/end-to-end-flow.spec.md).

There are two ways to make bingos happen:

- **A finished game: replay** (§5). Read-only toward consumer data. Use this by default.
- **An upcoming game: change prop progress in PES** (§6). This writes the consumer app's live data, so
  **read the safety rule in §6 first.**

§7 is the scripted version of the whole thing (the harness).

---

## 1. Start the stack

You need four processes: the backend, the prize worker in local mode, the console and the fan app.

**Ports.** Pick your own; the examples use backend 3051, console 5251 and fan app 5351. Never use 3001 or
5174, which are Arthur's everyday servers.

**AWS.** Mongo auth is AWS IAM through the SSO profile `obs-b2b-dev`. Check it with
`aws sts get-caller-identity --profile obs-b2b-dev`. If it has expired, a person renews it with
`aws sso login --profile obs-b2b-dev` (agents never log in). Never use static `AWS_*` keys: unset them in
the shell you start from.

### Env files (gitignored; start from each `.env.example`)

`overboard_sports_backend/node-server/.env`:

| Variable | Value |
|---|---|
| `MONGODB_DATABASE_NAME` | `obs-b2b-dev` |
| `B2B_COLLECTION_PREFIX` | your namespace: `arthur_` or `nick_` |
| `PORT` | your backend port |
| `FRONTEND_ORIGIN` | your console and fan app origins, e.g. `http://localhost:5251,http://localhost:5351` |
| `ADMIN_AUTHORIZED_PARTIES` | your console origin only, e.g. `http://localhost:5251` |
| `DEV_TOOLS` | `on` (commented out in `.env.example`; uncomment it) |
| `PRIZE_LOCAL_QUEUE_DIR` | a folder the worker also reads, e.g. `../.prize-dev/queue` |
| Clerk keys, `MONGODB_CONNECTION_STRING`, `AWS_PROFILE` | as in `.env.example` |

`overboard_sports_backend/prize-worker/.env`: the same Mongo variables and prefix, plus

| Variable | Value |
|---|---|
| `PRIZE_LOCAL_QUEUE_DIR` | the **same folder** as the backend's (`../.prize-dev/queue` resolves to the same place from both) |
| `PRIZE_EMAIL_OUTBOX_DIR` | where prize emails are written instead of sent, e.g. `../.prize-dev/outbox` |
| `PRIZE_FROM_ADDRESS` | required, or every email fails |

Console `.env`: `VITE_API_BASE_URL` = your backend. Fan app `.env`: `VITE_API_BASE_URL` = your backend,
`VITE_TENANT_SLUG` = a tenant in your namespace (`test` in `arthur_`).

### Start (each in its own terminal)

```bash
# Backend: rebuild built/ first, every time you change branch or pull
cd overboard_sports_backend/node-server
npm run build && AWS_PROFILE=obs-b2b-dev AWS_SDK_LOAD_CONFIG=1 node --env-file=.env built/server.js

# Prize worker, local mode
cd overboard_sports_backend/prize-worker
node build.mjs && AWS_PROFILE=obs-b2b-dev AWS_SDK_LOAD_CONFIG=1 node --env-file=.env built/worker.js

# Console and fan app
cd obs-b2b-admin-frontend && npx vite --port 5251 --strictPort
cd overboard-b2b-template && npx vite --port 5351 --strictPort
```

**What you should see:**

- Backend: `[dev-scoring] <time> this server now scores arthur_`, then
  `[dev-scoring] <time> watching readonly_props (local scoring)`. On a cold start it also prints
  `[dev-scoring] <time> sweep done { boards: …, linesClaimed: … }`.
- **Only one server scores a prefix.** The server you started last takes over. Any other server with dev tools on logs
  `standing by: <host:port (pid)> scores arthur_ now`, and takes over by itself within 30 s of that one stopping. So
  prize emails land in the outbox of the server that logged `this server now scores`.
- Worker: `[prize-worker] local mode: reading …` and `[prize-worker] emails go to …`.

If the backend says `watcher not started: set PRIZE_LOCAL_QUEUE_DIR …`, the dev tools are off. See §9.

**A second server beside the one that scores** (a builder's own stack, say): set `DEV_PROP_WATCHER=off` in its `.env`.
It then takes no lease and runs no stream or sweep (`watcher not started: DEV_PROP_WATCHER=off`), so it never pulls
scoring, and prize emails, away from the server you are watching. Boards it creates or serves are still reconciled by
it, into its own prize folder, so run its own worker too if you build boards there.

**Awards are reconciled, not only announced** (end-to-end-flow.spec.md §1.2). Besides a prop hit, a board is checked
when it is built, whenever its fan's app reads it (every 30 s while open), and by a sweep every 5 minutes
(`RECONCILE_SWEEP_MS`) on the server that holds the lease. A board built after its props hit (test mode joins after
kickoff) is awarded at once. The log line is `[scoring] <time> awarded { boardId, trigger, lines, tierIndexes }`.

---

## 2. Pick a real game

**Never create test games.** Use real games already in PES, with real players, props and photos.

- **Upcoming:** any game in the console's picker. The **Sport** filter lists every sport the feed has ever
  carried; choosing one with nothing to come says "No upcoming … games yet.", which means PES hasn't
  published that sport's next games (college and baseball games often appear only hours before kickoff).
- **Finished:** a game from the last 14 days. The picker offers these only to a contest in **test mode**
  (§3).

An upcoming game needs its props loaded in PES before fans can draft. D2C usually loads and opens them
the day before. Without props, joining answers "Players for this game aren't available yet."

Use **one game per contest** unless you are testing multi-game drafting.

---

## 3. Console: create the contest

Sign in to the console as a tenant admin. The test accounts are listed in
`C:\Users\arthu\.overboard\test-accounts.md` (`tenant-admin+clerk_test@example.com` is `org:admin` on
`test`). The email code on the dev Clerk instance is **424242**.

1. **Games & Contests → New contest.** Name it → **Save and continue** (this creates the draft).
2. **Games:** search by team and tick the game → **Save and continue**.
3. **Prizes:** **Add prize tier**: bingos to win = 1, prize = a library prize → **Save prizes** →
   **Continue**. If the library is empty, write one first on **Prizes → New prize**.
4. **Sponsors:** optional → **Continue**.
5. **Test mode** (dev only), when either is true:
   - the game's props aren't open yet (the contest would read "Upcoming", with fans unable to join);
   - you want a finished game: with test mode on, the picker also offers the last two weeks' games.

   The console has no test-mode control: set it through the dev API (below), then reload the builder.
6. **Review → Publish.**

Nothing in the builder saves as you go: **Save draft** (any step) or **Save and continue** saves, and
leaving with unsaved changes asks "Leave without saving?".

### Test mode through the dev API

`PUT /admin/dev/contests/<contestId>/test-mode { testMode: true | false }` needs a tenant `org:admin` or
OBS staff token (staff add `?tenant=<slug>`), and answers only where the dev tools are on (§9). The
contest's id is in the builder's address (`/contests/<contestId>/setup/...`). From the **console tab's
browser devtools**, signed in:

```js
const API = "http://localhost:3051";          // your backend
const token = await window.Clerk.session.getToken();
await fetch(`${API}/admin/dev/contests/<contestId>/test-mode`, {
  method: "PUT",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ testMode: true }),
}).then((r) => r.json());
// → { success: true, contestId: "<contestId>", testMode: true }
```

With test mode on, the contest is joinable whatever the game clock says, and the board draws from every
game in the contest. `GET /admin/contests/<contestId>` reads the flag back as `testMode` (dev only). The
harness (§7) sets it the same way.

---

## 4. Fan: join and build a board

1. Open the fan app. **Sign in** with a `+clerk_test` fan account, or sign up a new one (for example
   `yourname-fan+clerk_test@example.com`). A new browser is asked for an email code: **424242**. No
   mail is sent to `+clerk_test` addresses. The harness's fixture fan
   (`e2e-fan+clerk_test@example.com`, password in `scripts/e2e/run-e2e.mjs`) is already a member of `test`.
2. The first time, the entry gate appears. Fill in the display name, the tenant's fields and the
   required opt-ins → **Join ‹team›**.
3. **Contests → Upcoming.** The card reads **Open** → **Join Now**.
4. **Draft Your Squad:** pick up to 8 players. A multi-game contest shows one tab per open game.
   **Generate Bingo Board.**
5. The board (**Your Board**) polls every 30 seconds while the tab has focus. Bingos appear only after
   the server claims them. The prize popup opens only for an award the server recorded, once per board
   and bingo count.

---

## 5. Replay a finished game

`POST /admin/dev/replay { betEventId, delayMs? }` feeds the game's props that are **already resolved as
Hit** into the same evaluator the watcher uses, oldest first. It only reads the mirror; it writes nothing
PES, D2C or the consumer app reads. It needs a tenant `org:admin` or OBS staff token.

- It scores **every board in your namespace** that holds those props, not just one contest's.
- `delayMs` (0–5000) pauses between props, so you can watch a board fill in.
- The answer is `{ propsFed, boardsEvaluated, linesClaimed }`.

There is no replay button. Call it from the **console tab's browser devtools** while signed in as the
tenant admin (the console's origin is already allowed by the backend's CORS):

```js
const API = "http://localhost:3051";          // your backend
const call = async (method, path, body) => {
  const token = await window.Clerk.session.getToken();
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  return res.json();
};

// The game ids of your contests (OBS staff: add ?tenant=<slug>)
(await call("GET", "/admin/games")).contests.map((c) => [
  c.contestName,
  c.games.filter((g) => g.enabled).map((g) => `${g.betEventId}  ${g.bettingEvent}`),
]);

// Replay one game
await call("POST", "/admin/dev/replay", { betEventId: "<betEventId>", delayMs: 1500 });
```

Then watch:

- the backend log;
- the prize worker writing `<time>-<redemptionId>.{html,txt,json}` into its outbox folder;
- the fan board, where the bingo and the popup appear within 30 seconds.

A fan's board is partly random, so it may hold no complete line of hits. If `linesClaimed` is 0, build
another board (another fan) or pick another game.

---

## 6. An upcoming game: change prop progress in PES

This is how Nick does it. It exercises the real path: PES → D2C database → Atlas trigger →
`obs-b2b-dev.readonly_props` → your backend's watcher → evaluator → prize worker.

> ### SAFETY RULE (Arthur, 2026-09-27)
>
> **PES writes the consumer app's live data.** There is no D2C test environment behind it.
>
> - **Only change props on a game that NO consumer (D2C) contest uses.** Check first, every time (below).
> - **Never press "Update All Events"** (on a D2C contest's **Manage** page). It pulls real box scores
>   for every game in that D2C contest.
> - Don't use **Open props**, **Finalize** or a contest's **Finalize** in PES either. You only need
>   **Update** on a prop card.
> - Put every value back when you're done (step 5).

### Check: is the game in any D2C contest?

PES's contest list is backed by `GET /contest/get-contests-between-dates?startDate=&endDate=`. It returns
**every** D2C contest (visible or hidden, finalized or not, any type) holding at least one game whose
tip-off falls in that range, with each contest's games attached.

**In the PES screens (signed in):**

1. Open **Contests → All Contests** (`/Admin/ContestHomePage`).
2. Set **Start Date** to the day before the game and **End Date** to two days after. The server compares
   against midnight UTC, and US evening games tip off the next day in UTC, so a wider window only adds
   contests to check; it never hides one.
3. Leave the filters on *all*. **Total Contests = 0** means the game is safe.
4. Otherwise, click **Manage** on each contest listed (`/Admin/ContestManagementHub/<contestId>`) and
   look for your matchup among its events. The list's **Search** box searches contest names, types and
   sports, not matchups.

**Or in one step:** on any PES page, while signed in, paste this in the browser devtools. It uses PES's
own sign-in token and the same read-only call:

```js
const betEventId = "<the game's id: the id in /Admin/BetEventPropsPage/<id>>";
const start = "2026-10-03", end = "2026-10-06";  // the day before, two days after
const key = Object.keys(localStorage).find((k) => k.startsWith("CognitoIdentityServiceProvider.") && k.endsWith(".idToken"));
const res = await fetch(
  `https://d7hwmlam1e.execute-api.us-east-2.amazonaws.com/dev/contest/get-contests-between-dates?startDate=${start}&endDate=${end}`,
  { headers: { Authorization: `Bearer ${localStorage.getItem(key)}` } }
);
(await res.json())
  .filter((c) => (c.allowedBetEvents || []).some((e) => String(e?._id ?? e) === betEventId))
  .map((c) => ({ contest: c.contestName, id: c._id, visible: c.showContest }));
// [] means no D2C contest uses the game.
```

D2C staff often build contests the day before a game. **Check again right before you change anything.**

### Steps

1. Build the B2B contest and a fan board on the game (§3, §4). Use test mode if the game's props aren't
   open yet.
2. On the fan board, choose a line: a row, a column or a diagonal. Note each cell's player, market and
   line (e.g. "13+ REC YDS").
3. In PES: **Bet Events → All Bet Events** (`/Admin/BetEventsHomePage`) → click the game → its props
   page, `/Admin/BetEventPropsPage/<betEventId>`. That id is the same `betEventId` B2B uses.
4. For each of the three cells, find the player's card for that market:
   1. **Write down its current Progress** (usually 0).
   2. Set **Progress** to at least the cell's number. The prop table's **Line** column must be ≤ the
      progress, and **Outcome** must be **Over**.
   3. Click **Update**. Don't Finalize.

   Progress applies to the player's whole market, so every Over line at or below it becomes a Hit, on
   every B2B board holding one.

   Within a second the backend logs `[dev-scoring] <time> prop hit { propId, msSincePesWrote, … }`. Once the third
   cell of the line is hit,
   the worker writes the prize email to the outbox, and the fan board shows the bingo and the popup
   within 30 seconds.
5. **Put it back.** Set each card's **Progress** back to the value you wrote down → **Update**. PES then
   returns those Over props to no outcome (`updateBettingPropsProgressValue` in `PbCdkMonoRepo`).
   On the B2B side nothing is undone: a claimed line and its prize stay. Claims are append-only, and the
   watcher only acts on hits.

Only **Over** props hit from progress. A **Manual** prop ("To Win By") resolves only on Finalize, and
**Unders** never resolve, so build your line from Over cells.

**Without touching PES.** On a game day, D2C's own updates flow through the mirror all the time:

- **During games:** team totals and anytime TDs.
- **At each game's finalize** (about 3 to 3.5 hours after kickoff): every player prop.

A board built on a real game before kickoff, or on a game under way with test mode on, scores by itself as the game
is played and finalized.

---

## 7. The automated run (the harness)

`overboard_sports_backend/node-server/scripts/e2e/run-e2e.mjs` runs the whole flow against your running
stack, through the API. It refuses to run unless `MONGODB_DATABASE_NAME` is `obs-b2b-dev` and the dev
tools answer with **local** scoring.

**What it does:**

1. Deletes every contest named `E2E harness …` in the tenant, so only one harness contest exists at a
   time.
2. Creates or reuses the library prize "E2E harness prize".
3. Creates `E2E harness <date> <time> #<n>`: Draft, test mode on, the game, a 1-bingo tier, then
   Published.
4. Signs in the fixture fan. It creates that fan on the fan Clerk dev instance on the first run, and
   joins the tenant through the gate's endpoint.
5. Builds a board from up to 8 players. The game is over, so this is a late join: the board must already hold
   every line its squares complete when it is read.
6. Replays the game, which must award nothing twice.
7. Checks that:
   - the line is claimed, and replay claimed nothing more;
   - the award is recorded and fulfilled;
   - the prize is the tier's prize;
   - an email landed in the outbox.

**The game.** Without `--game`, it takes the most recent finished NFL game from the test-mode picker
(14 days back, ending 6 hours ago). If the board has no complete line of hits, it deletes that contest
and tries the next game, up to five. `--game <betEventId>` pins a finished game, and the run fails if
that board has no line to win.

**What stays behind.** The run's contest and scored board stay on the tenant. It prints the board's URL
(`[e2e] PASSED — the board: …`). The exit code is 0 on pass, 1 on fail.

From `node-server/`, with the stack up:

```bash
OUT="/path/to/a/results/folder"
E2E_OUTBOX="<the worker's PRIZE_EMAIL_OUTBOX_DIR>" \
  node --env-file=.env scripts/e2e/run-e2e.mjs --out "$OUT/run.json"

# With screenshots of the real console and fan app. Playwright is not a dependency of the repo:
# `npm i playwright` anywhere and point E2E_PLAYWRIGHT at it. E2E_CHROMIUM is only needed when that
# Playwright's own browser isn't installed.
E2E_PLAYWRIGHT="file:///<path>/node_modules/playwright/index.mjs" \
E2E_CHROMIUM="<path to chrome.exe>" \
E2E_OUTBOX="<the worker's PRIZE_EMAIL_OUTBOX_DIR>" \
  node --env-file=.env scripts/e2e/run-e2e.mjs --screens "$OUT" --out "$OUT/run.json"
```

**Environment variables:**

| Variable | Default | Set it when |
|---|---|---|
| `E2E_OUTBOX` | `PRIZE_EMAIL_OUTBOX_DIR`, which the backend's `.env` doesn't have | Always: the worker's outbox folder |
| `E2E_API`, `E2E_ADMIN_APP`, `E2E_FAN_APP` | `http://localhost:3051`, `:5251`, `:5351` | You use other ports |
| `E2E_TENANT` | `test` | Your namespace's tenant is another slug |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | the `test` tenant admin test account | Your tenant has another admin |
| `E2E_FAN_EMAIL`, `E2E_FAN_PASSWORD` | the fixture fan | Rarely |

`--screens <dir>` saves numbered PNGs of each stage into `<dir>`. On failure it leaves
`failure-console.png` and `failure-fan.png` there. The API run without `--screens` is the pass/fail
source of truth.

---

## 8. Clean up

- **Delete a contest:** open the contest page → **More actions → Delete contest** → type the contest's
  name → **Delete permanently**.
  - Its boards, pending sends, tiers and sponsor placements go.
  - Prize records already fulfilled, failed or skipped stay, stamped with the contest's name.
  - Library prizes stay.
  - A **finalized** contest can't be deleted; the drawer doesn't offer it.
  - A delete is refused while one of the contest's prizes is being sent. Try again in a minute.
- **Or keep it but stop entries:** **Status → Close entries… → Close entries**. **Reopen entries** undoes
  it. **Move to draft** is offered only while no fan has joined.
- **PES:** every progress value put back (§6, step 5).
- **Outbox:** delete old files from the outbox folder whenever you like.
- **A clean slate for the `test` tenant:** from `node-server/`, dry-run
  `AWS_PROFILE=obs-b2b-dev AWS_SDK_LOAD_CONFIG=1 node --env-file=.env scripts/reset-test-fixtures.mjs`,
  read what it would do, then add `--apply`.
  - It deletes the `test` tenant's contests (apart from the harness's), their boards, tiers and
    deliveries, deliveries of contests that no longer exist, library prizes and sponsors other than the
    harness's and the fictional data-sharing sponsor Lakeshore Soda Co. (an older fixture's "Coca-Cola" record is renamed in place, with a new agreement version), the export history, and seed fans beyond the seven it keeps.
  - It reseeds the minimum that makes every console screen walkable: a Draft, an Open ("This Week"),
    a Closed contest ready to finalize (with sent, waiting and failed deliveries) and a Finalized one;
    two library prizes; and seven seed fans whose consents cover accepted, declined, not answered,
    an earlier wording and a missing field.
  - It touches only the `test` organization, only under the `arthur_` prefix, only in `obs-b2b-dev`.
    Real fans' identities and memberships, Clerk, support reports and the rest of the audit log are
    left alone. Re-running converges on the same set around the day it runs.

---

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| Backend won't start, or behaves like old code after a checkout or pull | Run `git submodule update --init --recursive` at the repo root, then `npm run build` in `node-server/` (it runs from `built/`) and `node build.mjs` in `prize-worker/`. |
| `/admin/dev/*` answers 404 (test mode, replay, status) | The dev routes are only mounted when all of these hold: `DEV_TOOLS=on`, `MONGODB_DATABASE_NAME=obs-b2b-dev`, a prefix that isn't `prod_`, and `DEPLOY_STAGE` not `prod`. Restart after changing `.env`. Test mode is refused for `org:member` and on a finalized contest. |
| `watcher not started` in the log, or replay answers "Scoring is off on this server" | `PRIZE_LOCAL_QUEUE_DIR` is missing from the backend's `.env`. |
| `standing by: … scores arthur_ now`; a bingo's email lands in another folder | Another server on your prefix holds the scoring lease: the last one started wins. Stop it, or restart yours to take the lease back. A server on code older than the lease doesn't take part and still scores alongside, so stop those or turn `DEV_TOOLS` off on them. |
| The board shows completed lines that were never awarded (a board from before 2026-09-28) | Open the board in the fan app, or wait for the next sweep: both award it. To award it now, dry-run `node --env-file=.env scripts/reconcile-boards.mjs --board <boardId>` from `node-server/` (after `npm run build`), then add `--apply`, with the `.env` of the server whose worker should deliver. Only name boards you mean to fix. |
| The line is claimed but no email arrives | The worker isn't running, has a different `PRIZE_LOCAL_QUEUE_DIR` or prefix, or has no `PRIZE_FROM_ADDRESS`. Queued messages wait in the folder until it starts. |
| Clerk asks for a code | **424242** on both dev instances (test mode). Only `+clerk_test` addresses; never list or touch real fan users. |
| The prize popup doesn't show again | It's remembered in the browser's localStorage, per board and bingo count (`prize-award-shown-<boardId>-<n>`). Delete that key, or use a private window. |
| The fan card reads "Opens …" / the join says "Entries open …" | The game's props aren't open yet. Turn on test mode through the dev API (§3). |
| "Players for this game aren't available yet" | The game has no visible props in PES yet. Pick another game. |
| No finished games in the game picker | Test mode is off (set it through the dev API, §3), or the game is older than 14 days. |
| The sport you want reads "No upcoming … games yet." | PES has no game of that sport still to start. College and baseball games often appear only hours before kickoff. |
| Contests made before Wave 3 look wrong in the Status section | They have no stored state yet; the code reads the old flags. The one-off fix for **your own** namespace: `node --env-file=.env scripts/contest-state-migration.mjs` (dry run), then `--apply`. Leave `nick_` alone unless Nick agrees. |
