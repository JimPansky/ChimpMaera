# Audience discovery and release-specific lock

Version: `cm.audience-discovery-canvas/v1`

Audience fit is evidence work, not a fictional persona exercise. Keep observed facts, sourced facts, hypotheses and editorial decisions separate. Every assumption names evidence, confidence, owner, review date and disconfirming evidence. Never present a persona invented in a workshop as a fact.

## Repeatable workflow

`Intake → evidence collection → segmentation → hypothesis canvas → script/visual implications → low-cost probe → review → revision → release-specific audience lock → post-release learning`

1. Intake: state content/product context and the decision or behavior the media should influence.
2. Evidence: collect the smallest useful set from public issues/comments, documentation searches, support themes, opt-in interviews, prior review rubrics and privacy-safe aggregate signals.
3. Segment: identify primary, secondary and explicitly excluded audiences by job, trigger, knowledge, environment, stakes, objections, desired proof and viewing context—not demographics.
4. Canvas: record current workaround, vocabulary, tools, constraints, accessibility needs, feared failure, CTA and every assumption’s class/confidence/provenance.
5. Implications: select an audience template and derive vocabulary budget, pacing, proof depth, visual grammar and CTA without changing the factual core.
6. Probe: test outline/script/contact sheet before TTS. Ask for central claim, mechanism, boundary and next action; include a counterexample prompt.
7. Review/revise: retain disconfirming evidence and rejection reasons.
8. Lock: digest the exact canvas revision used by the script/storyboard. A changed canvas invalidates the downstream approval.
9. Learn: route only privacy-safe outcomes into governed Learning Records.

Minimum threshold: two independent observed/sourced assumptions for MEDIUM or HIGH confidence. If unavailable, lock a conservative LOW-confidence hypothesis plus a concrete validation probe; do not block and do not pretend certainty.

Research prompts: What decision is the viewer already trying to make? What event triggered it and what do they do today? Which terms/tools need no explanation? What would make them distrust the claim? Which failure do they fear and what proof would change their mind? Where, on what device and with what attention pattern will they watch? What evidence would disconfirm our hypothesis?

Interview prompts: “Show me how you handle this now”; “Where would you stop trusting the process?”; “Which proof would you inspect?”; “Explain the mechanism back in your own words”; “What was unnecessary or missing?” Avoid leading questions and collect only consented, necessary notes.

Issue/comment/review mining: sample by topic and time window; deduplicate repeated participants; distinguish question, confusion, counterexample and feature request; never infer population prevalence from a convenience sample. Record sampling limits. Strip raw identity; prefer aggregate counts or a justified pseudonymous reference whose salt is outside public evidence.

`../templates/audience-templates-v1.json` defines TECHNICAL_EXPERT, TECHNICAL_DECISION_MAKER, OPERATOR, GENERAL_TECH and CONTRIBUTOR. Content and audience templates compose; the claim/evidence registry remains identical.

Current reversible production assumption: primary `TECHNICAL_EXPERT`, secondary `TECHNICAL_DECISION_MAKER`, confidence LOW-to-MEDIUM until the contact-sheet probe. Roll back by relocking the canvas and regenerating scripts/storyboards; no rendered or approved artifact inherits the old lock.
