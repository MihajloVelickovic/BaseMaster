FROM node:23.4.0-alpine3.20

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 18683
CMD ["npm", "run", "dev"]