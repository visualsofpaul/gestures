# Two-Hand Gesture Coordination via an Engine-Level Combinator

- **Status:** accepted
- **Workload:** 10h
- **Decider:** Paul Strebinger
- **Date:** 2026-07-29

## Context and Problem Statement

`GestureBuilder.requireBothHands()` already existed, setting `targetHandMode = "both"`. It was, and remains, non-functional: the engine filters detected hands by comparing `hand.handedness.toLowerCase()` (always `"left"` or `"right"`) against `targetHandMode`, which can never equal `"both"`. A single gesture cannot, by construction, require two hands at once through this mechanism.

Separately, before any two-hand work could begin, a root-cause defect had to be fixed: every rule (`FingerStateRule`, `FingerDistanceRule`) was evaluated against the _entire_ array of currently detected hands and matched if _any_ hand satisfied it. A gesture made of five individual finger-state rules could therefore be satisfied by five different rules each matching a _different_ hand, e.g. a fist on the left hand and a stray extended thumb on the right hand combining into a false "ThumbsUp" event. This made any reliable two-hand feature impossible to build on top of the existing evaluation model.

The instructor's own example use case for this issue was a two-hand combination, and the desired behavior was explicit: two-hand combinations should take priority over their constituent single-hand gestures, but two _unrelated_ single-hand gestures performed simultaneously with two hands must keep working independently.

## Decision Outcome

Chosen option: **Fix single-hand isolation at the rule-evaluation level, then implement two-hand coordination as an engine-level combinator (`engine.onGestures(nameA, nameB, callback)`) over two ordinarily-registered single-hand gestures**, rather than extending the per-gesture builder API.

### Isolation fix

`findAllMatchingHands` now evaluates every `basePoseRule` of a gesture against one specific candidate hand at a time (`rule.evaluate([hand])`), rather than passing the full hand array to each rule independently. A hand only counts as a match if it satisfies _all_ rules of a gesture by itself.

### Two-hand combinator

`onGestures` is evaluated once per frame, before the single-hand loop, directly against the raw detected hands for that frame using the already-registered `GestureBuilder`s for `nameA`/`nameB`. If a disjoint pair of hands (different `handedness`) is found where one satisfies `nameA`'s pose+direction+hold-duration and the other satisfies `nameB`'s, the combination fires (edge-triggered - once per formation, not repeatedly while held) and both hands are marked as consumed for the remainder of that frame's single-hand processing.

### Alternatives Considered

1. **Fix `requireBothHands()` to properly evaluate paired hands at the rule level.** Rejected: this would only support a single gesture requiring the _same_ pose on both hands (symmetric case) without a parallel builder API for asymmetric combinations (different pose per hand), and would duplicate the per-hand rule-evaluation logic that the isolation fix already introduces. `requireBothHands()` is left in place as documented, known-non-functional legacy rather than removed, since removing it is an unrelated, out-of-scope breaking API change; documenting the limitation was cheaper and equally honest within the timebox.
2. **Track two-hand matches passively while iterating the single-hand loop**, populating a shared per-frame map as a side effect of single-hand evaluation. This was the first working iteration, but was replaced because it made two-hand detection depend on incidental ordering and state from the single-hand loop (worse reliability, and `holdFor` was not tracked at all for the two-hand case), rather than being computed directly and first.
3. **Type-safety for `onGestures` via a boolean constructor option alone.** An initial version made the engine's two-hand support runtime-configurable via a plain `{ enableTwoHandGestures: boolean }` option, throwing at call time if disabled. This was upgraded to a conditional type (`OnGesturesMethod<..., TwoHandGesturesEnabled>`) driven by a second generic parameter on `GestureEngine`, so that calling `onGestures` when disabled is a compile-time type error (the property types as `undefined`) rather than only a runtime exception. This requires an explicit generic type argument (`new GestureEngine<never, true>({ enableTwoHandGestures: true })`) at the call site, because TypeScript widens `true` to `boolean` when inferring a generic parameter from an object-literal property, which would otherwise silently weaken the guarantee.

## Technical Evaluation and Honest Observations

### Pros

- Two-hand combinations reuse ordinary single-hand `GestureBuilder` definitions; no separate DSL, no duplicated pose-authoring for combinations.
- Naturally supports both symmetric (`"Fist"`, `"Fist"`) and asymmetric (`"ThumbsUp"`, `"MiddleFinger"`) combinations with the same API.
- Priority behavior (combination wins over its constituents) and independence of unrelated single-hand gestures are both explicit, tested behaviors rather than incidental ones.
- Disabling two-hand support at compile time (rather than merely at runtime) prevents the API from being used by accident in code paths that never intended to depend on a second hand.

### Cons

- **Consumption granularity is coarse.** Once a hand participates in _any_ actively-matched two-hand combination, that entire hand side (`"Left"`/`"Right"`) is withheld from _all_ single-hand gesture detection until the combination releases, not just from the two specific gestures making up that combination. A narrower, per-(gesture, hand) consumption scheme was considered but the simpler, whole-hand-side scheme was kept once it became clear it matched the desired user-facing behavior closely enough and reduced state-tracking complexity.
- **`idleFor` cooldown for a combination is `Math.max` of both halves' individual `idleFor` values**, rather than independently configurable for the combination itself. A dedicated per-combination cooldown parameter would be cleaner but was out of scope for the timebox.
- **Per-hand `holdFor` tracking for two-hand combinations uses a separate timestamp map** (`twoHandFirstDetectedTimestamps`, keyed by `"gestureName:handedness"`) distinct from the single-hand loop's per-gesture-name timestamps, because the same gesture name can be simultaneously "held" on two different hands. This is correct but is additional state that must be kept in sync manually rather than derived from a single source of truth.
