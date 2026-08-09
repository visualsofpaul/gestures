# Gestures

A small, webcam-based hand gesture recognition library for TypeScript, built as part of a university module. `gestures` lets you describe hand shapes and finger movements in plain, fluent TypeScript and receive them as simple events in your application.

This repository is a monorepo containing the library itself, its presets, and four applications built in the process of developing and testing the library.

## Academic context

- **Program:** `Media Informatics (Master of Science)`
- **Module:** `Web Technologies (Master of Science)`
- **Semester:** `2`
- **Supervision:** `Prof. Christian Noss`
- **Type of work:** `Project work`
- **Author:** `Paul Strebinger`

## What this project does

The `gestures` package turns webcam hand tracking (via MediaPipe) into named, typed gesture events: static poses (thumbs up, fist, pointing), triggered poses (a "click" formed by curling specific fingers), distance-based poses (pinches and spreads, e.g. a Peace sign), and coordinated two-hand gestures. It deliberately does not hardcode what a gesture _means_ for an application (e.g. "next slide") - it only recognizes hand shapes and exposes them as events, leaving interaction design entirely to the consuming application.

For the reasoning behind this design and the vocabulary of built-in shapes, see [`VOCABULARY.md`](./VOCABULARY.md). For the full API reference, see [`DOCUMENTATION.md`](./DOCUMENTATION.md).

## Repository structure

This is a [Turborepo](https://turborepo.com/) monorepo managed with [Bun](https://bun.sh).

```
.
├── apps/
│   ├── 01-poc-jitter/                      # Testing Mediapipe jitter and smoothing
│   ├── 02-gesture-detection/               # First class based engine prototype
│   ├── 03-demo/                            # Low-level test playground, continuously
│   └── 04-rl-test/                         # A Reveal.js presentation controlled by gestures
├── packages/
│   └── gestures/                           # The library itself
│       ├── src/core/                       # Core engine, builder, rules, types (main entry point)
│       └── src/presets/                    # Ready-made gesture presets ("gestures/presets")
├── docs/
│   ├── README.md                           # Overview of all Architecture Decision Records
│   └── .                                   # Individual ADRs
├── VOCABULARY.md                           # Project philosophy and gesture vocabulary
├── DOCUMENTATION.md                        # Full API reference
└── AI.md                                   # Disclosure of AI tool usage during development
```

Only the fourth app (the Reveal.js presentation) is the actual showcase application referenced in the project's acceptance criteria; the first three are development/exploration artifacts kept in the repository for transparency and traceability, not as separate deliverables.

## Prerequisites

- [Bun](https://bun.sh)
- A modern Chromium-based browser with webcam access (required by the underlying MediaPipe hand tracker)
- A webcam
- Camera access requires either `localhost` or HTTPS - both are satisfied automatically by the local dev servers below

No separate Node.js installation is required; Bun provides its own runtime.

## Getting started

Install all dependencies once from the repository root:

```bash
bun i
```

### Running the showcase application

The fastest way to see the project working end-to-end:

```bash
bun demo
```

This starts the fourth app (the gesture-controlled Reveal.js presentation) directly. Open the printed local URL in your browser and allow camera access when prompted.

### Running any individual app

Every app supports the standard dev script:

```bash
cd apps/[app-name]
bun dev
```

or, from the repository root, via Turborepo's filter flag:

```bash
bun run dev --filter=[app-name]
```

## Documentation map

| Document                                 | Purpose                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| [`VOCABULARY.md`](./VOCABULARY.md)       | Project philosophy, gesture vocabulary, and why the API is shaped the way it is |
| [`DOCUMENTATION.md`](./DOCUMENTATION.md) | Full API reference for the engine and builder                                   |
| [`docs/README.md`](./docs/README.md)     | Index of all Architecture Decision Records                                      |
| [`AI.md`](./AI.md)                       | Disclosure of AI tool usage during development                                  |

## Known limitations

The following items were deliberately left out of scope, with reasoning documented in the [ADRs](./docs/README.md):

- Single-hand static poses (e.g. thumbs up, fist) repeat while held rather than firing once per hold session, unlike triggered and two-hand gestures.
- `GestureBuilder.requireBothHands()` exists but is non-functional; use `engine.onGestures(...)` for genuine two-hand coordination instead.
- Two-hand gesture consumption is scoped to a whole hand side, not to the specific gesture pair involved.
- Two-hand combination cooldowns are derived from both halves' individual settings rather than being independently configurable.
- Continuous finger-distance tracking (`.tracks(...)`) only updates when its host gesture fires, not on every frame independent of any gesture state.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Contributing

This repository is not yet publicly maintained beyond the scope of this course submission; a `CONTRIBUTING.md` will be added upon public release.
