// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgTableCreator,
  serial,
  timestamp,
  integer,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `hunger-games_${name}`);

const metadata = {
  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
};

const clerkId = varchar("clerk_id", { length: 255 });

export const matchReason = pgEnum("match_reason", [
  "ongoing",
  "game-result",
  "never-started",
  "force-stop-game",
  "other-player-disconnected",
]);
export const matchResult = pgEnum("match_result", ["winner", "tie"]);

export const matchGames = pgEnum("match_games", ["rock-paper-scissors"]);

export const match = createTable("match", {
  id: serial("id").primaryKey(),
  game: matchGames("game").notNull(),
  winner: clerkId,
  reason: matchReason("reason").default("ongoing").notNull(),
  result: matchResult("result"),
  ...metadata,
});

export const userToMatch = createTable("user_to_match", {
  clerkId,
  matchId: integer("match_id").references(() => match.id, {
    onDelete: "cascade",
  }),
  ...metadata,
});
