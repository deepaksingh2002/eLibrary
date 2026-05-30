FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production || npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
