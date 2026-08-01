FROM ghcr.io/openclaw/openclaw@sha256:6a31d44b2944e7adcd2b582bf6fb463111264ebca97a0201795b799135bd102c
ARG CM_AAS037_SOURCE_SHA256
LABEL io.chimpmaera.fixture="aas037-managed-skill-v1" \
      io.chimpmaera.fixture.role="untrusted-openclaw-skill-requester" \
      io.chimpmaera.fixture.source-sha256="${CM_AAS037_SOURCE_SHA256}" \
      io.chimpmaera.upstream.index-digest="sha256:6a31d44b2944e7adcd2b582bf6fb463111264ebca97a0201795b799135bd102c" \
      io.chimpmaera.upstream.version="2026.7.1"
USER root
COPY --chown=node:node demo/managed-skill-lifecycle/openclaw.json /opt/chimpmaera/openclaw.json
COPY --chown=node:node demo/managed-skill-lifecycle/fixture-probe.mjs /opt/chimpmaera/fixture-probe.mjs
COPY --chown=node:node demo/managed-skill-lifecycle/workspace /opt/chimpmaera/workspace
COPY --chown=node:node demo/managed-skill-lifecycle/plugin /opt/chimpmaera/plugins/chimpmaera-skill-lifecycle
RUN mkdir -p /var/lib/openclaw /opt/chimpmaera/workspace/skills && chown -R node:node /var/lib/openclaw /opt/chimpmaera/workspace
USER node
