# Generalizing Finger-Distance Rules into Spreads and Continuous Measurements

- **Status:** accepted
- **Workload:** 2.0h
- **Decider:** Paul Strebinger
- **Date:** 2026-07-29

## Context and Problem Statement

`FingerDistanceRule` only ever expressed "these two fingertips are closer than X" (used by `.pinches(...)`). There was no way to express the opposite condition - "these two fingertips are farther apart than X" - which is required for poses like a Peace/V sign (index and middle finger spread). Beyond gating a single pose, there was also no way for a consumer of the library to obtain a _continuous_, numeric distance value at all: `GestureEvent` carried only a discrete `confidence` value, not any raw measurement, which rules out use cases like finger-based pinch-to-zoom that need a value that changes smoothly, not just a boolean match.

## Decision Outcome

Chosen option: **Add a `mode: "min" | "max"` parameter to the existing `FingerDistanceRule`** (defaulting to `"max"`, preserving all existing pinch behavior unchanged) **and introduce three builder-level entry points with a clear division of responsibility**:

- `.pinches(fingerA, fingerB, maxRatio?)` - gates on "close enough" (existing behavior, now with a configurable ratio instead of a hardcoded `0.25`).
- `.spreads(fingerA, fingerB, minRatio?)` - new; gates on "far enough apart", enabling Peace-style poses.
- `.tracks(fingerA, fingerB, key?)` - new; records the distance for measurement purposes only, without adding any matching constraint at all.

All three automatically register the underlying rule for measurement. `Rule.evaluate(...)` gained an optional `value` field (the raw, normalized distance ratio), and `GestureEvent` gained an optional `measurements: Record<string, number>` field, populated from every registered measurement source of the gesture that fired, keyed by default as `` `${fingerA}${fingerB}Distance` `` or by an explicit custom key.

### Alternatives Considered

1. **A separate `FingerSpreadRule` class duplicating `FingerDistanceRule`.** Rejected as a DRY violation - the geometry (fingertip distance relative to hand size) is identical, only the comparison direction differs. The mode-parameter approach was chosen instead, accepting a small, backward-compatible constructor signature change (new optional 5th parameter, default `"max"`).
2. **Only add gating `.spreads()`, skip `.tracks()`/`measurements` entirely.** Rejected: it would close the Peace-sign gap but not the second, explicitly desired use case (continuous, finger-based zoom), which specifically needs a value independent of any gating threshold.
3. **A single always-gating distance rule with an optional "informational only" flag**, rather than a separate `.tracks()` method. Rejected in favor of a distinct method name, since "does this rule affect matching or not" is a meaningfully different intent that deserves to be visible directly in the fluent chain, not hidden behind a boolean flag argument.

## Technical Evaluation and Honest Observations

### Pros

- Fully additive at the type level: `Rule.value` and `GestureEvent.measurements` are both optional, and `FingerDistanceRule`'s new constructor parameter has a default that preserves every existing call site's behavior unchanged. No breaking changes for existing consumers of `.pinches(...)`.
- `.tracks()` cleanly separates "does this affect whether the gesture matches" from "do I want to observe this value", which previously had no answer at all in the API.
- The measurement key naming convention (`` `${fingerA}${fingerB}Distance` ``, overridable) means most callers get a sensible, predictable key without having to name anything themselves.

### Cons and Known Trade-offs

- **`.tracks()`'s continuous measurement is not actually independent of the host gesture's own firing cadence.** A measurement only appears on a `GestureEvent` when that gesture itself fires - for a static pose that repeats every `idleFor` milliseconds, this is frequent enough for smooth zooming, but for a gesture with a longer `idleFor` or an edge-triggered `.curling(...)` gesture, the measurement would update far less often than a genuinely continuous stream would. A pull-based API (e.g. `engine.getMeasurements(name)`, queryable independently of any event firing) would solve this properly but was out of scope for the timebox; documented as deferred future work.
- **The default distance ratios (`0.25` for pinch, `0.5` for spread) were chosen by inspection/feel rather than by a systematic calibration process** across varying hand sizes, camera distances, or lighting - no formal accuracy measurement was performed for the spread threshold specifically, only functional verification that a Peace sign built with the default value matches reliably in normal use. A per-preset calibration pass is a reasonable follow-up if the vocabulary is extended further.
