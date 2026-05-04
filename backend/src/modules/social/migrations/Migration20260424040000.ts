import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Batch 5 — Trends Monitor storage.
 *
 * Two tables:
 *   social_trend_source  — one row per scraped trending item (atomic)
 *   social_trend_brief   — one row per ISO week (AI-generated summary)
 */
export class Migration20260424040000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "social_trend_source" (
      "id" text not null,
      "kind" text not null,
      "source_id" text not null,
      "source_url" text null,
      "title" text not null,
      "author" text null,
      "summary" text null,
      "media_url" text null,
      "permalink" text null,
      "score" integer not null default 0,
      "comments" integer not null default 0,
      "engagement_delta" integer null,
      "keywords" jsonb null,
      "region" text null,
      "posted_at" timestamptz null,
      "fetched_at" timestamptz not null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "social_trend_source_pkey" primary key ("id")
    );`)

    // Upsert key: (kind, source_id) — prevents duplicates across fetches
    this.addSql(`create unique index if not exists "UQ_social_trend_source_kind_source_id" on "social_trend_source" ("kind", "source_id") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_social_trend_source_kind" on "social_trend_source" ("kind");`)
    this.addSql(`create index if not exists "IDX_social_trend_source_posted_at" on "social_trend_source" ("posted_at");`)
    this.addSql(`create index if not exists "IDX_social_trend_source_fetched_at" on "social_trend_source" ("fetched_at");`)

    // ── Brief ──────────────────────────────────────────────────────
    this.addSql(`create table if not exists "social_trend_brief" (
      "id" text not null,
      "week_start" text not null,
      "generated_at" timestamptz not null,
      "content" jsonb not null,
      "model_name" text null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "social_trend_brief_pkey" primary key ("id")
    );`)
    this.addSql(`create unique index if not exists "UQ_social_trend_brief_week" on "social_trend_brief" ("week_start") where "deleted_at" is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "social_trend_source" cascade;`)
    this.addSql(`drop table if exists "social_trend_brief" cascade;`)
  }
}
