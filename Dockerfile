# Use an official Node.js runtime as base image
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files and install deps (and Prisma schema for postinstall)
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Copy the rest of the app
COPY . .

# Build the Next.js app
RUN npm run build

# ---- Production Image ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy only the necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.* ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src

# Expose port
EXPOSE 3000

# Start the Next.js app
CMD ["npm", "start"]
