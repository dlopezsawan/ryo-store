import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Batch 6 — Compliance & equipo.
 *   - finanzas_month_close
 *   - finanzas_user_role
 *   - finanzas_comment
 */
export class Migration20260427230000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "finanzas_month_close" (
        "id" text not null,
        "month" text not null,
        "closed_at" timestamptz not null,
        "closed_by_user_id" text null,
        "closed_by_email" text null,
        "snapshot" jsonb not null,
        "reopened_at" timestamptz null,
        "reopened_by_email" text null,
        "reopen_reason" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "finanzas_month_close_pkey" primary key ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_finanzas_month_close_month" ON "finanzas_month_close" ("month") WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_month_close_deleted_at" ON "finanzas_month_close" ("deleted_at") WHERE deleted_at IS NULL;
    `)

    this.addSql(`
      create table if not exists "finanzas_user_role" (
        "id" text not null,
        "user_id" text not null,
        "user_email" text null,
        "role" text not null,
        "granted_by" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "finanzas_user_role_pkey" primary key ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_finanzas_user_role_user_id" ON "finanzas_user_role" ("user_id") WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_user_role_deleted_at" ON "finanzas_user_role" ("deleted_at") WHERE deleted_at IS NULL;
    `)

    this.addSql(`
      create table if not exists "finanzas_comment" (
        "id" text not null,
        "entity_type" text not null,
        "entity_id" text not null,
        "body" text not null,
        "author_id" text null,
        "author_email" text null,
        "resolved_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "finanzas_comment_pkey" primary key ("id")
      );
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_comment_entity" ON "finanzas_comment" ("entity_type", "entity_id");
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_comment_deleted_at" ON "finanzas_comment" ("deleted_at") WHERE deleted_at IS NULL;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "finanzas_comment" cascade;`)
    this.addSql(`drop table if exists "finanzas_user_role" cascade;`)
    this.addSql(`drop table if exists "finanzas_month_close" cascade;`)
  }
}
