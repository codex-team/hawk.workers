FROM node:16.20-slim

WORKDIR /usr/src/app

RUN apt update && apt install git -y

COPY package.json yarn.lock ./

RUN yarn
