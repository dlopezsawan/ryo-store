import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Add seo_gsc_totals — daily rollup by country+device (no query/page).
 *
 * GSC anonymizes low-volume data when high-cardinality dimensions (query/page)
 * are added. For new/small sites this leaves the dashboard empty even when there
 * IS aggregate traffic. This table captures the unanonymized daily totals so
 * the overview KPIs always reflect real activity.
 */
export class Migration20260421210000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "seo_gsc_totals" (
      "id" text not null,
      "date" timestamptz not null,
      "country" text not null,
      "device" text not null,
      "impressions" integer not null default 0,
      "clicks" integer not null default 0,
      "ctr" numeric(8,4) not null default 0,
      "position" numeric(8,2) not null default 0,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "seo_gsc_totals_pkey" primary key ("id")
    );`)
    this.addSql(`create unique index if not exists "UQ_seo_gsc_totals_row" on "seo_gsc_totals" ("date","country","device") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_seo_gsc_totals_date" on "seo_gsc_totals" ("date");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "seo_gsc_totals" cascade;`)
  }
}
