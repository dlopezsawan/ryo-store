import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Batch 8: monthly snapshot for month-over-month comparison.
 * Also adds a few helpful indexes discovered during profiling.
 */
export class Migration20260422120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "seo_monthly_snapshot" (
      "id" text not null,
      "year" integer not null,
      "month" integer not null,
      "impressions" bigint not null default 0,
      "clicks" bigint not null default 0,
      "ctr" numeric(8,4) not null default 0,
      "avg_position" numeric(8,2) null,
      "sessions_organic" bigint not null default 0,
      "transactions_organic" bigint not null default 0,
      "revenue_organic" numeric(12,2) not null default 0,
      "daily_impressions" jsonb null,
      "daily_clicks" jsonb null,
      "top_queries" jsonb null,
      "top_pages" jsonb null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "seo_monthly_snapshot_pkey" primary key ("id")
    );`)
    this.addSql(`create unique index if not exists "UQ_seo_monthly_row" on "seo_monthly_snapshot" ("year","month") where "deleted_at" is null;`)

    // Helper index for GA4 aggregation by channel × date (overview queries)
    this.addSql(`create index if not exists "IDX_seo_ga4_daily_channel_date" on "seo_ga4_daily" ("channel","date");`)

    // Helper index for GA4 page × source joins
    this.addSql(`create index if not exists "IDX_seo_ga4_page_daily_page" on "seo_ga4_page_daily" ("page");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "seo_monthly_snapshot" cascade;`)
    this.addSql(`drop index if exists "IDX_seo_ga4_daily_channel_date";`)
    this.addSql(`drop index if exists "IDX_seo_ga4_page_daily_page";`)
  }
}
