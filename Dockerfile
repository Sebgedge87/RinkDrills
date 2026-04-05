FROM node:20-alpine

WORKDIR /app

# Build deps needed for better-sqlite3 native addon
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --production

COPY . .

RUN mkdir -p /data

EXPOSE 3000

CMD ["node", "server.js"]
