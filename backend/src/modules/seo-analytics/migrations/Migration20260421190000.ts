import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260421190000 extends Migration {
  override async up(): Promise<void> {
    // ── seo_gsc_daily ──────────────────────────────────────────────
    this.addSql(`create table if not exists "seo_gsc_daily" (
      "id" text not null,
      "date" timestamptz not null,
      "query" text not null,
      "page" text not null,
      "country" text not null,
      "device" text not null,
      "impressions" integer not null default 0,
      "clicks" integer not null default 0,
      "ctr" numeric(8,4) not null default 0,
      "position" numeric(8,2) not null default 0,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "seo_gsc_daily_pkey" primary key ("id")
    );`)
    this.addSql(`create index if not exists "IDX_seo_gsc_daily_date" on "seo_gsc_daily" ("date");`)
    this.addSql(`create index if not exists "IDX_seo_gsc_daily_page_date" on "seo_gsc_daily" ("page","date");`)
    this.addSql(`create index if not exists "IDX_seo_gsc_daily_query_date" on "seo_gsc_daily" ("query","date");`)
    this.addSql(`create unique index if not exists "UQ_seo_gsc_daily_row" on "seo_gsc_daily" ("date","query","page","country","device") where "deleted_at" is null;`)

    // ── seo_ga4_daily ──────────────────────────────────────────────
    this.addSql(`create table if not exists "seo_ga4_daily" (
      "id" text not null,
      "date" timestamptz not null,
      "channel" text not null,
      "country" text not null,
      "source" text not null,
      "medium" text not null,
      "sessions" integer not null default 0,
      "engaged_sessions" integer not null default 0,
      "users" integer not null default 0,
      "new_users" integer not null default 0,
      "transactions" integer not null default 0,
      "revenue" numeric(12,2) not null default 0,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "seo_ga4_daily_pkey" primary key ("id")
    );`)
    this.addSql(`create unique index if not exists "UQ_seo_ga4_daily_row" on "seo_ga4_daily" ("date","channel","country","source","medium") where "deleted_at" is null;`)

    // ── seo_ga4_page_daily ─────────────────────────────────────────
    this.addSql(`create table if not exists "seo_ga4_page_daily" (
      "id" text not null,
      "date" timestamptz not null,
      "page" text not null,
      "source" text not null,
      "medium" text not null,
      "sessions" integer not null default 0,
      "conversions" integer not null default 0,
      "revenue" numeric(12,2) not null default 0,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "seo_ga4_page_daily_pkey" primary key ("id")
    );`)
    this.addSql(`create unique index if not exists "UQ_seo_ga4_page_daily_row" on "seo_ga4_page_daily" ("date","page","source","medium") where "deleted_at" is null;`)

    // ── seo_cwv_snapshot ───────────────────────────────────────────
    this.addSql(`create table if not exists "seo_cwv_snapshot" (
      "id" text not null,
      "date" timestamptz not null,
      "url" text not null,
      "device" text not null,
      "lcp_p75" numeric(10,2) null,
      "inp_p75" numeric(10,2) null,
      "cls_p75" numeric(8,4) null,
      "ttfb_p75" numeric(10,2) null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "seo_cwv_snapshot_pkey" primary key ("id")
    );`)
    this.addSql(`create unique index if not exists "UQ_seo_cwv_snapshot_row" on "seo_cwv_snapshot" ("date","url","device") where "deleted_at" is null;`)

    // ── seo_kw_tracked ─────────────────────────────────────────────
    this.addSql(`create table if not exists "seo_kw_tracked" (
      "id" text not null,
      "keyword" text not null,
      "country" text not null default 've',
      "device" text not null default 'mobile',
      "added_by" text null,
      "notes" text null,
      "active" boolean not null default true,
      "source" text not null default 'manual',
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "seo_kw_tracked_pkey" primary key ("id")
    );`)
    this.addSql(`create unique index if not exists "UQ_seo_kw_tracked_row" on "seo_kw_tracked" ("keyword","country","device") where "deleted_at" is null;`)

    // ── seo_kw_position_history ────────────────────────────────────
    this.addSql(`create table if not exists "seo_kw_position_history" (
      "id" text not null,
      "date" timestamptz not null,
      "keyword" text not null,
      "country" text not null,
      "device" text not null,
      "position" numeric(8,2) null,
      "url" text null,
      "impressions" integer not null default 0,
      "clicks" integer not null default 0,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "seo_kw_position_history_pkey" primary key ("id")
    );`)
    this.addSql(`create unique index if not exists "UQ_seo_kw_pos_history_row" on "seo_kw_position_history" ("date","keyword","country","device") where "deleted_at" is null;`)

    // ── seo_kw_research_cache ──────────────────────────────────────
    this.addSql(`create table if not exists "seo_kw_research_cache" (
      "id" text not null,
      "keyword" text not null,
      "country" text not null,
      "trends_score" integer null,
      "trends_90d" jsonb null,
      "related" jsonb null,
      "intent" text null,
      "serp_top10" jsonb null,
      "checked_at" timestamptz not null default now(),
      "ttl_days" integer not null default 30,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "seo_kw_research_cache_pkey" primary key ("id")
    );`)
    this.addSql(`create unique index if not exists "UQ_seo_kw_research_cache_row" on "seo_kw_research_cache" ("keyword","country") where "deleted_at" is null;`)

    // ── seo_competitor ─────────────────────────────────────────────
    this.addSql(`create table if not exists "seo_competitor" (
      "id" text not null,
      "name" text not null,
      "domain" text null,
      "instagram" text null,
      "notes" text null,
      "threat" text not null default 'medium',
      "active" boolean not null default true,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "seo_competitor_pkey" primary key ("id")
    );`)

    // ── seo_competitor_ranking ─────────────────────────────────────
    this.addSql(`create table if not exists "seo_competitor_ranking" (
      "id" text not null,
      "date" timestamptz not null,
      "competitor_id" text not null,
      "keyword" text not null,
      "country" text not null,
      "position" numeric(8,2) null,
      "url" text null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "seo_competitor_ranking_pkey" primary key ("id")
    );`)
    this.addSql(`create unique index if not exists "UQ_seo_competitor_ranking_row" on "seo_competitor_ranking" ("date","competitor_id","keyword","country") where "deleted_at" is null;`)

    // ── seo_crawl_error ────────────────────────────────────────────
    this.addSql(`create table if not exists "seo_crawl_error" (
      "id" text not null,
      "date" timestamptz not null,
      "url" text not null,
      "status" integer not null,
      "user_agent" text not null,
      "hits" integer not null default 1,
      "last_seen" timestamptz not null default now(),
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "seo_crawl_error_pkey" primary key ("id")
    );`)
    this.addSql(`create unique index if not exists "UQ_seo_crawl_error_row" on "seo_crawl_error" ("date","url","status","user_agent") where "deleted_at" is null;`)

    // ── seo_sitemap_snapshot ───────────────────────────────────────
    this.addSql(`create table if not exists "seo_sitemap_snapshot" (
      "id" text not null,
      "date" timestamptz not null,
      "sitemap_url" text not null,
      "urls_total" integer not null default 0,
      "urls_with_lastmod" integer not null default 0,
      "oldest_lastmod" timestamptz null,
      "checksum" text null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "seo_sitemap_snapshot_pkey" primary key ("id")
    );`)
    this.addSql(`create unique index if not exists "UQ_seo_sitemap_snapshot_row" on "seo_sitemap_snapshot" ("date","sitemap_url") where "deleted_at" is null;`)

    // ── seo_alert ──────────────────────────────────────────────────
    this.addSql(`create table if not exists "seo_alert" (
      "id" text not null,
      "type" text not null,
      "severity" text not null,
      "title" text not null,
      "message" text null,
      "meta" jsonb null,
      "acked_at" timestamptz null,
      "acked_by" text null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "seo_alert_pkey" primary key ("id")
    );`)
    this.addSql(`create index if not exists "IDX_seo_alert_unacked" on "seo_alert" ("acked_at") where "acked_at" is null and "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_seo_alert_severity" on "seo_alert" ("severity");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "seo_alert" cascade;`)
    this.addSql(`drop table if exists "seo_sitemap_snapshot" cascade;`)
    this.addSql(`drop table if exists "seo_crawl_error" cascade;`)
    this.addSql(`drop table if exists "seo_competitor_ranking" cascade;`)
    this.addSql(`drop table if exists "seo_competitor" cascade;`)
    this.addSql(`drop table if exists "seo_kw_research_cache" cascade;`)
    this.addSql(`drop table if exists "seo_kw_position_history" cascade;`)
    this.addSql(`drop table if exists "seo_kw_tracked" cascade;`)
    this.addSql(`drop table if exists "seo_cwv_snapshot" cascade;`)
    this.addSql(`drop table if exists "seo_ga4_page_daily" cascade;`)
    this.addSql(`drop table if exists "seo_ga4_daily" cascade;`)
    this.addSql(`drop table if exists "seo_gsc_daily" cascade;`)
  }
}
