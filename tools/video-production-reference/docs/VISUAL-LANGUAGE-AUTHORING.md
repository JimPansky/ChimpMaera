# Governed visual storytelling

Version: `cm.visual-language-contract/2026-08-03-v1`

This guide prevents a technically valid render from masquerading as an effective video. A narrated slide deck can decode, pass OCR and contain accurate words while still failing to explain. The canonical sequence is:

`outline → audience lock → script package → storyboard → contact sheet → human visual + editorial approval → TTS/animation → automated final QA → human final approval → send`

No fixed Daily target or maximum duration exists. `CONTENT_DRIVEN` means retaining every essential claim and boundary while removing repetition, ornamental detail, truncation-to-fit and padding-to-fit.

## Narrative architecture

Lock one spine before scenes: audience → intended decision/behavior → central tension/question → transformation/insight → proof → implication/CTA. Release increments are evidence under that spine, not six interchangeable cards. Every scene declares one job: hook, context, problem, mechanism, proof, consequence, transition or close.

Use the professional script package in `../templates/script-package-v1.json`. It records prior knowledge, need, objection, premise, question, promise, proof boundary, beat sheet, multi-track narration/visual/copy/evidence/audio/transition/accessibility fields, critical terms, claim/non-claim registry, hook/ending variants and the exact approval revision.

## Visual-language contract

Each scene must:

- perform one semantic visual action;
- change state progressively or develop evidence visibly;
- make narration and on-screen labels complementary rather than duplicative;
- use short labels/callouts, not paragraphs;
- match claim to visual type: flow, transition, comparison, dependency DAG, UI/terminal/contract excerpt or measured evidence;
- show meaningful change during narration and close without a static or silent padded tail;
- keep the frame legible in safe area, at mobile size, in dark/light rendering and without color as the only differentiator;
- use motion only to explain feedback, continuity, state change, causality or hierarchy;
- keep branding as a quiet frame rather than the content.

Why: viewers have limited visual/verbal processing capacity. Repeating spoken paragraphs on screen competes with the explanation; irrelevant motion attracts attention without adding a mental model. Short labels paired with a causal visual let narration explain why while the frame shows what changed.

## Concrete grammar families

- Authority flow — `Proposal → Policy/Approval → Broker → Readback → Receipt`. Good: a denial visibly stops before the broker. Bad: five labels fade in while narration reads them.
- Verification DAG — `changed node → invalidated dependents → selected checks → authoritative comparator`. Good: the changed edge explains check selection. Bad: a generic network pulses.
- Contribution preflight — `prepare → validate → evidence bundle → stop before submit`. Good: the bundle reaches a closed external-effect boundary. Bad: local validation animates into a merged contribution.
- Scope normalization — `5 reads → 1 scope → 0 writes`. Good: read routes converge while write routes terminate outside the boundary. Bad: the formula appears as a text card.
- Public truth/discoverability — show before/after navigation and the actual user path. Good: an ambiguous four-branch path becomes one task route with the product boundary still visible. Bad: a card says users find answers faster.

Machine-readable definitions live in `../templates/visual-grammar-families-v1.json`.

## Pre-render gate

The immutable storyboard must bind scene objective, narrative job, claim/evidence, visual grammar/type, before/after state, narration purpose, labels, source, non-claim boundary, keyframe state digests, visual delta, transition purpose and accessibility note. A rendered contact sheet must cover representative moments.

Automated preflight rejects excessive text, narration duplication, negligible visual delta, static-slide behavior, repeated composition, missing semantic binding, padded tails and missing/wrong critical terms. `PASS_AUTOMATED` means only that automation passed. It never means publication-ready.

`HUMAN_VISUAL_REVIEW` and `HUMAN_EDITORIAL_REVIEW` are exact-revision gates. Either `PENDING` or `REJECTED` forbids TTS/full render. Any byte-changing revision invalidates approvals. Final send additionally requires exact-revision automated final QA, `HUMAN_FINAL_REVIEW=APPROVED`, `readyForAssembly=true`, `publicationPermission=PERMITTED` and L5 maturity.

## Design review checklist

For every representative frame, answer yes with evidence or reject:

- Is there one unmistakable focal point and a clear hierarchy?
- Do alignment, grid, margins, optical balance and safe area prevent edge collisions?
- Are type size, weight and line length readable on a phone, with no subtitle collision?
- Do foreground/background contrast and dark/light variants remain legible?
- Are state differences visible without relying on hue alone?
- Are icons, stroke weights, corner radii and shadows internally consistent?
- Does each movement have continuity, easing, entry/exit logic and a causal purpose?
- Is camera movement necessary and comprehensible rather than decorative?
- Do density and empty space support the current narrative job?
- Do screenshots/diagrams remain legible, correctly cropped and correctly positioned?
- Does the visual explain causality instead of decorate narration?
- Does the tail finish the narrative rather than wait out a target duration?

## Maturity model

- L0 `TECHNICAL_VALID`: media/claims may be technically valid; no storytelling claim.
- L1 `SCRIPT_COMPLETE`: audience lock, factual core, claim registry and multi-track script validate.
- L2 `STORYBOARD_VALIDATED`: automated storyboard/contact-sheet gates pass.
- L3 `VISUAL_DESIGN_APPROVED`: exact-revision human visual review approves the contact sheet.
- L4 `ROUGH_CUT_APPROVED`: TTS/animation, final automated QA and the exact-revision human final/rough-cut review pass.
- L5 `PUBLICATION_READY`: the approved rough cut receives explicit assembly/send permission for that immutable revision.
- L6 `PUBLISHED_AND_READBACK_VERIFIED`: intended artifact was sent/published and byte/target readback succeeds.

Aggregate green tests never promote an individual module.

## Research basis

Accessed 2026-08-03:

- W3C WCAG 2.2, captions: <https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html>. Transfer: synchronized captions are required for prerecorded spoken content.
- W3C WCAG 2.2, contrast minimum: <https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html>. Transfer: normal text targets at least 4.5:1; large text at least 3:1.
- W3C WCAG 2.2, use of color: <https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html>. Transfer: color cannot be the only carrier of state or meaning.
- W3C WCAG 2.2, animation from interactions: <https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html>. Transfer: non-essential motion needs restraint and an accommodation path; our baseline forbids non-explanatory motion.
- Cambridge Handbook of Multimedia Learning, “Principles for Reducing Extraneous Processing…”: <https://www.cambridge.org/core/books/cambridge-handbook-of-multimedia-learning/principles-for-reducing-extraneous-processing-in-multimedia-learning-coherence-signaling-redundancy-spatial-contiguity-and-temporal-contiguity-principles/CD5B7AE1279A9AB81F8EEBB53DBEC86E>. Transfer: coherence, signaling, redundancy and contiguity justify removing decorative content and avoiding spoken/on-screen duplication.
- Nielsen Norman Group, “The Role of Animation and Motion in UX”: <https://www.nngroup.com/articles/animation-purpose-ux/>. Transfer: use subtle motion for feedback, state change, navigation and mental models; motion attracts attention and can degrade comprehension when irrelevant.
- Microsoft Writing Style Guide, “Scannable content”: <https://learn.microsoft.com/en-us/style-guide/scannable-content/> (page date 2023-06-20; observed update metadata 2026-07-06). Transfer: put the important point first and prefer brief, clear, discrete components over dense text.
- BBC Editorial Guidelines, “Accuracy”: <https://www.bbc.com/editorialguidelines/guidelines/accuracy/>. Transfer: factual output must be appropriately sourced, corroborated where possible, explicit about unknowns and never materially misleading; speed is subordinate to due accuracy.
- Apple Human Interface Guidelines, “Motion”: <https://developer.apple.com/design/human-interface-guidelines/motion>. Transfer used conservatively: motion remains subordinate to comprehension and accessibility; no Apple-specific timing formula is adopted.
- Material Design 3, “Motion”: <https://m3.material.io/styles/motion/overview>. Transfer used conservatively: continuity and purposeful transitions inform review; no brand-specific easing token is canonical here.

Rejected as low-evidence or non-transferable: universal “three-second hook” rules, AIDA as a mandatory story structure, arbitrary 60/90-second targets, fixed words-per-minute as a quality gate, motion added for “delight”, and advice that reports engagement without comprehension or factual-stability evidence.
