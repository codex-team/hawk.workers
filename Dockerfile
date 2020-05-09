FROM node:12.16.3-stretch-slim as build-stage

ARG WORKER_NAME

WORKDIR /app

COPY package.json yarn.lock ./
COPY workers/ ./workers/

RUN yarn install

COPY runner.ts tsconfig.json ./
COPY lib/ ./lib/

RUN yarn tsc

#RUN echo "#!/bin/bash \n node runner.js ${WORKER_NAME}" > ./entrypoint.sh
#RUN chmod +x ./entrypoint.sh
#RUN ls -la
#ENTRYPOINT ["./entrypoint.sh"]
ENTRYPOINT ["node", "runner.js", "hawk-worker-javascript"]
