FROM node:16-stretch

RUN apt-get update && apt-get install -y udev

COPY package.json yarn.lock ./
RUN yarn install
COPY src ./src

CMD yarn start
