FROM node:24.14.1-bookworm-slim@sha256:e484ae3f1e3c378021c967fd42254f343c302a9263e412280eac32bf5bca7008
ARG CM_AAS037_SOURCE_SHA256
LABEL io.chimpmaera.fixture="aas037-managed-skill-v1" \
      io.chimpmaera.fixture.role="managed-skill-broker" \
      io.chimpmaera.fixture.source-sha256="${CM_AAS037_SOURCE_SHA256}"
WORKDIR /opt/chimpmaera
COPY --chown=10001:10001 demo/managed-skill-lifecycle/manager.mjs ./manager.mjs
COPY --chown=10001:10001 demo/managed-skill-lifecycle/runtime-contract-v1.json ./runtime-contract-v1.json
COPY --chown=10001:10001 demo/managed-skill-lifecycle/fixtures/zoo-greeter/SKILL.md ./fixture/SKILL.md
RUN mkdir -p /var/lib/chimpmaera/state /var/lib/chimpmaera/skills \
    && touch /var/lib/chimpmaera/state/.volume-owner /var/lib/chimpmaera/skills/.volume-owner \
    && chown -R 10001:10001 /var/lib/chimpmaera
USER 10001:10001
CMD ["node", "manager.mjs"]
