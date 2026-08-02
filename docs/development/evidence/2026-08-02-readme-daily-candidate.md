# README and Daily release-identity cleanup — local evidence

Date: 2026-08-02 (Europe/Berlin)

Status: `LOCALLY_VALIDATED / NOT_RELEASED`

Candidate: `v0.2.0-poc.20260802.1`

Publication effects: none

## Read-only starting state

- The worktree started clean on `fix/readme-daily-20260802` at
  `103e9c459633340990d0bfcdfd09255fbc34fe93`.
- GitHub `main` resolved to `bdaa4ccc55aacecdfc1200da3385dfd2b3ee4a8d`.
  The local remote-tracking ref was stale at
  `c0fa407d8224e98bdba9466850b8247f458ce914`; it was deliberately not fetched
  or rewritten during the read-only phase.
- The GitHub API returned exactly one release: published stable release
  `v0.1.0`, whose dereferenced tag is
  `e698946d74342ae10ed25e93d6a45a99647dd2ba`.
- Public `main` contains v0.2 candidate work and explicitly describes it as
  unreleased. Neither `v0.2.0-poc.20260801.1` nor
  `v0.2.0-poc.20260802.1` has a public tag or GitHub release.

## Root cause and correction

The local README still used `# ChimpMaera v0.1` and `ChimpMaera v0.1 is ...`
as the current product identity. Package metadata repeated that versioned
description. The Daily compiler checked SemVer shape, evidence and publication
switches, but it did not bind the frozen README's Current/Today status fields,
did not require a timeless heading and did not reject unmarked foreign release
lines. A future manifest could therefore regenerate internally consistent
bytes while presenting a mixed identity.

Correction:

- use the timeless `# ChimpMaera` heading and product lead;
- label the public release, today's Daily and provenance predecessor in three
  separate README lines;
- keep package version `0.1.0` as metadata for the only published stable line,
  while making its description version-neutral;
- require the Daily status line to contain the exact target and `not
  published`;
- require the predecessor only in the provenance line;
- reject cross-line Daily history, malformed or non-earlier snapshots,
  predecessor identities in Current fields and unmarked foreign versions;
- retain publication denial in the compiler.

## Version semantics

| Identity | Meaning on 2026-08-02 |
|---|---|
| `v0.1.0` | Current published stable release and explicit predecessor line only |
| `v0.2.0-poc.20260801.1` | Previous Daily snapshot; provenance only |
| `v0.2.0-poc.20260802.1` | Today's sole Daily identity; locally validated, not published |
| `package.json` version `0.1.0` | Published package/stable-line metadata; not a claim that the Daily is v0.1 |

## Frozen source and actual Daily delta

The candidate is bound to `c0fa407d8224e98bdba9466850b8247f458ce914`
through `f035ea90c0fb1e77b04bc6aa5ab19a40709d0212`. The two source commits are:

1. `7e9e6c7ee4306e34ee82e40e444170b20c3affbb` — correct the three README video
   destinations and their focused test.
2. `f035ea90c0fb1e77b04bc6aa5ab19a40709d0212` — replace the versioned README
   identity, add the explicit status block and neutralize the package
   description.

The resulting source delta contains only `README.md`, `package.json`,
`tools/video-production-reference/tests/test_cm_video.py` and the corresponding
`SHA256SUMS` refresh. Its source checksum closure passes 101/101.

## Public video proof

All canonical short URLs returned public YouTube oEmbed data on 2026-08-02:

| Position | URL | Observed public title | Response SHA-256 |
|---:|---|---|---|
| 1 | `https://youtu.be/Dq_XLEzh5I8` | Why ChimpMaera? Open Knowledge, Governed AI, Verifiable Outcomes | `6ad67a47d6d2544804a7b99765cb8abc52a5d5a337a7a886c28262c4b9f8fd1a` |
| 2 | `https://youtu.be/w4fWgalD_WQ` | How does ChimpMaera actually work? 🛠️ | `dcc0ff700b62d3fb8219439d95d5c1dd062d604c94830d9e40f3e7a844481f10` |
| 3 | `https://youtu.be/SEPbE-EVoNs` | Security by Default: How ChimpMaera Contains AI Agents | `2929727472cf30a6f75656f94df40a49acde3663eb883597b64b808f18f139c1` |

The GitHub `v0.1.0` release link returned HTTP 200. No candidate release URL is
embedded because no such release exists.

## Candidate hashes

| Artifact | SHA-256 |
|---|---|
| Frozen-source `README.md` | `4507b3ab742a1fd024367f8dac44106425edc1a3d5d0893ef097ae750970f1bf` |
| Frozen-source `package.json` | `5cd7368e792f296da732b53d1f990361c0707ef1ec8df4253cecc002b621efdc` |
| Frozen-source README/video test | `0edbe98673190f01f989d1aba814f82249b3c5408b157de6586d391bd427f236` |
| Frozen-source `SHA256SUMS` | `51827ff502f776225cc7db354dd48a3f3b949a264a28306fcf6117b0d02be424` |
| Candidate manifest | `b6b31b137480c0136a9dd1d0342321c06f3c9b76ebbb14b6accfe0a583c30c81` |
| Candidate artifact manifest | `f53adaaa6cb5eca208a3f983471f3500e75eabc823b8251f7ebc1efec7083e63` |
| Candidate snapshot file | `fc7b81c6c7cd7642f92fe9fc73107ec6b7dcb584747a6d14c6096f7054f0e7b3` |
| Candidate snapshot self-digest | `6dfa4bc089888d114cf14b3213e15735e248b9aa48d8b8df0c343366eb7943f1` |
| Candidate `SHA256SUMS` | `f3f4df3c9c0d664049a7a2dd58568565d078bfc3038f2fd81654c62622448491` |

## Validation

| Gate | Result |
|---|---|
| `npm run daily-poc:test` | PASS, 28/28; includes 20 adversarial cases |
| `npm test` | PASS, 78/78 |
| `npm run lint` | PASS |
| `npm run video:test` | PASS, 15/15 |
| Daily `prepare` | PASS, `READY_CANDIDATE` |
| Daily deterministic `verify` | PASS, byte-identical |
| Candidate checksums | PASS, 16/16 |
| Frozen-source checksums | PASS, 101/101 |
| Repository root checksums | PASS, 150/150 tracked files |
| v0.1 public-staging builder | PASS; candidate/evidence paths absent; archive SHA-256 `9b9982bc46042e57829fd07cdb0aadc7766e4e0766d46c607aac45cafd74d315` |
| `git diff --check` | PASS |

Negative coverage includes the three retired YouTube IDs, a versioned v0.1
README identity, an unmarked v0.1 current-candidate mixture, a 2026-08-01
identity in the Current Daily field and an unpublished Daily described as
released. The only remaining v0.1 references are explicitly labeled public
stable history; the only remaining 2026-08-01 references are explicitly
labeled provenance or negative-probe text.

## External gate

This candidate is **not published**. No push, PR, merge, tag, GitHub release,
upload or deployment occurred. Because public `main` advanced beyond the local
remote-tracking base, the next authorized step is to apply this cleanup to a
fresh branch at public `main` `bdaa4ccc55aacecdfc1200da3385dfd2b3ee4a8d`
and rerun the same gates before opening any PR. Tag/release publication remains
a later, separately authorized action after merge.
