FROM node:24.14.1-bookworm-slim@sha256:e484ae3f1e3c378021c967fd42254f343c302a9263e412280eac32bf5bca7008
ARG CM_BLD001_SOURCE_SHA256
LABEL io.chimpmaera.fixture="bld001-builder-agent-g6-v1" \
      io.chimpmaera.fixture.role="builder-gateway-broker-synthetic-target" \
      io.chimpmaera.fixture.source-sha256="${CM_BLD001_SOURCE_SHA256}"
WORKDIR /opt/chimpmaera
COPY demo/builder-agent/runtime-contract-v1.json ./runtime-contract-v1.json
COPY demo/builder-agent/gateway.mjs ./gateway.mjs
RUN mkdir -p /var/lib/chimpmaera && chown 10001:10001 /var/lib/chimpmaera
USER 10001:10001
EXPOSE 8080
CMD ["node", "gateway.mjs"]
