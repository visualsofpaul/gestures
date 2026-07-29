# AI Usage Disclosure

This document discloses the use of AI tools during the development of this project, as required by the module's grading criteria.

## Tools used

- **GitHub Copilot** was used throughout development in an ambient, autocomplete-style capacity (the specific underlying model is not exposed under the student plan).
- **Claude (Anthropic)** was used in a more explicit, conversational capacity for debugging support, design discussion, and drafting documentation.
- **Gemini (Google)** was used in a more explicit, conversational capacity for debugging support, design discussion, and drafting documentation.

## Scope of use

AI assistance, in the forms above, was used for:

- Everyday coding support (completions, boilerplate, small refactors) during regular development
- Debugging and root-causing specific defects in the gesture engine (e.g. the single/two-hand pose isolation issue described in ADR-0011, and the `idleFor`/`holdFor` debounce bypass fixed alongside it)
- Design discussion and implementation support for the two-hand gesture coordinator (`onGestures`) and the generalized finger-distance vocabulary (`.spreads()`/`.tracks()`)
- Drafting and revising documentation

## Verification

All code and all documentation text produced with AI assistance were read, understood, and verified by the author before being committed. Nothing was committed without the author being able to explain what it does and why.

## Note on chat protocols

No dedicated chat transcripts are attached to this repository. Copilot usage in particular was ambient, inline autocomplete assistance rather than discrete, archivable conversations. Claude and Gemini usage was conversational but treated as ordinary working support, comparable to a pairing session or a search engine query, rather than as a separate deliverable in its own right.
