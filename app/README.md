# Hunger games

## Auth

use clerk to manage auth.
used this code base to get it working: https://github.com/growupanand/ConvoForm/blob/da36a5a91eb1033f71b2a8e98ea90213c66bcde2/packages/api/src/trpc.ts#L25

## Websockets

https://github.com/vercel/next.js/discussions/58698#discussioncomment-7655962
to validate user in the websocket request:
https://clerk.com/docs/backend-requests/handling/manual-jwt

## feature ideas:

- find stale fights in admin panel, like older than 10 minutes
- a player has a max disconnect time and this is counted down further every time he disconnects, instead of giving full time with each disconnect
