# Release withdrawal and quarantine

If exact released bytes are found to have a source-binding, digest,
rights/license, critical security, claim-boundary or cleanup defect:

1. identify the affected version and archive digest;
2. stop redistribution of those exact bytes;
3. publish a concise non-sensitive withdrawal notice through the same release
   channel;
4. preserve the minimum information needed to reproduce the defect;
5. fix on a new revision and rerun the release gates;
6. issue replacement bytes only under a new digest.

Security details and personal data must follow the private reporting process
in [SECURITY.md](SECURITY.md), not the public withdrawal notice.
