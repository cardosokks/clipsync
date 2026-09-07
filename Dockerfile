# Stage 1: Build the frontend and backend
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
# Note: server.ts is compiled using esbuild via the build script in package.json
RUN npm run build

# Stage 2: Production environment
FROM node:20-slim

WORKDIR /app

# Copy package files for production
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy build artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
