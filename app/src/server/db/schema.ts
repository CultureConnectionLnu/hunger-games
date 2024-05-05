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
  pgEnum,
  json,
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
export const userRelations = relations(users, ({ many, one }) => ({
  fights: many(usersToFight),
  roles: one(roles, {
    fields: [users.clerkId],
    references: [roles.userId],
  }),
  questsToUsers: many(questToUser),
}));

export const roles = createTable("role", {
  userId: varchar("user_id", { length: 255 })
    .references(() => users.clerkId, { onDelete: "cascade" })
    .notNull(),
  isPlayer: boolean("is_player").default(false).notNull(),
  ...metadata,
});

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
export const scoreFightRelation = relations(score, ({ one }) => ({
  fight: one(fight, {
    fields: [score.fightId],
    references: [fight.id],
  }),
}));

export const hub = createTable("hub", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 1023 }),
  assignedModeratorId: varchar("assigned_moderator_id", {
    length: 255,
  }).references(() => users.clerkId, {
    onDelete: "cascade",
  }),
  ...metadata,
});
export const hubUserRelation = relations(hub, ({ one }) => ({
  assignedModerator: one(users, {
    fields: [hub.assignedModeratorId],
    references: [users.clerkId],
  }),
}));

export const questKind = pgEnum("quest_kind", ["walk-1", "walk-2", "walk-3"]);

export const quest = createTable("quest", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: questKind("kind").notNull(),
  scoreForCompletion: integer("score_for_completion").notNull(),
  ...metadata,
});
export const questRelations = relations(quest, ({ many }) => ({
  questsToUsers: many(questToUser),
}));

export const questOutcome = pgEnum("quest_outcome", [
  "completed",
  "lost-in-battle",
]);

export const questToUser = createTable("quest_to_user", {
  questId: uuid("quest_id")
    .references(() => quest.id, { onDelete: "cascade" })
    .notNull(),
  userId: varchar("user_id", { length: 255 })
    .references(() => users.clerkId, { onDelete: "cascade" })
    .notNull(),
  outcome: questOutcome("outcome"),
  /**
   * depending on the kind of quest the progress is interpreted differently
   */
  progress: integer("progress").notNull().default(0),
  /**
   * in case of walk quest, contains which hubs need to be visited as json
   */
  additionalInformation: json("additional_information"),
  ...metadata,
});
export const questToUserRelations = relations(questToUser, ({ one }) => ({
  quest: one(quest, {
    fields: [questToUser.questId],
    references: [quest.id],
  }),
  user: one(users, {
    fields: [questToUser.userId],
    references: [users.clerkId],
  }),
}));
