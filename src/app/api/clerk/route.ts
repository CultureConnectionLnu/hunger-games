import { type WebhookEvent } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { Webhook } from "svix";
import { env } from "~/env";
import { db } from "~/server/db";
import { posts, userRoles } from "~/server/db/schema";

async function handleEvent(event: WebhookEvent) {
  switch (event.type) {
    case "user.created":
      return await db.insert(userRoles).values({
        userId: event.data.id,
        role: "user",
      });

    case "user.deleted":
      const userId = event.data.id;
      if (!userId) {
        throw new Error(`user.deleted webhook event missing user id`, {
            cause: event
        });
      }
      await db.delete(userRoles).where(eq(userRoles.userId, userId));
      await db.delete(posts).where(eq(posts.createdById, userId));
      break;
  }
}

async function validateRequest(request: Request) {
  const payloadString = await request.text();
  const headerPayload = headers();

  const svixHeaders = {
    "svix-id": headerPayload.get("svix-id")!,
    "svix-timestamp": headerPayload.get("svix-timestamp")!,
    "svix-signature": headerPayload.get("svix-signature")!,
  };
  const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);
  return wh.verify(payloadString, svixHeaders) as WebhookEvent;
}

export async function POST(request: Request) {
  try {
    const payload = await validateRequest(request);
    await handleEvent(payload);
    return Response.json({ message: "Received" });
  } catch (error) {
    console.error(error);
    return Response.error();
  }
}

export async function GET() {
  return Response.json({ message: "Endpoint available" });
}

