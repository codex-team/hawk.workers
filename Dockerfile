FROM node:16.2-slim as build-stage

RUN apt update
RUN apt install git -y

WORKDIR /app

COPY package.json yarn.lock ./
COPY workers/ ./workers/

RUN yarn install

COPY runner.ts tsconfig.json ./
COPY lib/ ./lib/

RUN yarn build
