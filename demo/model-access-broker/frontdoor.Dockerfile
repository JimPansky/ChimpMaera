FROM node:24.14.1-bookworm-slim@sha256:e484ae3f1e3c378021c967fd42254f343c302a9263e412280eac32bf5bca7008
ARG CM_AAS036_SOURCE_SHA256
LABEL io.chimpmaera.aas036.fixture="model-broker-v1" \
      io.chimpmaera.aas036.role="capability-frontdoor-decision-policy" \
      io.chimpmaera.aas036.source-sha256="${CM_AAS036_SOURCE_SHA256}"
WORKDIR /opt/chimpmaera
COPY demo/model-access-broker/runtime-contract-v1.json ./runtime-contract-v1.json
COPY demo/model-access-broker/frontdoor.mjs ./frontdoor.mjs
COPY demo/model-access-broker/fixture-probe.mjs ./fixture-probe.mjs
USER 10001:10001
EXPOSE 8080
CMD ["node", "frontdoor.mjs"]
