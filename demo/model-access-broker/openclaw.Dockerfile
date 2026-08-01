FROM ghcr.io/openclaw/openclaw@sha256:6a31d44b2944e7adcd2b582bf6fb463111264ebca97a0201795b799135bd102c
ARG CM_AAS036_SOURCE_SHA256
LABEL io.chimpmaera.aas036.fixture="model-broker-v1" \
      io.chimpmaera.aas036.role="untrusted-openclaw-agent" \
      io.chimpmaera.aas036.source-sha256="${CM_AAS036_SOURCE_SHA256}" \
      io.chimpmaera.upstream.index-digest="sha256:6a31d44b2944e7adcd2b582bf6fb463111264ebca97a0201795b799135bd102c" \
      io.chimpmaera.upstream.version="2026.7.1"
USER root
COPY --chown=node:node demo/openclaw-agent/openclaw.json /opt/chimpmaera/openclaw.json
COPY --chown=node:node demo/openclaw-agent/workspace /opt/chimpmaera/workspace
COPY --chown=node:node demo/openclaw-agent/plugin /opt/chimpmaera/plugins/chimpmaera-capability
RUN mkdir -p /var/lib/openclaw && chown node:node /var/lib/openclaw
USER node
