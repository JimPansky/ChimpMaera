FROM apache/superset:5.0.0@sha256:e51bbaf8b72d7c864d6e1e3e439c476db55481d0eb89e04ac411cc1c5344746c
LABEL io.chimpmaera.fixture="bi-superset-m0-v1"

USER root
COPY --chown=superset:superset demo/bi-superset/runtime/ /opt/chimpmaera-bi/
USER superset
