# Gestures

`gestures` is a small gesture-recognition library for webcam-based hand tracking. It lets you define gestures in plain, fluent TypeScript and listen for them as simple events in your app.

The package is split into two import paths:

- `gestures` for the core engine, gesture builder, and shared types
- `gestures/presets` for ready-made gestures you can use immediately or customize further

## What it is good for

Use `gestures` when you want to turn hand shapes and finger movements into app actions such as navigation, shortcuts, or system-like controls.

The library works with these ideas:

- Choose which hand should count: left, right, or any hand
- Describe finger states such as extended or curled
- Detect pinch-like poses between two fingertips, or the opposite - fingers spread apart
- Detect a gesture direction from a specific finger
- Trigger a gesture from a follow-up motion, not just a static pose
- Apply hold durations and cooldowns so gestures don't fire too early or too often
- Coordinate two hands into a single combined gesture
- Expose continuous finger-distance measurements for things like pinch-to-zoom

## Quick start

Install the package and import the core API:

```ts
import {
  Finger,
  Gesture,
  GestureEngine,
  State,
  type GestureEvent,
} from "gestures";
import { Presets } from "gestures/presets";
```

Create an engine, register gestures, bind a webcam, and listen for events:

```ts
const engine = new GestureEngine()
  .register(Presets.ThumbsUp("ThumbsUp").holdFor(500).idleFor(1000))
  .register(Presets.Pointer("Pointer"))
  .register(Presets.Gun("Gun"))
  .register(Presets.PinkyPinch("PinkyPinch").asSystemGesture())
  .register(Presets.Fist("Fist").idleFor(1000))
  .register(
    Gesture.create("MiddleFinger")
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
      .where.determineDirectionFrom(Finger.Middle),
  );

engine.bindWebcam({
  videoElement: document.getElementById("webcam") as HTMLVideoElement,
});

engine.onGesture("ThumbsUp", (event: GestureEvent) => {
  console.log("Thumbs up detected", event);
});

engine.onGesture("MiddleFinger", (event) => {
  console.log("Custom gesture detected", event);
});
```

## Constructing the engine

```ts
new GestureEngine<RegisteredGestures extends string, TwoHandGesturesEnabled extends boolean>(
  options?: GestureEngineOptions<TwoHandGesturesEnabled>
)
```

| Option                  | Default | Effect                                                                                                                        |
| ----------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `enableTwoHandGestures` | `false` | Unlocks two-hand coordination (`onGestures`, see below) and requests two simultaneous hands from the underlying hand tracker. |
| `startActive`           | `false` | Whether the engine starts already processing all gestures, or only `.asSystemGesture()` gestures until manually activated.    |

For `onGestures` to actually be usable (rather than typed as `undefined`), annotate the generic explicitly:

```ts
const engine = new GestureEngine<never, true>({ enableTwoHandGestures: true });
```

Passing the option without the explicit type argument still works at runtime, but TypeScript will only infer a widened `boolean`, giving `onGestures` a `Function | undefined` type that forces a null-check before you can call it.

## How gestures are built

Gestures are created with the fluent builder returned by `Gesture.create(name)`. The builder reads like a sentence and keeps the gesture definition close to the hand shape it represents.

### Hand selection

- `.where.anyHand()` allows either hand
- `.where.leftHand()` limits the gesture to the left hand
- `.where.rightHand()` limits the gesture to the right hand

> **Note:** `.where.requireBothHands()` exists on the builder but is currently **non-functional**, a single gesture cannot itself require both hands, since detected hands are always reported individually as `"Left"`/`"Right"`. For genuine two-hand coordination, register two single-hand gestures and combine them with `engine.onGestures(...)` (see "Two-hand gestures" below).

### Finger states

Use `.has(finger).inState(state)` to describe a specific finger:

- `State.Extended`
- `State.Curled`

Examples:

```ts
Gesture.create("ThumbsUp")
  .where.anyHand()
  .has(Finger.Thumb)
  .inState(State.Extended)
  .has(Finger.Index)
  .inState(State.Curled);
```

To describe a full fist or fully open hand, use `.isClosedInto(state)`:

```ts
Gesture.create("Fist").where.anyHand().isClosedInto(State.Curled);
```

### Distance-based poses: pinches, spreads, and tracking

Use `.pinches(fingerA, fingerB, maxDistanceRatio?)` when two fingertips should be close together (default `maxDistanceRatio` is `0.25`, relative to hand size):

```ts
Gesture.create("PinkyPinch")
  .where.anyHand()
  .pinches(Finger.Thumb, Finger.Pinky);
```

Use `.spreads(fingerA, fingerB, minDistanceRatio?)` for the opposite, two fingertips that must be spread far enough apart (default `minDistanceRatio` is `0.5`), useful for poses like a Peace/V sign:

```ts
Gesture.create("Peace")
  .where.anyHand()
  .has(Finger.Index)
  .inState(State.Extended)
  .has(Finger.Middle)
  .inState(State.Extended)
  .spreads(Finger.Index, Finger.Middle, 0.5);
```

Both `.pinches(...)` and `.spreads(...)` **gate** the gesture (it won't match unless the distance condition holds) _and_ automatically record the measured distance ratio on the emitted `GestureEvent.measurements` object, keyed by default as `` `${fingerA}${fingerB}Distance` `` (e.g. `IndexMiddleDistance`), or under a custom key if you pass one as the last argument.

If you want a **continuous** distance value without it affecting whether the gesture matches at all, for example to drive a zoom level, use `.tracks(fingerA, fingerB, key?)`. It never gates, it only measures:

```ts
Gesture.create("PinchZoom")
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

### Direction

Use `.determineDirectionFrom(finger)` to decide which finger's orientation is reported as the gesture's `direction`:

```ts
Gesture.create("Pointer")
  .where.anyHand()
  .has(Finger.Index)
  .inState(State.Extended)
  .where.determineDirectionFrom(Finger.Index);
```

Use `.isPointing(direction)` if the gesture should additionally only match when that direction is a _specific_ value (rather than accepting any direction, which is the default):

```ts
Gesture.create("SwipeUp")
  .where.anyHand()
  .has(Finger.Index)
  .inState(State.Extended)
  .where.determineDirectionFrom(Finger.Index)
  .isPointing(Direction.Up);
```

### Triggered gestures

Some gestures are not just a pose. They start as a base shape and then fire when certain fingers curl.

```ts
Gesture.create("Gun")
  .where.anyHand()
  .has(Finger.Thumb)
  .inState(State.Extended)
  .thenTriggeredBy()
  .curling([Finger.Index])
  .withConfidence(0.75);
```

Use this pattern when you want a gesture to feel like an action, not just a still pose. Triggered gestures are **edge-triggered**: after firing, the trigger fingers must extend again before the gesture can fire a second time.

### Hold duration, cooldowns, and system gestures

- `.holdFor(ms)` requires the base pose to be held stably for a certain duration before it is allowed to fire. For triggered gestures, this applies to the base pose _before_ the trigger fingers curl. Perfect for preventing accidental triggers during transition movements.
- `.idleFor(ms)` serves two closely related purposes: it is the minimum time the engine waits before the _same_ gesture can fire again, and it is also the debounce window used to smooth over brief single-frame tracking noise (a finger momentarily flickering across the curl/extend threshold does not immediately reset hold-duration progress if `idleFor` is set).
- `.asSystemGesture()` marks a gesture as globally available. It will still fire even if the engine has been set to an inactive state.

**Static poses without `.curling(...)` repeat**: once matched and held for `holdFor`, they fire again every `idleFor` milliseconds for as long as the pose continues to be held. If you don't set `idleFor`, it defaults to `0` and the gesture fires on every processed frame - always set an explicit value for anything a user might hold.

**Triggered gestures (with `.curling(...)`) do not repeat** on their own: they fire once per curl cycle and require the trigger fingers to release before firing again.

## Two-hand gestures

Some interactions genuinely need both hands at once, not two independent single-hand gestures, but one combined event. This is handled at the **engine** level via `engine.onGestures(nameA, nameB, callback)`, not on an individual `GestureBuilder`.

### Enabling it

```ts
const engine = new GestureEngine<never, true>({ enableTwoHandGestures: true })
  .register(Presets.ThumbsUp("ThumbsUp"))
  .register(Presets.Fist("Fist"));

engine.onGestures("ThumbsUp", "Fist", (eventA, eventB) => {
  console.log(`${eventA.hand} does ThumbsUp, ${eventB.hand} does Fist`);
});
```

`nameA` and `nameB` can be the same gesture name (e.g. `"ThumbsUp"`, `"ThumbsUp"`) to detect the same pose performed independently on both hands at once.

If `enableTwoHandGestures` is not set (or set without the explicit `<never, true>` generic argument), `onGestures` is typed as `undefined` and calling it fails to compile, it's not merely a silent no-op.

### How it interacts with single-hand gestures

Two-hand combinations are evaluated **before**, and take priority over, single-hand gestures each frame. While a registered combination is actively matched, **both participating hands are withheld from single-hand gesture detection entirely** until the combination is released (i.e. either hand stops matching its half of the combo). Two hands independently performing gestures that don't happen to form a registered combination continue to be detected normally, completely unaffected.

### Hold duration and cooldowns for combinations

Each half of a combination respects its own `.holdFor(...)` (tracked per hand, so the same gesture name held on two different hands is timed independently) and `.idleFor(...)`, the combination's overall cooldown is the larger of the two individual `idleFor` values. Combinations built from static poses fire once when the combination forms and require it to fully disappear before firing again; combinations involving a triggered (`.curling(...)`) gesture follow the same edge-triggered release cycle as their single-hand counterpart.

### Active/inactive state

Two-hand combinations respect the engine's active/inactive state exactly like single-hand gestures: they are skipped while the engine is inactive, unless **both** gestures making up the combination are marked `.asSystemGesture()`.

## Presets

Presets are ready-made gestures that save time for common shapes. None of them set a hold duration or cooldown internally - configure those at registration time as needed.

| Preset                     | What it represents                                       |
| -------------------------- | -------------------------------------------------------- |
| `Presets.ThumbsUp(name)`   | Thumb extended, all other fingers curled                 |
| `Presets.Pointer(name)`    | Index extended, all other fingers curled                 |
| `Presets.Gun(name)`        | Thumb extended, then trigger by curling the index finger |
| `Presets.PinkyPinch(name)` | Thumb and pinky pinch gesture                            |
| `Presets.Fist(name)`       | All fingers curled                                       |
| `Presets.Peace(name)`      | Index and middle extended, all other fingers curled      |

You can use them as-is or keep chaining extra options:

```ts
const pinkyPinch = Presets.PinkyPinch("PinkyPinch").asSystemGesture();
```

## Events

Register a handler with `engine.onGesture(name, callback)`.

The callback receives a `GestureEvent`:

- `name` - The gesture name
- `confidence` - How strongly the gesture matched
- `hand` - `left`, `right`, `both`, or `any`
- `direction` - `Up`, `Down`, `Left`, `Right`, or `Any`
- `timestamp` - When the gesture fired
- `measurements` - Optional record of named finger-distance measurements, present whenever the gesture used `.pinches(...)`, `.spreads(...)`, or `.tracks(...)`

Two-hand combinations registered via `engine.onGestures(nameA, nameB, callback)` receive two such `GestureEvent` objects, one per participating hand/gesture.

You can also listen for active state changes:

```ts
engine.onActiveState((event) => {
  console.log("Engine active:", event.activeState);
});
```

## Runtime behavior

The engine only processes webcam frames after `bindWebcam()` has been called. Gestures marked with `.asSystemGesture()` can still be recognized even when the engine is otherwise inactive - this makes it easy to build interfaces where a single gesture starts or pauses the rest of the interaction model (see `Presets.PinkyPinch` in the quick start above).

When `enableTwoHandGestures` is set, the engine requests two simultaneous hands from the underlying hand tracker instead of one, slightly increasing per-frame processing cost.

## Package exports

The package exposes only the public entry points intended for consumers:

- `gestures` for the main API (`GestureEngine`, `Gesture`, `GestureBuilder`, shared types, and `GestureEngineOptions`)
- `gestures/presets` for the preset collection

This keeps imports clear and lets you choose whether you want the lightweight core API or the convenience presets.
