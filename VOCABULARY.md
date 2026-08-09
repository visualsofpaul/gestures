# Gesture Vocabulary & Library Philosophy

> **Single Source of Truth & Reflection:**
> This document represents the authoritative specification of the `gestures` ecosystem. It synthesizes the production-ready implementation of the fluent API, the engine pipeline, and the optimized anatomical presets.
>
> **The Philosophy:**
> **Anatomy over Interaction.** This package **does not hardcode specific interaction meanings** (like "Next Slide" or "Volume Up"). Instead, it serves as an open, extensible framework. It provides a set of highly optimized **Anatomical Presets** and a fluent **Custom Builder Engine** allowing developers to assemble their own gesture logic like a sentence.

## 1. Core Anatomical Presets

The library exports a foundational vocabulary under the `gestures/presets` subpath. These presets focus purely on the structural state of the hand, exposing rich metadata (`hand: "left" | "right" | "both" | "any"`, `direction: Direction`) to the application layer.

| Preset Identifier        | Anatomical Description & Core Trigger                                                                                                                                          | Low-Level Constraints (The Fluent DSL Logic)                                                                                               |
| :----------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| **`Presets.ThumbsUp`**   | A crisp sign where the thumb is extended and all other fingers are tightly curled. <br><br>_Use Case: Vertical triggers / approval signals._                                   | 1. `Thumb` = State: Extended.<br>2. `Index`, `Middle`, `Ring`, `Pinky` = State: Curled.<br>3. `.determineDirectionFrom(Finger.Thumb)`      |
| **`Presets.Pointer`**    | Classic pointing pose with the index finger extended. <br><br>_Use Case: Directional swipes or navigation._                                                                    | 1. `Index` = State: Extended.<br>2. `Thumb`, `Middle`, `Ring`, `Pinky` = State: Curled.<br>3. `.determineDirectionFrom(Finger.Index)`      |
| **`Presets.Gun`**        | Thumb and Index extended, remaining fingers curled (resembling a pistol). The gesture triggers when the index finger gets curled. <br><br>_Use Case: Dynamic trigger actions._ | 1. `Thumb` = State: Extended.<br>2. `Middle`, `Ring`, `Pinky` = State: Curled.<br>3. `.thenTriggeredBy().curling([Finger.Index])`          |
| **`Presets.PinkyPinch`** | The tip of the thumb firmly touches the tip of the pinky, closing an anatomical loop. <br><br>_Use Case: Discrete background toggle / system command._                         | 1. `.pinches(Finger.Thumb, Finger.Pinky)` (Tip Proximity, default max ratio 0.25).                                                         |
| **`Presets.Fist`**       | All five fingers are tightly curled into the palm. <br><br>_Use Case: Hard stop or grab modifiers._                                                                            | 1. All 5 fingers = State: Curled via `.isClosedInto(State.Curled)`.                                                                        |
| **`Presets.Peace`**      | Index and middle fingers extended, remaining fingers curled (classic "V" sign). <br><br>_Use Case: Directional swipes or navigation._                                          | 1. `Index`, `Middle` = State: Extended.<br>2. `Thumb`, `Ring`, `Pinky` = State: Curled.<br>3. `.spreads(Finger.Index, Finger.Middle, 0.5)` |

None of the presets set a `holdFor`/`idleFor` value internally, timing and cooldown behavior is always configured by the consumer at registration time (see below), so the same preset can behave differently depending on the use case.

These presets are instantiated with a custom runtime identifier string and can be registered directly into the engine pipeline:

```typescript
import { GestureEngine, Direction, Gesture, Finger, State } from "gestures";
import { Presets } from "gestures/presets";

const engine = new GestureEngine()
  .register(Presets.ThumbsUp("ThumbsUp"))
  .register(Presets.Pointer("Pointer"))
  .register(Presets.Fist("Fist"))
  // Mark as system gesture to keep it active even when the engine is paused
  .register(Presets.PinkyPinch("PinkyPinch").asSystemGesture());

engine.bindWebcam({
  videoElement: document.getElementById("webcam") as HTMLVideoElement,
});

// Option A: Quick Lifecycle Toggle (System gesture runs in background)
engine.onGesture("PinkyPinch", (event) => {
  engine.toggleActiveState();
  console.log(engine.isActive ? "Resumed tracking" : "Muted tracking");
});

// Option B: Context-aware execution (Only processes events when active state is true)
engine.onGesture("Pointer", (event) => {
  if (event.direction === Direction.Right) {
    console.log("Swipe Right 👉");
  } else if (event.direction === Direction.Left) {
    console.log("Swipe Left 👈");
  }
});

engine.onGesture("ThumbsUp", (event) => {
  console.log("Thumbs Up Detected 👍", event);
});

// Execute functions on active state changes
engine.onActiveState((event) => {
  console.log("Gesture detection active state changed:", event.activeState);
});
```

By default the engine starts in the **inactive** state, only gestures marked `.asSystemGesture()` are processed until `startActiveState()` / `toggleActiveState()` is called. If you want detection to run for every gesture right from the start (no manual activation gesture needed), pass `startActive: true` when constructing the engine (see Section 4).

## 2. The Extensible Building Kit (Custom Gestures)

If the presets are not sufficient, the core strength of the library is its **Fluent API**. New gestures can be registered completely inline within the application code without ever changing the library core.

### Example 1: Building a Custom "Click" Action

A developer can combine static base poses with dynamic inflection triggers via `.thenTriggeredBy().curling()`. The state machine tracks the transition from the uncurled base pose to the curled state. `.holdFor(ms)` here requires the _base pose_ (thumb extended) to be held for the given duration before a curl is even allowed to count as a trigger, this filters out accidental momentary poses during hand movement:

```typescript
import { Gesture, Finger, State } from "gestures";

const customClick = Gesture.create("CustomClick")
  .where.anyHand()
  .has(Finger.Thumb)
  .inState(State.Extended)
  .thenTriggeredBy()
  .curling([Finger.Index, Finger.Middle]) // Triggers on rapid contraction
  .holdFor(300) // Base pose must be held stably before a curl counts
  .withConfidence(0.75);
```

Gestures built this way are **edge-triggered**: once the trigger fingers curl and the gesture fires, the fingers must be extended again (releasing the trigger) before it can fire a second time.

### Example 2: Hold-to-Trigger Gestures (No Dynamic Trigger)

If a gesture does not have a dynamic "click" action but instead requires the user to intentionally hold a specific anatomical pose for a period of time, use `.holdFor(ms)` to prevent accidental triggers:

```typescript
import { Gesture, Finger, State } from "gestures";

const offensiveManeuver = Gesture.create("MiddleFinger")
  .where.anyHand()
  .has(Finger.Middle)
  .inState(State.Extended)
  .has(Finger.Thumb)
  .inState(State.Curled)
  .has(Finger.Index)
  .inState(State.Curled)
  .has(Finger.Ring)
  .inState(State.Curled)
  .has(Finger.Pinky)
  .inState(State.Curled)
  .where.determineDirectionFrom(Finger.Middle)
  .holdFor(2000); // Must be intentionally held for 2 seconds to fire
```

Unlike the triggered example above, a static pose without `.curling(...)` **repeats**: once `holdFor` is satisfied, it fires again every `idleFor` milliseconds for as long as the pose is held (default `idleFor` is `0`, meaning it fires on every processed frame, always set an explicit `.idleFor(...)` for anything the user might hold for more than a moment).

### Example 3: Distance-Based Gestures (Peace, Zoom, and Friends)

Some gestures aren't about finger state alone but about the **distance between two fingertips**. `.pinches(...)` (fingers close together) and its counterpart `.spreads(...)` (fingers far enough apart) both gate the gesture _and_ automatically expose the measured distance ratio on the resulting `GestureEvent.measurements` object:

```typescript
import { Gesture, Finger, State } from "gestures";

const peace = Gesture.create("Peace")
  .where.anyHand()
  .has(Finger.Index)
  .inState(State.Extended)
  .has(Finger.Middle)
  .inState(State.Extended)
  .has(Finger.Thumb)
  .inState(State.Curled)
  .has(Finger.Ring)
  .inState(State.Curled)
  .has(Finger.Pinky)
  .inState(State.Curled)
  .spreads(Finger.Index, Finger.Middle, 0.5) // Index & middle must be spread apart
  .where.determineDirectionFrom(Finger.Index);

engine.onGesture("Peace", (event) => {
  console.log(event.measurements?.IndexMiddleDistance); // e.g. 0.63
});
```

For cases where you want a **continuous** measurement regardless of whether it gates anything, for example a pinch-to-zoom interaction, use `.tracks(fingerA, fingerB, key?)`. It records the distance in `measurements` without adding a matching constraint:

```typescript
const pinchZoom = Gesture.create("PinchZoom")
  .where.anyHand()
  .has(Finger.Thumb)
  .inState(State.Extended)
  .has(Finger.Index)
  .inState(State.Extended)
  .tracks(Finger.Thumb, Finger.Index, "zoomDistance");

engine.onGesture("PinchZoom", (event) => {
  const distance = event.measurements?.zoomDistance;
  if (distance !== undefined) applyZoom(distance);
});
```

### Example 4: Two-Hand Coordination

Multi-hand macros are **not** built via `.requireBothHands()`, that mode exists on the builder but is currently non-functional (it can never match, since detected hands are always reported as `"Left"`/`"Right"`, never `"both"`). Instead, two-hand coordination is a property of the **engine**, not of an individual gesture: you register two ordinary single-hand gestures and combine them with `engine.onGestures(...)`.

This requires constructing the engine with two-hand support explicitly enabled, and, for full type safety, annotated with an explicit generic argument so `onGestures` is actually typed as callable instead of `undefined`:

```typescript
import { Gesture, GestureEngine, Finger, State, Direction } from "gestures";
import { Presets } from "gestures/presets";

const engine = new GestureEngine<never, true>({ enableTwoHandGestures: true })
  .register(Presets.ThumbsUp("ThumbsUp"))
  .register(
    Gesture.create("PointUp")
      .where.anyHand()
      .has(Finger.Thumb)
      .inState(State.Extended)
      .isPointing(Direction.Up)
      .holdFor(500),
  );

const systemReset = engine.onGestures(
  "ThumbsUp",
  "PointUp",
  (eventA, eventB) => {
    console.log("System reset triggered by", eventA.hand, eventB.hand);
  },
);
```

Two-hand combinations take **priority** over the individual single-hand gestures they're built from: while a combo is actively matched, both participating hands are withheld entirely from single-hand gesture detection until the combo is released (i.e. at least one side stops matching). Two other, unrelated single-hand gestures performed with two hands that don't happen to form a registered combo continue to work completely independently.

If `enableTwoHandGestures` is left at its default (`false`), `onGestures` is typed as `undefined`, calling it is a compile-time error, not just a silent no-op or runtime exception.

## 3. Constructing the Engine

```typescript
new GestureEngine<RegisteredGestures, TwoHandGesturesEnabled>(options?: {
  enableTwoHandGestures?: boolean; // default false, annotate the generic explicitly when true
  startActive?: boolean;           // default false, start processing all gestures immediately
})
```

See `DOCUMENTATION.md` for the full API reference.
