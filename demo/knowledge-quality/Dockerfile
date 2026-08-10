FROM node:24.14.1-bookworm-slim@sha256:e484ae3f1e3c378021c967fd42254f343c302a9263e412280eac32bf5bca7008
WORKDIR /opt/chimpmaera
COPY demo/knowledge-quality/api.mjs demo/knowledge-quality/api.mjs
COPY tests/fixtures/knowledge-quality/purchasing-v1.json tests/fixtures/knowledge-quality/purchasing-v1.json
USER 10001:10001
EXPOSE 8080
CMD ["node", "demo/knowledge-quality/api.mjs"]
