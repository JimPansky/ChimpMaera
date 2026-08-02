FROM ghcr.io/openclaw/openclaw@sha256:6a31d44b2944e7adcd2b582bf6fb463111264ebca97a0201795b799135bd102c
ARG CM_BLD001_SOURCE_SHA256
LABEL io.chimpmaera.fixture="bld001-builder-agent-g6-v1" \
      io.chimpmaera.fixture.role="untrusted-builder-agent" \
      io.chimpmaera.fixture.source-sha256="${CM_BLD001_SOURCE_SHA256}" \
      io.chimpmaera.upstream.index-digest="sha256:6a31d44b2944e7adcd2b582bf6fb463111264ebca97a0201795b799135bd102c" \
      io.chimpmaera.upstream.version="2026.7.1"
USER root
COPY --chown=node:node demo/builder-agent/openclaw.json /opt/chimpmaera/openclaw.json
COPY --chown=node:node demo/builder-agent/fixture-probe.mjs /opt/chimpmaera/fixture-probe.mjs
COPY --chown=node:node demo/builder-agent/workspace /opt/chimpmaera/workspace
COPY --chown=node:node demo/builder-agent/plugin /opt/chimpmaera/plugins/chimpmaera-builder
RUN mkdir -p /var/lib/openclaw && chown node:node /var/lib/openclaw
USER node
