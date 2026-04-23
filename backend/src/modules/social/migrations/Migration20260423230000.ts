import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260423230000 extends Migration {
  override async up(): Promise<void> {
    // ── social_post ────────────────────────────────────────────────
    this.addSql(`create table if not exists "social_post" (
      "id" text not null,
      "external_id" text not null,
      "number" text not null,
      "title" text not null,
      "pillar" text null,
      "format" text not null,
      "date_label" text null,
      "date_planned" timestamptz null,
      "caption" text null,
      "cover_url" text null,
      "media_urls" jsonb null,
      "status" text not null default 'draft',
      "ig_post_id" text null,
      "published_at" timestamptz null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "social_post_pkey" primary key ("id")
    );`)
    this.addSql(`create unique index if not exists "UQ_social_post_external_id" on "social_post" ("external_id") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_social_post_status" on "social_post" ("status");`)
    this.addSql(`create index if not exists "IDX_social_post_date_planned" on "social_post" ("date_planned");`)

    // ── social_story ───────────────────────────────────────────────
    this.addSql(`create table if not exists "social_story" (
      "id" text not null,
      "external_id" text not null,
      "date" text not null,
      "slot" integer not null,
      "type" text not null,
      "media_url" text null,
      "link_url" text null,
      "link_x" numeric(6,4) null,
      "link_y" numeric(6,4) null,
      "link_width" numeric(6,4) null,
      "link_height" numeric(6,4) null,
      "link_rotation" numeric(8,2) null,
      "status" text not null default 'draft',
      "scheduled_at" timestamptz null,
      "ig_story_id" text null,
      "published_at" timestamptz null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "social_story_pkey" primary key ("id")
    );`)
    this.addSql(`create unique index if not exists "UQ_social_story_external_id" on "social_story" ("external_id") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_social_story_date_slot" on "social_story" ("date","slot");`)
    this.addSql(`create index if not exists "IDX_social_story_status" on "social_story" ("status");`)

    // ── social_feedback ────────────────────────────────────────────
    this.addSql(`create table if not exists "social_feedback" (
      "id" text not null,
      "entity_type" text not null,
      "entity_id" text not null,
      "author_id" text null,
      "author_name" text null,
      "author_email" text null,
      "text" text not null,
      "parent_id" text null,
      "timestamp_ms" integer null,
      "resolved" boolean not null default false,
      "resolved_at" timestamptz null,
      "resolved_by" text null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "social_feedback_pkey" primary key ("id")
    );`)
    this.addSql(`create index if not exists "IDX_social_feedback_target" on "social_feedback" ("entity_type","entity_id");`)
    this.addSql(`create index if not exists "IDX_social_feedback_parent" on "social_feedback" ("parent_id");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "social_feedback" cascade;`)
    this.addSql(`drop table if exists "social_story" cascade;`)
    this.addSql(`drop table if exists "social_post" cascade;`)
  }
}
