CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'BACKLOG' NOT NULL,
	"priority" varchar(10) DEFAULT 'MEDIUM' NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"planned_start_date" date,
	"due_date" date,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tickets_status_check" CHECK ("tickets"."status" IN ('BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE')),
	CONSTRAINT "tickets_priority_check" CHECK ("tickets"."priority" IN ('LOW', 'MEDIUM', 'HIGH'))
);
--> statement-breakpoint
CREATE INDEX "tickets_status_position_idx" ON "tickets" USING btree ("status","position");--> statement-breakpoint
CREATE INDEX "tickets_completed_at_idx" ON "tickets" USING btree ("completed_at");