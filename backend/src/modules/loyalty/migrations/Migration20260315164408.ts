import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260315164408 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "loyalty_reward" ("id" text not null, "name" text not null, "description" text null, "points_required" integer not null, "image_url" text null, "is_active" boolean not null default true, "stock" integer null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "loyalty_reward_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_reward_deleted_at" ON "loyalty_reward" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "loyalty_transaction" ("id" text not null, "customer_id" text not null, "points" integer not null, "type" text not null, "order_id" text null, "reward_id" text null, "description" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "loyalty_transaction_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_transaction_deleted_at" ON "loyalty_transaction" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "loyalty_reward" cascade;`);

    this.addSql(`drop table if exists "loyalty_transaction" cascade;`);
  }

}
