FROM ghcr.io/openclaw/openclaw@sha256:6a31d44b2944e7adcd2b582bf6fb463111264ebca97a0201795b799135bd102c
ARG CM_AAS035_SOURCE_SHA256
LABEL io.chimpmaera.fixture="aas035-openclaw-agent-v1" \
      io.chimpmaera.fixture.role="untrusted-openclaw-agent" \
      io.chimpmaera.fixture.source-sha256="${CM_AAS035_SOURCE_SHA256}" \
      io.chimpmaera.upstream.index-digest="sha256:6a31d44b2944e7adcd2b582bf6fb463111264ebca97a0201795b799135bd102c" \
      io.chimpmaera.upstream.version="2026.7.1"
USER root
COPY --chown=node:node demo/openclaw-agent/openclaw.json /opt/chimpmaera/openclaw.json
COPY --chown=node:node demo/openclaw-agent/fixture-probe.mjs /opt/chimpmaera/fixture-probe.mjs
COPY --chown=node:node demo/openclaw-agent/workspace /opt/chimpmaera/workspace
COPY --chown=node:node demo/openclaw-agent/plugin /opt/chimpmaera/plugins/chimpmaera-capability
RUN mkdir -p /var/lib/openclaw && chown node:node /var/lib/openclaw
USER node
