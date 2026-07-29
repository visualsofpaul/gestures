# Deliberately Deferred Scope for This Deepening

- **Status:** accepted
- **Workload:** 0.5h
- **Decider:** Paul Strebinger
- **Date:** 2026-07-29

## Context and Problem Statement

The task explicitly warns against scope explosion despite the extended timebox. Over the course of implementing the isolation fix, two-hand coordination, and the distance/measurement vocabulary (ADR-0011, ADR-0012), several additional, legitimate improvements surfaced but were consciously not pursued. This ADR records them together with the reasoning for deferring each one, so that "not implemented" reads as a deliberate boundary rather than an oversight.

## Decision Outcome

The following items are explicitly out of scope for this deepening:

### 1. Edge-triggered single-hand static poses

Static poses without `.curling(...)` (e.g. `ThumbsUp`, `Fist`) fire repeatedly every `idleFor` milliseconds while continuously held, rather than once per "hold session" the way triggered gestures and two-hand combinations already do. A fully edge-triggered variant (fire once, require the pose to disappear before firing again) was prototyped during development and works, but was reverted to keep the timebox focused on two-hand reliability instead of retrofitting every existing preset's expected behavior. **Trade-off accepted:** the engine currently has two different repeat philosophies depending on gesture type, which is an inconsistency a future pass should resolve - most naturally by making everything edge-triggered and introducing a distinct, explicit "repeat while held" opt-in for the cases that actually want it.

### 2. Proper fix or removal of `GestureBuilder.requireBothHands()`

As documented in ADR-0011, `.requireBothHands()` remains present but non-functional. Fixing it properly would mean supporting genuine per-gesture two-hand pose declarations (likely requiring a second builder API for asymmetric per-hand rules), which is a materially larger feature than the engine-level `onGestures(...)` combinator that already solves the same real-world need. Removing it outright would be an unrelated breaking API change. **Trade-off accepted:** the dead code stays, clearly documented as non-functional in `DOCUMENTATION.md`, rather than either fixed or removed.

### 3. Per-(gesture, hand) consumption granularity for two-hand combinations

Currently, once a hand participates in an active two-hand combination, that whole hand side is withheld from all single-hand detection, not only from the two specific gestures forming the combination. A narrower scheme is possible but adds meaningfully more state-tracking complexity for a difference in behavior that did not present itself as a problem in practice during testing.

### 4. Independently configurable cooldown per two-hand combination

The cooldown for a combination is currently derived as `Math.max` of both halves' individual `idleFor` values rather than being its own configurable parameter on `onGestures(...)`. A small, well-scoped follow-up if a project needs combination-specific timing distinct from either individual gesture's timing.

### 5. Pull-based continuous measurements API

As documented in ADR-0012, `.tracks(...)` values only update when their host gesture fires, coupling a nominally "continuous" measurement to that gesture's own cadence. A `engine.getMeasurements(name)`-style pull API, queryable every frame independent of any gesture firing, would be the correct long-term solution for genuinely continuous interactions like pinch-to-zoom.

### 6. Systematic calibration of distance thresholds

The default ratios for `.pinches(...)` (`0.25`) and `.spreads(...)` (`0.5`) were verified functionally but not calibrated against varying hand sizes, camera distances, or lighting conditions - the kind of systematic accuracy work that the previous issue's API test already began for other parts of the vocabulary.

## Consequences

None of the above affect the correctness or reliability of what was actually shipped in ADR-0011 and ADR-0012 - they are extensions or refinements of already-working behavior, not open defects. They are surfaced here, together, rather than left as scattered TODO comments, so a reader of the repository's decision history understands the boundary was drawn on purpose. A short "Known Limitations" section in the README links back to this ADR for readers who only want the quick summary.
