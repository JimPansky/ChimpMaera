FROM debian:bookworm-slim@sha256:63a496b5d3b99214b39f5ed70eb71a61e590a77979c79cbee4faf991f8c0783e

LABEL org.opencontainers.image.title="ChimpMaera video production reference"
LABEL org.opencontainers.image.description="CPU-first fail-closed reference renderer and QA contract for CM videos"
LABEL org.opencontainers.image.licenses="Apache-2.0"
LABEL org.opencontainers.image.version="2026.08.02-v2"
LABEL org.opencontainers.image.source="https://github.com/JimPansky/ChimpMaera/tree/main/tools/video-production-reference"
LABEL org.chimpmaera.video.methodology.version="2026.08.02-v2"
LABEL org.chimpmaera.video.methodology.consumed-deltas="/app/methodology/consumed-deltas.json"
LABEL org.chimpmaera.video.audience-copy-gate.version="2026.08.03-v1"

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      ffmpeg \
      python3 \
      python3-yaml \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --uid 65532 --create-home --shell /usr/sbin/nologin cmvideo
WORKDIR /app
COPY bin/ /app/bin/
COPY src/ /app/src/
COPY schemas/ /app/schemas/
COPY policies/ /app/policies/
COPY fixtures/ /app/fixtures/
COPY methodology/ /app/methodology/
COPY qa-gates.yaml /app/qa-gates.yaml
ENV PYTHONPATH=/app/src
USER 65532:65532
ENTRYPOINT ["/app/bin/cm-video"]
CMD ["validate", "--job", "/job/video-job.yaml"]

# Keep commit-only metadata after every stable package and content layer so a
# VCS_REF change cannot invalidate the expensive dependency installation.
ARG VCS_REF=uncommitted
LABEL org.opencontainers.image.revision="$VCS_REF"
