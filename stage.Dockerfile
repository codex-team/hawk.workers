FROM node:24-slim as build-stage

RUN apt update
RUN apt install git -y

WORKDIR /app

COPY package.json yarn.lock ./
COPY workers/ ./workers/

RUN yarn install

COPY . .

RUN yarn tsc
