##### BASE

# node:22.13.1-alpine3.21
FROM --platform=linux/amd64 node@sha256:e2b39f7b64281324929257d0f8004fb6cb4bf0fdfb9aa8cedb235a766aec31da AS base 
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
RUN npm install --global pnpm@8.14.0

##### PRODUCTION DEPENDENCIES

FROM base AS proddeps 
COPY package.json pnpm-lock.yaml\* ./
RUN pnpm install --frozen-lockfile --production

##### DEPENDENCIES

FROM proddeps AS deps 
RUN pnpm install --frozen-lockfile

##### BUILDER

FROM base AS builder
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_NODE_ENV

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1
RUN SKIP_ENV_VALIDATION=1 pnpm run build

##### RUNNER

# node:22.13.1-alpine3.21
FROM --platform=linux/amd64 node@sha256:e2b39f7b64281324929257d0f8004fb6cb4bf0fdfb9aa8cedb235a766aec31da AS runner
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED 1
ENV SKIP_ENV_VALIDATION 1

COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./

COPY --from=builder /app/.next/ ./.next
COPY --from=proddeps /app/package.json ./package.json
COPY --from=proddeps /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "run", "run:server"]