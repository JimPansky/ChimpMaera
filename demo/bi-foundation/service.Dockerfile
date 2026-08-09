FROM node:24.14.1-bookworm-slim@sha256:e484ae3f1e3c378021c967fd42254f343c302a9263e412280eac32bf5bca7008
ARG CM_BI_SOURCE_SHA256
LABEL io.chimpmaera.fixture="bi001-foundation-v1" \
      io.chimpmaera.fixture.source-sha256="$CM_BI_SOURCE_SHA256"
WORKDIR /opt/chimpmaera
COPY demo/bi-foundation/service.mjs ./service.mjs
USER 10001:10001
ENTRYPOINT ["node", "/opt/chimpmaera/service.mjs"]
