FROM node:22-alpine

WORKDIR /app

# Instala dependencias primeiro (melhor cache).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts

EXPOSE 3000
CMD ["npm", "start"]
