import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Tracks the Buffer post ID so we can later delete/edit/query status.
 *
 * Why a separate field rather than overloading ig_post_id:
 *   - Buffer post ID lives in the scheduled state (before anything is on IG)
 *   - ig_post_id only fills in after Buffer publishes to IG (via webhook)
 *   - Keeping them apart means we can cancel a Buffer draft without losing
 *     the IG permalink if we ever store both.
 */
export class Migration20260424030000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "social_post" add column if not exists "buffer_post_id" text null;`)
    this.addSql(`alter table "social_story" add column if not exists "buffer_post_id" text null;`)
    this.addSql(`create index if not exists "IDX_social_post_buffer_id" on "social_post" ("buffer_post_id");`)
    this.addSql(`create index if not exists "IDX_social_story_buffer_id" on "social_story" ("buffer_post_id");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_social_post_buffer_id";`)
    this.addSql(`drop index if exists "IDX_social_story_buffer_id";`)
    this.addSql(`alter table "social_post" drop column if exists "buffer_post_id";`)
    this.addSql(`alter table "social_story" drop column if exists "buffer_post_id";`)
  }
}
