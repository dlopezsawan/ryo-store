import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * DEV tab: job_run history table.
 *
 * Captures every execution of every cron/scheduled job for observability.
 * One row per run, with status, duration, error message.
 */
export class Migration20260422190000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "job_run" (
      "id" text not null,
      "job_name" text not null,
      "started_at" timestamptz not null default now(),
      "finished_at" timestamptz null,
      "status" text not null default 'running',
      "duration_ms" integer null,
      "error_message" text null,
      "meta" jsonb null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "job_run_pkey" primary key ("id")
    );`)
    this.addSql(`create index if not exists "IDX_job_run_job_name_started" on "job_run" ("job_name", "started_at" desc);`)
    this.addSql(`create index if not exists "IDX_job_run_status" on "job_run" ("status");`)
    this.addSql(`create index if not exists "IDX_job_run_started_at" on "job_run" ("started_at" desc);`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "job_run" cascade;`)
  }
}
