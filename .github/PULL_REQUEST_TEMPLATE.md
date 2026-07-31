## Summary

Describe the problem and the smallest useful change.

## Validation

List the commands and scenarios used to validate the change.

## Authority, safety and compatibility

Describe any impact on permissions, effects, network access, data handling,
schemas, evidence, cleanup or backward compatibility. Write `None` when the
change has no such impact.

## Checklist

- [ ] The change is narrow, reviewable and documented in English where needed.
- [ ] I added positive tests and risk-appropriate negative tests.
- [ ] `npm run lint`, `npm test` and relevant focused tests pass.
- [ ] I did not add credentials, personal data, private prompts, local paths or non-public run artifacts.
- [ ] I preserved fail-closed authority and evidence boundaries, or explained every deliberate change.
- [ ] My commits include a DCO `Signed-off-by` line.
