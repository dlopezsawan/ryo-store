import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * social_trend_subscription — per-creator/channel feeds the cron polls
 * directly (RSS / Atom / per-user JSON) instead of generic keyword
 * search. Lets the user track specific competitors and inspirations
 * without burning API quota.
 *
 * Initially used for YouTube channels (kind = "youtube_channel"); same
 * schema fits Reddit users, RSS, etc. when we add them.
 */
export class Migration20260425010000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "social_trend_subscription" (
      "id" text not null,
      "kind" text not null,                                -- youtube_channel | reddit_user | rss | ...
      "source_id" text not null,                           -- e.g. UCxxxxxxxxxxxxxxxxxxxxxx
      "label" text not null,                               -- friendly display name
      "active" boolean not null default true,
      "last_fetched_at" timestamptz null,
      "last_error" text null,
      "fetch_error_count" integer not null default 0,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "social_trend_subscription_pkey" primary key ("id")
    );`)

    this.addSql(`create unique index if not exists
      "UQ_social_trend_subscription_kind_source_id"
      on "social_trend_subscription" ("kind", "source_id")
      where "deleted_at" is null;`)

    this.addSql(`create index if not exists
      "IDX_social_trend_subscription_active"
      on "social_trend_subscription" ("active") where "deleted_at" is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "social_trend_subscription" cascade;`)
  }
}
