import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const readerProfiles = sqliteTable(
  "reader_profiles",
  {
    id: text("id").primaryKey(),
    friendCode: text("friend_code").notNull(),
    secretHash: text("secret_hash").notNull(),
    nickname: text("nickname").notNull(),
    completedCount: integer("completed_count").notNull().default(0),
    startedCount: integer("started_count").notNull().default(0),
    totalProgress: integer("total_progress").notNull().default(0),
    progressJson: text("progress_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("reader_profiles_friend_code_idx").on(table.friendCode)],
);

export const readerFriendships = sqliteTable(
  "reader_friendships",
  {
    ownerId: text("owner_id").notNull().references(() => readerProfiles.id, { onDelete: "cascade" }),
    friendId: text("friend_id").notNull().references(() => readerProfiles.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.friendId] }),
    index("reader_friendships_owner_idx").on(table.ownerId, table.createdAt),
  ],
);
