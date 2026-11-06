FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash python3 git \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /workspace \
  && chown node:node /workspace

ENV HOME=/home/node
WORKDIR /workspace
USER 1000:1000
