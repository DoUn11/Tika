import { sql } from 'drizzle-orm';
import { check, date, index, integer, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

/**
 * tickets — 할 일 하나를 나타내는 티켓 (DATA_MODEL.md 2장).
 *
 * status·priority는 Postgres ENUM 대신 VARCHAR + CHECK로 정의한다.
 * 값 추가 시 마이그레이션 부담이 적고, CLAUDE.md의 "enum 대신 const 객체" 원칙과도 맞는다.
 */
export const tickets = pgTable(
  'tickets',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 20 }).notNull().default('BACKLOG'),
    priority: varchar('priority', { length: 10 }).notNull().default('MEDIUM'),
    position: integer('position').notNull().default(1),
    plannedStartDate: date('planned_start_date'),
    dueDate: date('due_date'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('tickets_status_position_idx').on(table.status, table.position),
    index('tickets_completed_at_idx').on(table.completedAt),
    check(
      'tickets_status_check',
      sql`${table.status} IN ('BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE')`,
    ),
    check('tickets_priority_check', sql`${table.priority} IN ('LOW', 'MEDIUM', 'HIGH')`),
  ],
);

export type TicketRow = typeof tickets.$inferSelect;
export type NewTicketRow = typeof tickets.$inferInsert;
