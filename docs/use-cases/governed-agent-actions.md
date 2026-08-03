---
title: Governed AI-agent actions across business systems
description: See how ChimpMaera's local synthetic CRM-to-ERP path separates proposals, authority, approval, effects, readback, and receipts.
---

# Governed AI-agent actions across business systems

An AI Agent can propose a useful business-system change without receiving
ambient authority to perform it. ChimpMaera's released local reference path
demonstrates that separation with fictional CRM and ERP records.

## The bounded path

1. An Owner asks for an outcome and the Agent forms a typed proposal.
2. The Gateway evaluates the declared operation against the current authority
   profile and Policy.
3. An effect that requires consent becomes an Owner-visible approval, bound to
   the exact proposal and authoritative pre-effect snapshot.
4. The Broker executes only the admitted effect.
5. Provider readback and a digest-bound receipt establish the local synthetic
   result. Transport acceptance alone never becomes success.

The [SAFE_GUIDED proof](../SECURE-DEFAULT-PROOF.md) binds these statements to
machine-checked claims and negative probes. The [Architecture](../ARCHITECTURE.md)
describes the local trust boundaries.

## Who this is for

This proof is useful to engineers evaluating patterns for governed Agent
effects, approval integrity, fail-closed execution, and evidence-oriented
business-system integration. Run it when a deterministic local reference is
useful before live-system or tenant work begins.

Use a conventional workflow engine when the work is fully predetermined and
does not need Agent proposals. Use a policy engine when policy evaluation is
the only missing component. Use an Agent framework when experimentation is the
priority and no effect authority is present. ChimpMaera does not claim to
replace those systems or outperform them.

## What this does not prove

The current path is one pinned Linux/Docker fixture using fictional data. It is
not production IAM, a security certification, a live CRM/ERP integration, a
general approval service, or evidence that arbitrary Agent/tool/network paths
are completely mediated. Review the full [known limitations](../KNOWN-LIMITATIONS.md)
before reproducing the example.

## Next action

Inspect the specific [CRM-to-ERP approval and readback path](./crm-erp-approval-readback.md),
use the [Quickstart](../QUICKSTART.md) for the complete local demo, or choose a
smaller deterministic command from the [examples gallery](../examples.md).
