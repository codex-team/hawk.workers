FROM node:14.5-slim

WORKDIR /usr/src/app

RUN apt update && apt install git -y

COPY . .

RUN yarn
