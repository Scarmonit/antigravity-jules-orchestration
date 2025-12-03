# syntax=docker/dockerfile:1

ARG NODE_VERSION=20

###############################
# Stage 1: Build dependencies #
###############################
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /usr/src/app

# Copy only package management files first to optimize cache
COPY package*.json ./

# Install only production dependencies; use cache mount for npm cache
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# Copy the rest of the app source
COPY src ./src

###############################
# Stage 2: Minimal runtime    #
###############################
FROM node:${NODE_VERSION}-alpine AS runtime

WORKDIR /usr/src/app

# Run as non-root for better security
USER node

# Copy app from builder, owned by non-root user
COPY --from=builder --chown=node:node /usr/src/app /usr/src/app

EXPOSE 3000
CMD ["node", "src/index.js"]
