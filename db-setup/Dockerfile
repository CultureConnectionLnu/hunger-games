FROM --platform=linux/amd64 node@sha256:7e227295e96f5b00aa79555ae166f50610940d888fc2e321cf36304cbd17d7d6 AS deps 
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
RUN yarn global add pnpm@8.14.0

# Install dependencies based on the preferred package manager

COPY app/package.json app/yarn.lock* app/package-lock.json* app/pnpm-lock.yaml\* ./

RUN pnpm install --frozen-lockfile

##### Runner

# node:20-alpine
FROM --platform=linux/amd64 node@sha256:7e227295e96f5b00aa79555ae166f50610940d888fc2e321cf36304cbd17d7d6 AS builder
RUN apk add --no-cache postgresql-client
RUN yarn global add pnpm@8.14.0

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY app .
COPY db-setup .


CMD ./setup.sh