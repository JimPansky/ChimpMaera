FROM node:24.14.1-bookworm-slim@sha256:e484ae3f1e3c378021c967fd42254f343c302a9263e412280eac32bf5bca7008
ARG CM_AAS035_SOURCE_SHA256
LABEL io.chimpmaera.fixture="aas035-openclaw-agent-v1" \
      io.chimpmaera.fixture.role="capability-gateway-broker-provider-mind-fixture" \
      io.chimpmaera.fixture.source-sha256="${CM_AAS035_SOURCE_SHA256}"
WORKDIR /opt/chimpmaera
COPY demo/openclaw-agent/runtime-contract-v1.json ./runtime-contract-v1.json
COPY demo/openclaw-agent/gateway-workload-contract-v2.json ./gateway-workload-contract-v2.json
COPY demo/openclaw-agent/plugin/identity-v2.mjs ./plugin/identity-v2.mjs
COPY demo/openclaw-agent/mind-store.mjs ./mind-store.mjs
COPY demo/openclaw-agent/gateway.mjs ./gateway.mjs
RUN mkdir -p /var/lib/chimpmaera && chown 10001:10001 /var/lib/chimpmaera
USER 10001:10001
EXPOSE 8080
CMD ["node", "gateway.mjs"]
