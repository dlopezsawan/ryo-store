import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Batch 8 — Suggestions.
 * Users (or cron from trend brief) stash content ideas here before they
 * become committed posts/stories.
 */
export class Migration20260424050000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "social_suggestion" (
      "id" text not null,
      "kind" text not null,
      "title" text not null,
      "body" text null,
      "pillar" text null,
      "format" text null,
      "suggested_date" timestamptz null,
      "source" text not null default 'manual',
      "source_ref" text null,
      "status" text not null default 'idea',
      "promoted_to" text null,
      "created_by" text null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "social_suggestion_pkey" primary key ("id")
    );`)

    this.addSql(`create index if not exists "IDX_social_suggestion_status" on "social_suggestion" ("status");`)
    this.addSql(`create index if not exists "IDX_social_suggestion_kind" on "social_suggestion" ("kind");`)
    this.addSql(`create index if not exists "IDX_social_suggestion_suggested_date" on "social_suggestion" ("suggested_date");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "social_suggestion" cascade;`)
  }
}
