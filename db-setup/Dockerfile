FROM --platform=linux/amd64 node@sha256:7e227295e96f5b00aa79555ae166f50610940d888fc2e321cf36304cbd17d7d6 AS deps 
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install dependencies based on the preferred package manager

COPY app/package.json app/yarn.lock* app/package-lock.json* app/pnpm-lock.yaml\* ./

RUN \
    if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i; \
    else echo "Lockfile not found." && exit 1; \
    fi

##### Runner

# node:20-alpine
FROM --platform=linux/amd64 node@sha256:7e227295e96f5b00aa79555ae166f50610940d888fc2e321cf36304cbd17d7d6 AS builder
RUN apk add --no-cache postgresql-client

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY app .
COPY db-setup .

RUN yarn global add pnpm

CMD ./setup.sh