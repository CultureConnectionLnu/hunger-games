import { type ClerkSession, clerkTesting } from "../auth/clerk";

const tokenCache = new Map<
  string,
  {
    session: ClerkSession;
    token: string;
  }
>();

export async function getTestJwt(
  playerName: keyof typeof clerkTesting.testUserMap,
) {
  const cached = tokenCache.get(playerName);
  if (cached !== undefined) {
    if (cached.session.expire_at > Date.now()) {
      return cached.token;
    }
  }

  const { session, token } = await clerkTesting.getToken(
    clerkTesting.testUserMap[playerName],
  );
  tokenCache.set(playerName, {
    session,
    token,
  });
  return token;
}
