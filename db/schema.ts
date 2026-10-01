import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
// Exactly one private pair. Only conditional writes to row 1 are exposed by the API.
export const pair = sqliteTable('pair', {
  id: integer('id').primaryKey(),
  owner: text('owner').notNull(), guest: text('guest'),
  codeHash: text('code_hash'), expires: integer('expires').notNull().default(0),
  ownerSubscription: text('owner_subscription'), guestSubscription: text('guest_subscription'),
  ownerSent: integer('owner_sent').notNull().default(0), guestSent: integer('guest_sent').notNull().default(0),
});
export const limits = sqliteTable('limits', {id:text('id').primaryKey(),at:integer('at').notNull()});
