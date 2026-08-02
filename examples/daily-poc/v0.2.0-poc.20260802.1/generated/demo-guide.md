# Daily POC demo guide

Version: `v0.2.0-poc.20260802.1`

## USE-CASE-CURRENT-VIDEO-LINKS — Open the three current ChimpMaera videos from the README

Inputs:

- A local checkout of source commit f035ea90c0fb1e77b04bc6aa5ab19a40709d0212

Steps:

1. Open README.md and locate the Watch ChimpMaera section.
2. Confirm the links appear in the documented overview, implementation and security order.
3. Open the clean URLs https://youtu.be/Dq_XLEzh5I8, https://youtu.be/w4fWgalD_WQ and https://youtu.be/SEPbE-EVoNs.

Expected outcomes:

- The three README labels match the current public YouTube titles as observed on 2026-08-02.
- The three links contain no tracking query parameters.
- The retired IDs are absent from the mutable README.

Demo utility: Provides a precise, low-risk entry point to the current public project videos without changing runtime behavior.

Evidence: EVID-README-LOCAL, EVID-VIDEO-LINK-TEST-LOCAL

## Reproduction

- `git diff --name-status c0fa407d8224e98bdba9466850b8247f458ce914..f035ea90c0fb1e77b04bc6aa5ab19a40709d0212`
- `python3 -m unittest discover -s tools/video-production-reference/tests`
- `sha256sum -c SHA256SUMS`
