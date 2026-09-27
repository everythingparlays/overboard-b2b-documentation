# Trivia — game type PRD

**Status:** Draft, written 2026-09-26, revised 2026-09-26. Owner: Nick Depies.

**Implementation:** [`spec/features/1-draft/trivia-game-type.spec.md`](../../spec/features/1-draft/trivia-game-type.spec.md)
carries the data model, timing, integrity mechanics, connectivity strategy and migration. This
document is the business requirement; the spec is how it gets built.

---

## 1. Why

Trivia is a new game type — another option for our customers to engage their fanbases, alongside
bingo. It is an alternative format, not a replacement: a tenant can also run a bingo contest and a
trivia contest at the same game, and a fan can enter both.

The constraint that shapes everything below: **it has to integrate with what we already have**, on
the admin console and the fan app both. One contest model, one prize pipeline, one branding system.
A second game that needs a second stack costs more than it earns.

---

## 2. What trivia is

Walking through it in order, from setup to payout:

1. **The tenant turns it on.** From the admin console, no ticket to engineering. They build a bank
   of questions and tag them, then decide which tags feed which question in a run — that's the
   mechanism that lets every fan get "the same game" without ever seeing the same question as the
   fan next to them. They set run count, time per question, scoring weights, and prize bands. A
   prize they already built for bingo works for trivia unchanged — they just tell it that finishing
   position now qualifies too.
2. **The fan finds it.** Trivia sits next to bingo in the same contest list, reached through the
   same sign-in and the same QR code — nothing new to set up or opt into.
3. **The fan plays.** They start a run whenever they like while the contest is open and answer a
   fixed set of multiple-choice questions, each against its own clock. Getting one right is worth
   something; getting it right *fast* is worth more.
4. **The fan finishes.** Their score locks in for good the instant the run ends — though their
   rank can still move as other fans finish their own runs afterward.
5. **The contest closes.** The leaderboard settles for the last time.
6. **Prizes go out.** By finishing-position band, through the same pipeline that already pays out
   bingo winners.

That's the whole of V1: a selectable game type, a tenant-owned tagged question bank (with an
Overboard starter set to copy from), self-paced runs, accuracy-and-speed scoring, one shared
leaderboard, rank-band prizes on the existing prize model, running normally on stadium
connectivity.

---

## 3. What trivia is not

- **Not synchronized play.** There's no moment where every fan answers the same question at the
  same time, like a live quiz show. Play is self-paced, any time while the contest window is open.
  Synchronized play is a real idea for later — just not this version.
- **Not a battle mode.** No head-to-head, no team-vs-team, no bracket. Every fan lands in one shared
  pool, ranked against everyone else who played.
- **Not a bingo replacement.** It's an addition. A tenant can run a bingo contest and a trivia
  contest at the same game, and a fan can play both.
- **Not a new account or consent flow.** A fan who's already signed in and opted in does nothing
  extra to play trivia.
- **Not a second prize system.** Prizes are authored once, in one place, for any game type; trivia
  just adds "finishing position" as a way to qualify for one.
- **Not ticket-bound.** Nothing stops one person from creating several accounts and keeping their
  best run. That's a known, accepted trade-off, not an oversight — see Integrity (§10).

---

## 4. The contest

**TRV-01 [V1] — Trivia is a game type of a contest, and a tenant may run more than one contest at a
game.** A bingo contest and a trivia contest can be open at the same event, and a fan may enter
both. Neither is the tenant's default and neither excludes the other.

**TRV-02 [V1] — Trivia introduces no new entry surface.** Fans reach it through the same QR code and
team app entry points as every other contest, and through the existing sign-up, sign-in and opt-in
consents. Trivia asks a fan for nothing new.

**TRV-04 [CONSTRAINT] — A contest's game type is fixed once a fan has joined it.**

**TRV-05 [V1] — A tenant configures a trivia contest entirely from the admin console,** with no
engineering involvement (`GAME-04`).

**TRV-51 [V1] — A fan sees one contest list regardless of game type,** and it correctly shows
whether they have already entered each contest.

---

## 5. The question bank

**TRV-06 [V1] — Questions belong to the tenant and are classified only by tags.** No question types,
no built-in categories.

**TRV-07 [V1] — Overboard provides a starter bank tenants may copy from.** Copying seeds a tenant's
own bank and creates no ongoing dependency. A tenant may copy none, some or all, and may edit or
delete anything it copies.

**TRV-08 [V1] — A contest is composed by deciding, for each question in a run, which tags it may
draw from.** This is what lets every fan get the same kind of run while getting different questions.

**TRV-09 [V1] — A sponsor question is an ordinary question with a sponsor tag.** Worth the same as
any other, configured the same way.

**TRV-11 [CONSTRAINT] — Overboard sets no minimum bank size.** Bank size relative to run length
decides how often two fans see the same question, and that is the tenant's call. The console makes
the consequence visible; it does not block the configuration.

---

## 6. The run

**TRV-12 [V1] — A fan may start a run at any time while the contest is open.**

**TRV-13 [V1] — Every fan in a contest answers the same number of questions,** and that number is
configurable. A fixed count is what makes scores comparable.

**TRV-14 [V1] — How many runs a fan may take is configurable, and only their best score counts.** A
second run can never lower a standing. Where one run is allowed, the product offers no retry.

**TRV-15 [V1] — Time allowed per question is configurable per contest.**

**TRV-16 [V1] — A fan's first answer to a question is final.**

**TRV-17 [V1] — Fans receive different questions from one another,** and **TRV-18 [V1] — in a
different order of options.**

**TRV-42 [V1] — A fan is never served a question they have already seen in an earlier run.**

---

## 7. Scoring and fairness

**TRV-19 [V1] — Score combines accuracy and speed.** A correct answer earns a base; a faster correct
answer earns more. Both configurable per contest.

**TRV-20 [V1] — An incorrect or unanswered question is worth nothing,** including its speed
component.

**TRV-21 [V1] — A fan is not penalised for their connection.** The clock runs from when the question
appears on their phone, not from when the server sent it. Two fans with the same knowledge should
score the same whether they are on arena Wi-Fi or a contended cell.

**TRV-22 [V1] — A fan's score is final the moment their run ends.** Only their rank moves afterwards.

---

## 8. Standings

**TRV-24 [V1] — A single pool: every fan is ranked against every other fan in the contest.**

**TRV-25 [V1] — Rank is by best score across a fan's completed runs.**

**TRV-26 [V1] — A fan can see their score and standing at any time while the contest is open.**

**TRV-27 [V1] — A standing shown before the contest closes is provisional, and must be presented as
provisional.** The score is settled; the position is not, because other fans are still playing.

**TRV-28 [V1] — Ties break to whoever finished first.**

---

## 9. Prizes

**TRV-49 [V1] — A prize is authored once and usable by any game type.** What a prize is — name,
description, image, claim instructions, fulfilment handler, value, redemption terms — has nothing to
do with which game won it. A tenant sets up a prize once and can award it from a bingo contest and a
trivia contest both, changing its terms in one place.

**TRV-50 [V1] — How a fan qualifies is defined per game type.** Bingo qualifies on lines completed;
trivia on finishing position. A future game type adds a way to qualify and touches no prize.

**TRV-57 [V1] — Existing prize configuration is preserved.** No tenant re-enters prize data.

**TRV-31 [V1] — Trivia prizes are awarded by finishing-position band, and a contest may define as
many bands as it wants** (1–10, 11–30, 31–70, and beyond). Where a surface can only show a few, it
shows the first three that carry a prize.

**TRV-29 [V1] — A contest closes at the end of its game by default, and the close time is separately
configurable.**

**TRV-30 [V1] — Final standings are settled once at close and do not change afterwards.**

**TRV-32 [V1] — Prizes are distributed through the existing prize pipeline, but only once a tenant
admin explicitly sends them.** Standings settle automatically at close; a "send prizes" action in
the admin console is the separate, deliberate step that triggers fulfilment. This is the review
chokepoint `TRV-45` requires for high-value bands — nothing goes out until someone chooses to send
it.

---

## 10. Integrity

Prizes of real value are awarded on these results, so the results have to be defensible to a fan who
asks.

**TRV-33 [V1] — The contest must be resistant to fans sharing answers.** Play is asynchronous, so a
fan who plays late can be told the answers by a fan who played early, and a countdown does nothing
about that. Serving different questions to different fans (`TRV-17`, `TRV-18`) is the control that
works.

**TRV-34 [V1] — Correctness, scoring and rank are determined by Overboard, not reported by the fan's
device.**

**TRV-45 [V1] — High-value awards are reviewed before they are fulfilled.** Which bands are reviewed
is configurable.

**TRV-56 [V1] — Changes to a tenant's question bank are auditable.**

**Accepted risk.** Binding an entry to a ticket was considered and rejected. Nothing prevents a
person creating several accounts and taking their best result. This is a decision already taken,
recorded so it is not rediscovered as a gap. It generates no requirement.

---

## 11. Reliability in the venue

**TRV-38 [V1] — A fan must be able to play, and finish, on arena connectivity.** A dropped
connection must not cost a fan an answer or a run.

**TRV-59 [V1] — A fan gets a default network credit of up to 5 seconds per question,** and because
questions are served one at a time, a connection that times out before an answer arrives can be
recovered with a substitute question — up to 3 substitutions per run — rather than failing the run
outright. Both numbers are starting defaults, not final: see Open decisions (§16).

---

## 12. Branding and sponsorship

**TRV-40 [V1] — Trivia carries whatever branding and sponsors the tenant has already set up.** There
is no trivia-specific sponsor configuration.

**TRV-48 [V1] — Where trivia offers a placement the sponsor kit cannot express, a field is added to
the kit** per [`branding-field-split.md`](./branding-field-split.md), never a parallel model.

---

## 13. Governance

**TRV-54 [V1] — Editing the question bank is `org:admin`-only.** `org:admin` authors and edits
questions, and creates, edits and deletes tags. `org:member` can view the entire bank and its tags
but cannot change any of it.

**TRV-55 [V1] — The starter bank is Overboard-owned** and never editable by a tenant.

---

## 14. Compliance

**TRV-41 [V1] — Official rules are published before the first contest runs,** covering
no-purchase-necessary entry, the run limit, the tie-break, prize bands, and forfeiture terms.

---

## 15. Acceptance criteria

1. A tenant admin creates and opens a trivia contest — slots and tags, run count, per-question time,
   scoring and prize bands — with no engineering involvement.
2. A tenant runs a bingo contest and a trivia contest at the same game; a fan enters both, and the
   contest list correctly reflects their entry in each.
3. Two fans in the same contest get different questions, in a different order of options.
4. A fan who finishes a run sees a score that never changes afterwards, and a rank shown as
   provisional until close.
5. A fan whose connection drops during a run still finishes it, and their answers arrive later.
6. A fan permitted multiple runs is ranked on their best, and never sees a repeated question.
7. One authored prize is referenced by a bingo tier and a trivia band at once; editing its claim
   copy changes both.
8. At close, standings settle once, bands resolve to prizes, and awards enter the existing pipeline.
9. A contest set to one run per fan offers no retry.
10. An `org:admin` authors a question and creates a tag; an `org:member` can see both but has no
    edit control anywhere in the bank.
11. A tenant admin clicks "send prizes" after a contest closes and awards enter the existing prize
    pipeline; nothing is sent before they do.

---

## 16. Open decisions

1. **Which prize bands are reviewed before fulfilment** (`TRV-45`) — by prize value or by band
   position. The review step itself is decided (`TRV-32`: nothing sends until an admin clicks "send
   prizes"); what's open is which bands that admin is required to look at before clicking it.
2. **Whether 5 seconds of network credit and 3 substitute questions (`TRV-59`) are the right
   numbers.** They're the starting defaults, but the same knob sets how forgiving the game is on a
   bad connection and how much a bad actor could gain from claiming one. It needs measurement inside
   the venue during a live game before it's final. See the spec's "Timing" section for what it
   controls.
