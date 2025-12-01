# orchestrator-api/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
# Use npm install to avoid package-lock sync issues during rapid dev
RUN npm install --production

COPY src/ ./src/

EXPOSE 3000

CMD ["node", "src/index.js"]