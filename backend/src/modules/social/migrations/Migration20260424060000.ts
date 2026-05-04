import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Buffer API call log — every outgoing call to api.buffer.com gets a row so
 * we can count usage against Buffer's 24h per-token quota (~400 calls on
 * Free) and refuse to make more requests before we trip the limit.
 *
 * Survives process restarts, which the in-memory counter can't do. The cron
 * + manual endpoint both consult this table via `countCallsInLast24h()`.
 *
 * We also record 429 events specifically so we know when to stop calling
 * until the window resets.
 */
export class Migration20260424060000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "social_buffer_call" (
      "id" text not null,
      "called_at" timestamptz not null default now(),
      "endpoint" text not null,           -- createPost | deletePost | getPost | dailyPostingLimits | other
      "http_status" integer null,         -- actual HTTP code (typically 200 or 429)
      "ok" boolean not null default true, -- false for anything we want to count as "failed" (rate-limited counts OK)
      "rate_limited_retry_after_s" integer null,
      "caller" text null,                 -- cron | manual | api-route (freeform)
      "note" text null,                   -- short context
      constraint "social_buffer_call_pkey" primary key ("id")
    );`)

    this.addSql(`create index if not exists "IDX_social_buffer_call_called_at" on "social_buffer_call" ("called_at");`)
    this.addSql(`create index if not exists "IDX_social_buffer_call_endpoint" on "social_buffer_call" ("endpoint");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "social_buffer_call" cascade;`)
  }
}
