FROM node:latest

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

USER node

CMD [ "node", "monitor.js" ]