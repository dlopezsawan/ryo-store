import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Adds publishing-pipeline columns to social_post and social_story:
 *
 *   - scheduled_at:   when the Python worker should pick this up.
 *                     On a post, mirrors the flow stories already had.
 *   - failure_reason: last error message from instagrapi, so the UI can
 *                     show it + the user can retry.
 *   - error_count:    incremented on each failed attempt; helps back off
 *                     and avoids hammering IG for doomed items.
 *
 * Plus an index on (status, scheduled_at) that matches the worker's
 * polling query (status = 'scheduled' AND scheduled_at <= now()).
 */
export class Migration20260424020000 extends Migration {
  override async up(): Promise<void> {
    // social_post — add all three
    this.addSql(`alter table "social_post" add column if not exists "scheduled_at" timestamptz null;`)
    this.addSql(`alter table "social_post" add column if not exists "failure_reason" text null;`)
    this.addSql(`alter table "social_post" add column if not exists "error_count" integer not null default 0;`)
    this.addSql(`create index if not exists "IDX_social_post_publish_queue" on "social_post" ("status", "scheduled_at");`)

    // social_story — already has scheduled_at; just add the diagnostics
    this.addSql(`alter table "social_story" add column if not exists "failure_reason" text null;`)
    this.addSql(`alter table "social_story" add column if not exists "error_count" integer not null default 0;`)
    this.addSql(`create index if not exists "IDX_social_story_publish_queue" on "social_story" ("status", "scheduled_at");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_social_post_publish_queue";`)
    this.addSql(`drop index if exists "IDX_social_story_publish_queue";`)
    this.addSql(`alter table "social_post" drop column if exists "scheduled_at";`)
    this.addSql(`alter table "social_post" drop column if exists "failure_reason";`)
    this.addSql(`alter table "social_post" drop column if exists "error_count";`)
    this.addSql(`alter table "social_story" drop column if exists "failure_reason";`)
    this.addSql(`alter table "social_story" drop column if exists "error_count";`)
  }
}
