FROM node:lts-alpine as build-stage

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install --prod

COPY . .

ENTRYPOINT ["yarn", "run-email"]
