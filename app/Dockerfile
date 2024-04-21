##### DEPENDENCIES

# node:20-alpine
FROM --platform=linux/amd64 node@sha256:7e227295e96f5b00aa79555ae166f50610940d888fc2e321cf36304cbd17d7d6 AS deps 
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
RUN yarn global add pnpm@8.14.0

# Install dependencies based on the preferred package manager

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml\* ./

RUN pnpm install --frozen-lockfile

##### BUILDER

# node:20-alpine
FROM --platform=linux/amd64 node@sha256:7e227295e96f5b00aa79555ae166f50610940d888fc2e321cf36304cbd17d7d6 AS builder
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_NODE_ENV
ARG NEXT_PUBLIC_WS_LOCATION
ARG NEXT_PUBLIC_FEATURE_MANUAL_JOIN
RUN npm install --global pnpm@8.14.0

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN SKIP_ENV_VALIDATION=1 pnpm run build

##### RUNNER

# node:20-alpine
FROM --platform=linux/amd64 node@sha256:7e227295e96f5b00aa79555ae166f50610940d888fc2e321cf36304cbd17d7d6 AS runner
# FROM --platform=linux/amd64 gcr.io/distroless/nodejs20-debian12 AS runner
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED 1
ENV SKIP_ENV_VALIDATION 1

COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# todo: introduce compilation
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./
COPY --from=deps /app/node_modules ./node_modules

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
EXPOSE 3001

CMD ["npm", "run", "start:docker"]