FROM node:24.14.1-bookworm-slim@sha256:e484ae3f1e3c378021c967fd42254f343c302a9263e412280eac32bf5bca7008
ARG CM_AAS036_SOURCE_SHA256
LABEL io.chimpmaera.aas036.fixture="model-broker-v1" \
      io.chimpmaera.aas036.role="model-access-broker-response-guard" \
      io.chimpmaera.aas036.source-sha256="${CM_AAS036_SOURCE_SHA256}"
WORKDIR /opt/chimpmaera
COPY demo/model-access-broker/runtime-contract-v1.json ./runtime-contract-v1.json
COPY demo/model-access-broker/broker.mjs ./broker.mjs
USER 10002:10002
EXPOSE 8081
CMD ["node", "broker.mjs"]
