import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Adds social_activity table — audit trail for posts and stories.
 * Rows are written by route handlers on every status change, feedback
 * creation/deletion, and @mention.
 */
export class Migration20260424010000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "social_activity" (
      "id" text not null,
      "entity_type" text not null,
      "entity_id" text not null,
      "actor_id" text null,
      "actor_name" text null,
      "action" text not null,
      "payload" jsonb null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "social_activity_pkey" primary key ("id")
    );`)

    this.addSql(`create index if not exists "IDX_social_activity_entity" on "social_activity" ("entity_type", "entity_id");`)
    this.addSql(`create index if not exists "IDX_social_activity_created_at" on "social_activity" ("created_at");`)
    this.addSql(`create index if not exists "IDX_social_activity_action" on "social_activity" ("action");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "social_activity" cascade;`)
  }
}
