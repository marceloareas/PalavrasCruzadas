FROM node:22-alpine

WORKDIR /app

# Instala dependencias primeiro (melhor cache).
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copia o restante do codigo.
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
