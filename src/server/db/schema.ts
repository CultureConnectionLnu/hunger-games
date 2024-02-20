import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTableCreator,
  primaryKey,
  serial,
  timestamp,
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

export const posts = createTable(
  "post",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 256 }),
    createdById: varchar("createdById", { length: 255 }).notNull(),
    createdAt: timestamp("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updatedAt"),
  },
  (example) => ({
    createdByIdIdx: index("createdById_idx").on(example.createdById),
    nameIndex: index("name_idx").on(example.name),
  }),
);

export const roleEnum = pgEnum("role_type", ["admin", "moderator", "user"]);
const metadata = {
  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
};

export const users = createTable("user", {
  clerkId: varchar("clerk_id", { length: 255 }),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  role: roleEnum("role").notNull(),
  ...metadata,
});

export const userRelations = relations(users, ({ many }) => ({
  fights: many(usersToFight),
}));

export const fight = createTable("fight", {
  id: uuid("id").primaryKey().defaultRandom(),
  game: varchar("game", { length: 255 }).notNull(),
  winner: integer("winner").references(() => users.clerkId, {
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
