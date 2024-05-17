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
  quests: many(quest),
}));

export const roles = createTable("role", {
  userId: varchar("user_id", { length: 255 })
    .references(() => users.clerkId, { onDelete: "cascade" })
    .notNull(),
  isPlayer: boolean("is_player").default(false).notNull(),
  isMedic: boolean("is_medic").default(false).notNull(),
  ...metadata,
});

export const fightOutcome = pgEnum("fight_outcome", ["completed", "aborted"]);

export const fight = createTable("fight", {
  id: uuid("id").primaryKey().defaultRandom(),
  game: varchar("game", { length: 255 }).notNull(),
  winner: varchar("winner", { length: 255 }).references(() => users.clerkId, {
    onDelete: "cascade",
  }),
  outcome: fightOutcome("outcome"),
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
    fightId: uuid("fight_id").references(() => fight.id, {
      onDelete: "cascade",
    }),
    questId: uuid("quest_id").references(() => quest.id, {
      onDelete: "cascade",
    }),
    userId: varchar("user_id", { length: 255 })
      .references(() => users.clerkId, { onDelete: "cascade" })
      .notNull(),
    score: integer("score").notNull(),
    ...metadata,
  },
  (t) => ({
    unq: unique().on(t.fightId, t.userId, t.questId),
  }),
);
export const scoreRelation = relations(score, ({ one }) => ({
  fight: one(fight, {
    fields: [score.fightId],
    references: [fight.id],
  }),
  quest: one(quest, {
    fields: [score.questId],
    references: [quest.id],
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

export const questKind = pgEnum("quest_kind", ["walk-1", "walk-2", "walk-3", "assign"]);
export const questOutcome = pgEnum("quest_outcome", [
  "completed",
  "lost-in-battle",
]);

export const quest = createTable("quest", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: questKind("kind").notNull(),
  userId: varchar("user_id", { length: 255 })
    .references(() => users.clerkId, { onDelete: "cascade" })
    .notNull(),
  outcome: questOutcome("outcome"),
  /**
   * walkQuests: which places need to be visited and what the progress is
   */
  additionalInformation: json("additional_information").notNull(),
  ...metadata,
});
export const questRelations = relations(quest, ({ one }) => ({
  user: one(users, {
    fields: [quest.userId],
    references: [users.clerkId],
  }),
  score: one(score, {
    fields: [quest.id],
    references: [score.questId],
  }),
}));

export const gamePlayerState = createTable("game_player_state", {
  userId: varchar("user_id", { length: 255 })
    .primaryKey()
    .references(() => users.clerkId, { onDelete: "cascade" })
    .notNull(),
  isWounded: boolean("is_wounded").default(false).notNull(),
  reviveCoolDownEnd: timestamp("revive_cool_down_end"),
});
export const questPlayerStateRelations = relations(
  gamePlayerState,
  ({ one }) => ({
    user: one(users, {
      fields: [gamePlayerState.userId],
      references: [users.clerkId],
    }),
  }),
);
