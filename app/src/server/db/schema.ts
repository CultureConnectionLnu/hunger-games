import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTableCreator,
  primaryKey,
  timestamp,
  unique,
  uuid,
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

export const users = createTable("user", {
  clerkId: varchar("clerk_id", { length: 255 }).primaryKey(),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  ...metadata,
});

export const userRelations = relations(users, ({ many }) => ({
  fights: many(usersToFight),
}));

export const fight = createTable("fight", {
  id: uuid("id").primaryKey().defaultRandom(),
  game: varchar("game", { length: 255 }).notNull(),
  winner: varchar("winner", { length: 255 }).references(() => users.clerkId, {
    onDelete: "cascade",
  }),
  ...metadata,
});

export const fightRelations = relations(fight, ({ many }) => ({
  participants: many(usersToFight),
}));

export const usersToFight = createTable(
  "usersToMatch",
  {
    fightId: uuid("fight_id")
      .references(() => fight.id, { onDelete: "cascade" })
      .notNull(),
    userId: varchar("user_id", { length: 255 })
      .references(() => users.clerkId, { onDelete: "cascade" })
      .notNull(),
    ...metadata,
  },
  (t) => ({
    pk: primaryKey({ columns: [t.fightId, t.userId] }),
  }),
);

export const userToFightRelations = relations(usersToFight, ({ one }) => ({
  fight: one(fight, {
    fields: [usersToFight.fightId],
    references: [fight.id],
  }),
  user: one(users, {
    fields: [usersToFight.userId],
    references: [users.clerkId],
  }),
}));

export const score = createTable(
  "score",
  {
    fightId: uuid("fight_id")
      .references(() => fight.id, { onDelete: "cascade" })
      .notNull(),
    userId: varchar("user_id", { length: 255 })
      .references(() => users.clerkId, { onDelete: "cascade" })
      .notNull(),
    score: integer("score").notNull(),
    ...metadata,
  },
  (t) => ({
    unq: unique().on(t.fightId, t.userId),
  }),
);
