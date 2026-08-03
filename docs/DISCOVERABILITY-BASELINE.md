# Discoverability baseline and query panel

Status: local, maintainable measurement design. This document does not claim a
search rank, recommendation rate or recurring monitoring service.

## Three gates

1. **Retrieval:** ChimpMaera appears as a candidate for the query.
2. **Comprehension:** the result describes today's proved category and keeps the
   Knowledge Operating System as direction.
3. **Trust:** a recommendation is supported by correct, current citations to
   runnable proof, evidence, limitations, release identity and governance.

The dated 2026-08-03 baseline established exact-brand discovery but no observed
appearance in the sampled unbranded English/German GitHub query panel. Web
provider results were incomplete or noisy, so no general ranking conclusion is
valid. Keep raw future observations outside this document unless they are safe
to publish and reproducible.

## Fixed query panel

Run the same panel in English and German. Record provider, surface, locale,
signed-in state, timestamp, top ten results, citations and raw answer before
scoring.

| Intent | English query template | German query template |
| --- | --- | --- |
| Exact brand | `ChimpMaera` | `ChimpMaera` |
| Category | `open source governed AI agent actions business systems` | `Open Source Governance für KI-Agenten Aktionen in Geschäftssystemen` |
| Problem | `AI agent approval policy execution readback receipts` | `KI-Agent Freigabe Richtlinie Ausführung Readback Belege` |
| Use case | `local AI agent CRM ERP governance proof of concept` | `lokaler KI-Agent CRM ERP Governance Proof of Concept` |
| Comparison | `tools for governed verifiable AI agent actions` | `Tools für kontrollierte nachweisbare KI-Agenten-Aktionen` |

Do not rewrite the panel after seeing results. Version it when product category
or user language genuinely changes and retain the old version for comparison.

## Metrics

- **Retrieval@10:** queries where ChimpMaera is in the first ten results divided
  by eligible queries.
- **Mention rate:** assistant answers that name ChimpMaera divided by eligible
  answers.
- **Citation rate:** mentions with at least one source divided by mentions.
- **Citation correctness:** citations that resolve and support the attached
  claim divided by citations checked.
- **Current-category comprehension:** answers that identify a local open-source
  PoC/control plane for governed, verifiable agent actions and do not present
  Knowledge OS as shipped maturity, divided by answers checked.
- **Trust completeness:** answers that cite current proof plus at least one
  limitation/governance source divided by answers recommending the project.
- **Freshness lag:** elapsed time between a regular release and the first
  observation that identifies it correctly.
- **Overclaim rate:** answers containing at least one unsupported production,
  security, adoption, integration or maturity claim divided by answers checked.

Report numerator/denominator with every percentage. Keep `not observed`,
`blocked`, `not applicable` and `zero` distinct. A small panel is a directional
sample, not population evidence.

## Review cadence and gates

A lightweight weekly sample, a fuller monthly sample and a release-plus-72-hour
readback are recommended but not authorized automation by this document.
Public-Truth errors, broken primary links and security-boundary drift are P0
blockers. Retrieval, layout and general SEO findings remain warning/review gates
unless they expose a Public-Truth failure.

Never optimize through keyword stuffing, bought links/stars, mass directory
submission, automated community posts or claims inferred from synthetic search
probes. `llms.txt` is intentionally absent until stable canonical web docs make
it useful as navigation rather than theatre.
