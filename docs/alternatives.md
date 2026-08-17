---
title: When PANSPHAIRA is not the right tool
description: Choose among workflow, policy, agent, sandbox, and observability approaches without unsupported product-comparison claims.
---

# When PANSPHAIRA is not the right tool

PANSPHAIRA is a local proof of concept for a specific problem: an Agent
proposes a business-system effect, trusted components govern the authority,
and authoritative readback plus a receipt verifies the result. It is not a
general replacement for every automation or Agent component.

## Choose the narrower tool when it solves the whole problem

| Problem | Better fit | Why |
| --- | --- | --- |
| Every step and branch is known in advance | A workflow engine | Deterministic orchestration, retries, schedules, and operator controls may be all that is needed. |
| You only need allow/deny decisions over structured input | A policy engine | It specializes in policy evaluation without introducing an Agent or an effect broker. |
| You are prototyping prompts, tools, or multi-Agent coordination with no external effect authority | An Agent framework | It optimizes experimentation; keep tools read-only or separately governed. |
| You need a hardened process or workload boundary | A sandbox or workload-isolation platform | PANSPHAIRA's Docker fixture is not a hostile-host security boundary. |
| Existing applications already execute correctly and you only need traces, metrics, or logs | An observability platform | Observation alone does not need PANSPHAIRA's proposal, approval, lease, or broker path. |
| A conventional API service can validate and execute the request deterministically | A normal application service | An Agent adds no value when the input, decision, and action are already fully specified. |

These categories can be combined. For example, an Agent framework can form a
proposal, a policy engine can help evaluate it, a workflow engine can
coordinate deterministic steps, and an isolation platform can constrain the
runtime. PANSPHAIRA's reference architecture explores the authority and
verification contracts between those responsibilities.

## Use this proof when the boundary is the question

The local proof is useful when you need to inspect all of the following
together:

- an untrusted Agent proposal rather than ambient execution authority;
- an Owner-visible approval bound to exact pre-effect context;
- brokered execution with fail-closed rejection, expiry, drift, and replay;
- authoritative provider readback rather than transport acceptance; and
- a receipt bound to the decision, effect, and observed result.

Start with the [CRM-to-ERP walkthrough](./use-cases/crm-erp-approval-readback.md)
and verify its [capability evidence](./capabilities.md). PANSPHAIRA makes no
measured speed, adoption, security, or superiority comparison with other
projects. Its current evidence is local and synthetic; the complete non-claims
are in [Known Limitations](./KNOWN-LIMITATIONS.md).
