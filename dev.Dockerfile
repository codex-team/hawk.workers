FROM node:14.5-slim

WORKDIR /usr/src/app

RUN apt update
RUN apt install git -y

COPY package.json yarn.lock ./

COPY workers ./

RUN yarn install

COPY . .
