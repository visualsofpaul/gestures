# Choosing the Deepening over a new Vision Application

- **Status:** accepted
- **Workload:** 0.5h
- **Decider:** Paul Strebinger
- **Date:** 2026-07-29

## Context and Problem Statement

The last issue asks for one of two equally-weighted paths: build a new, polished showcase application on top of the library (Way A), or take an existing, self-observed weakness and solve it properly (Way B), with a documented before/after. The timebox is 20-24 hours, explicitly not a license for scope explosion.

Going into this issue, a working Reveal.js slide-control demo already existed from the previous issue, built exclusively against the library's public API, and had already been presented to and well received by the course instructor. During that work, two concrete weaknesses had already surfaced organically, without deliberately looking for them:

1. Two-hand poses were silently merged: a rule evaluated against the full set of detected hands could match if _any_ hand satisfied it, so a fist on one hand and a thumbs-up on the other could combine into a false "ThumbsUp" detection instead of being correctly attributed to a single hand.
2. The gesture vocabulary had no way to express poses that depend on two fingers being spread apart (e.g. a Peace sign), only "closer than X" was supported, never "farther than X".

## Decision Drivers

- A second, unrelated showcase application would need to clear a meaningfully higher creative/UX bar than the existing Reveal.js demo to justify itself as "Way A" rather than "more of the same"; no such concept was in hand at decision time.
- A concrete, already-observed defect with a natural before/after measurement was available for Way B, satisfying that path's acceptance criteria almost directly.
- The instructor's own example for this issue (in a prior conversation) specifically referenced two-hand gesture combinations as an interesting extension, a strong signal that this direction has demonstrable value beyond the author's own curiosity.

## Decision Outcome

Chosen option: **Way B - Deepening**, scoped to three connected pieces of work:

1. Fix the single/two-hand pose isolation defect at its root (rule evaluation against one specific hand instead of the full hand array).
2. Build genuine two-hand gesture coordination (`engine.onGestures(...)`) on top of that fix, since a correct per-hand evaluation is the prerequisite for reliable two-hand detection in the first place.
3. Generalize the distance-based part of the gesture vocabulary (pinches, also spreads, plus a non-gating continuous-tracking mode) to close the Peace-sign gap and enable finger-based zoom-style interactions.

### Alternative Considered: Way A, a new Vision Application

Rejected. The existing Reveal.js demo already exercises the library's public API end-to-end and was already validated with the instructor. Building a second application in the same timebox without a clearly stronger concept risked producing something that reads as "the same demo again", which is explicitly discouraged by the task description. Way B's acceptance criteria (clear problem statement, before/after measurement, documented trade-offs) were also a closer match to defects already found during regular development, rather than requiring a new problem to be invented.

## Consequences

- The Reveal.js demo remains the single showcase application; no second demo project exists in the repository.
- All further ADRs in this batch (two-hand gestures, distance tracking) are direct children of this decision.
- The acceptance criterion before/after measurement is satisfiable per sub-topic (isolation bug, two-hand reliability, vocabulary gap) rather than for a single monolithic change, documented individually in the respective ADRs.
