FROM node:18
WORKDIR /app
COPY package*.json ./
# Install curl for HEALTHCHECK and then install dependencies
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
RUN npm ci --legacy-peer-deps --only=production || npm ci --legacy-peer-deps
COPY . .
EXPOSE 5000
# Healthcheck uses the existing /ready endpoint in the app
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=5 \
    CMD curl -f http://localhost:5000/ready || exit 1
CMD ["npm", "run", "dev"]
