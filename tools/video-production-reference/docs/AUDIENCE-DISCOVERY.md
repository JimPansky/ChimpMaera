# Audience discovery and governed media learning

Contract versions: `cm.audience-discovery-canvas/v1`, `cm.learning-record/v1`, `cm.media-learning-event/v1`.

Audience fit is evidence work, not a persona generator. Keep `observed`, `sourced`, `hypothesis`, and `editorial-decision` distinct. Every assumption declares provenance/source, confidence, scope, owner, review date, disconfirming evidence, and evidence references where applicable. A workshop impression is not an observation. Missing external data produces only a bounded LOW-confidence hypothesis plus a planned probe—never invented certainty.

## Workflow and release lock

`intake → evidence collection → segmentation → canvas → script/visual implications → low-cost probe → review/revision → immutable release-specific audience lock → post-release learning`

1. Intake states the bounded content context, viewing situation, and decision to influence.
2. Evidence collection uses consented interviews, desk research, documentation, public comment themes, exact-revision review rubrics, or minimized aggregate events. Record the collection window and sampling limit.
3. Segmentation identifies primary, secondary, and excluded audiences by job, trigger, prior knowledge, environment, stakes, objections, feared failure, desired proof, accessibility needs, and viewing context—not demographic stereotypes.
4. The canvas binds each assumption to its epistemic type. The strict schema rejects missing provenance, confidence, scope, or review date.
5. Script and visual implications adapt framing, vocabulary, pacing, proof depth, visual grammar, and CTA while preserving the claim/evidence core digest.
6. Before TTS, probe an outline, script, or contact sheet. Ask the viewer to identify the central claim, mechanism, boundary, next action, and a counterexample.
7. Review retains positive, negative, rejected, and unresolved evidence. Human aesthetic, audience-fit, visual, and editorial decisions are exact-revision-bound.
8. Lock the canonical canvas digest into the script and storyboard. Any assumption, source, or canvas change invalidates downstream approval and requires a new append-only lock.
9. Post-release signals route through minimized events and receipts into governed records. They do not promote themselves.

Interview prompts: “Show me how you handle this now”; “Where would you stop trusting it?”; “Which proof would you inspect?”; “Explain the mechanism back”; “What was missing or unnecessary?” Avoid leading questions and retain only consented, necessary notes.

Desk/comment mining prompts: What decision or failure triggered the question? Which vocabulary is used without prompting? Is this a question, confusion, disagreement, counterexample, or request? What would disconfirm the current assumption? Sample by declared topic and time window, deduplicate repeated participation, document excluded material, and never infer prevalence from a convenience sample.

Minimum evidence: MEDIUM/HIGH confidence requires at least two independently sourced `observed` or `sourced` assumptions. Otherwise use LOW confidence and a dated probe. One weak observation cannot promote a template. Raw identity, private messages, raw comments, IP addresses, or unnecessary personal data are forbidden by default; prefer aggregate counts. A justified pseudonymous reference must keep its salt outside public artifacts.

## Governed Learning Record and ladder

Each immutable record traces `source → observation → normalization → decision → output/revision → test/review evidence → outcome`. It includes source digests; audience, content-family, and applicability scope; confidence; dependencies; tool/template versions; review/expiry; supersession; rollback; and a canonical record digest linked to prior history. Evidence items retain their own IDs and `POSITIVE`, `NEGATIVE`, `REJECTED`, or `UNRESOLVED` polarity so all remain independently queryable. Correction appends a superseding/downgrade record; it never edits history.

- L0 `RAW_OBSERVATION`: source digest, minimized observation, scope, epistemic type.
- L1 `NORMALIZED_FINDING`: reproducible normalization; no causal or general outcome claim.
- L2 `VALIDATED_PATTERN`: positive plus negative/rejected/unresolved evidence and repeatable test.
- L3 `TEMPLATE_CANDIDATE`: two independent derivations or documented strong justification, objective promotion gate, rollback.
- L4 `GOVERNED_TEMPLATE`: exact schema/tool versions, human review, negative probes, applicability boundary.
- L5 `CROSS_CONTEXT_REUSED`: declared adaptations and independent success in each bounded context; this media slice does not claim it.
- L6 `OUTCOME_VALIDATED`: outcome measure, baseline, review, and independent evidence; unavailable external outcomes block only L6.

A changed/missing source digest, stale audience assumption, dependency change, contradictory evidence, or changed outcome fails closed to `DOWNGRADE_OR_INVALIDATE`; re-promotion must satisfy the gates again. The three canvas families—authority, verification, and public-truth—are reuse inside this bounded media workflow, not cross-domain maturity.

## Feedback routing

Privacy-safe events record only event type, time, exact artifact revision, source class, bounded scope, aggregate/minimized outcome, and residual uncertainty. Routes cover repeated confusion → script/docs, reproducible counterexample → negative fixture/test/claim review, vocabulary mismatch → audience template, and visual comprehension failure → visual grammar/validator. Every route emits a receipt stating what changed, what did not, why, evidence references, owner, and review date. Engagement is a signal, not proof of comprehension.

The preserved rejected 2026-08-03 modules `.1`–`.6` are six append-only `REJECTED` evidence items in `../fixtures/video-governance-learning-records.json`. They concretely drive progressive-state, composition-diversity, and claim-to-visual-evidence gates plus their negative tests. They are not production outcomes or positive templates.

## Assumptions, non-claims, and rollback

Current examples are synthetic/public-safe and default-off. They assume only that the three named technical-media families can share a canvas format. No automated audience certainty, engagement-as-comprehension, raw identity storage by default, universal persona generator, automatic promotion from one success, cross-domain maturity, or removal of human editorial/visual judgment is claimed. Nothing here grants publication, provider, credential, deployment, or production authority.

Rollback is local and append-only: forbid the affected template, restore the prior exact contract/template version, append a downgrade/supersession receipt referencing both record digests, regenerate script/storyboard under a new audience lock, and repeat exact-revision human review. Source observations and rejected evidence remain intact.
