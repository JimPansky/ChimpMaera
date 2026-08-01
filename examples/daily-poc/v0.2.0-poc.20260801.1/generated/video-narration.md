# Video narration

Title: ChimpMaera Daily POC — Gateway-Mediated OpenClaw

Candidate: `v0.2.0-poc.20260801.1`

## 1. Snapshot status

This is ChimpMaera Daily POC candidate v0.2.0-poc.20260801.1. It combines the completed local product and security slices through AAS-023 into one reviewable snapshot. The evidence is bound to this local candidate; public delivery is a separate gate.

Claim CM-CLAIM-DAILY-CANDIDATE-PIPELINE [LOCALLY_VALIDATED]: The Daily POC compiler produces deterministic evidence-bound candidate artifacts from one manifest and a clean frozen source while keeping public effects disabled.

## 2. OpenClaw without ambient authority

A real OpenClaw agent fixture runs as untrusted workload code. It receives no ambient provider, host, or tenant credential. The declared application path goes through the ChimpMaera Gateway, while direct provider, peer, socket, host, and unmanaged effect paths remain denied in the tested fixture.

Claim CM-CLAIM-GATEWAY-MEDIATED-OPENCLAW [LOCALLY_VALIDATED]: The isolated OpenClaw fixture has no ambient provider, host, or tenant credential and reaches the declared application path only through the ChimpMaera Gateway boundary.

## 3. Capability is not authority

A capability is only something the system could do. Runtime authority stays inactive until scope, policy generation, exact plan, human-readable diff, and approval all bind to the same action. Trusted code rechecks those facts at use time, outside the agent, and ambiguity fails closed.

Claim CM-CLAIM-EFFECT-READBACK-RECEIPT [LOCALLY_VALIDATED]: In the synthetic governed path, transport acceptance is not success; authoritative readback and a bound receipt are required after effect-boundary enforcement.

## 4. Bidirectional model broker

Model access is bidirectional and mediated. Requests are guarded before provider access; opaque credentials resolve only inside the broker. Responses and streams are guarded again before they return to the agent or a tool path. Model output remains untrusted data, never effect authority.

Claim CM-CLAIM-BIDIRECTIONAL-MODEL-BROKER [LOCALLY_VALIDATED]: The local model broker guards requests before provider access and guards responses before agent or tool use while credentials remain opaque to the agent.

## 5. Effect, readback, and receipt

The bounded effect gate executes the exact approved action. A successful transport response is not enough. ChimpMaera queries the authoritative provider state, compares the material result, and only then binds the decision, effect, readback digest, and outcome into a receipt. Drift, replay, rejection, or ambiguity cannot become success.

Claim CM-CLAIM-EFFECT-READBACK-RECEIPT [LOCALLY_VALIDATED]: In the synthetic governed path, transport acceptance is not success; authoritative readback and a bound receipt are required after effect-boundary enforcement.

## 6. Audit timeline and honest boundaries

The protected audit timeline explains outcomes only from signed, ordered, digest-linked facts and the exact checkpoint. Missing, reordered, forked, or tampered facts do not render verified success. In this snapshot, the local contracts and tests are proven here, the isolated runtime evidence remains local, Builder Agent and broader integrations remain planned, and production or hostile-host claims remain external gates.

Claim CM-CLAIM-PROTECTED-AUDIT-TIMELINE [LOCALLY_VALIDATED]: Verified audit explanations require signed ordered digest-linked facts plus the exact head and count checkpoint; tampered, missing, reordered, or forked facts do not render verified success.
Claim CM-CLAIM-CANON-RUNTIME-CONTRACT [DESIGNED]: The local Canon revision defines a mechanism-independent untrusted runtime contract and separates it from the Docker reference adapter.
Claim CM-CLAIM-CONTRIBUTION-EVIDENCE-LIFECYCLE [DESIGNED]: The contribution guide distinguishes planning, readiness, implementation, local validation, merge, and public-delivery states and treats issues as roadmap rather than evidence.

Final disclosure: this video package is prepared locally. Publication remains separately Owner-gated.
