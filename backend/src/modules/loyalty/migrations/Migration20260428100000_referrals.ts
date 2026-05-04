import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260428100000Referrals extends Migration {
  override async up(): Promise<void> {
    // Per-customer canonical code
    this.addSql(`create table if not exists "loyalty_referral_code" (
      "id" text not null,
      "customer_id" text not null,
      "code" text not null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "loyalty_referral_code_pkey" primary key ("id")
    );`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_loyalty_referral_code_customer" ON "loyalty_referral_code" ("customer_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_loyalty_referral_code_code" ON "loyalty_referral_code" ("code") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_referral_code_deleted_at" ON "loyalty_referral_code" ("deleted_at") WHERE deleted_at IS NULL;`)

    // Successful or rejected referral relationships
    this.addSql(`create table if not exists "loyalty_referral" (
      "id" text not null,
      "referrer_customer_id" text not null,
      "referee_customer_id" text not null,
      "referee_email" text null,
      "code" text not null,
      "order_id" text null,
      "status" text not null default 'pending',
      "rejected_reason" text null,
      "referrer_points" integer not null default 0,
      "referee_points" integer not null default 0,
      "awarded_at" timestamptz null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "loyalty_referral_pkey" primary key ("id")
    );`)
    // A customer can only ever be the referee in ONE awarded relationship.
    // Rejected attempts are still allowed (so we can re-evaluate / audit).
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_loyalty_referral_awarded_referee" ON "loyalty_referral" ("referee_customer_id") WHERE status = 'awarded' AND deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_referral_referrer" ON "loyalty_referral" ("referrer_customer_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_referral_code" ON "loyalty_referral" ("code") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_referral_order" ON "loyalty_referral" ("order_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_referral_deleted_at" ON "loyalty_referral" ("deleted_at") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "loyalty_referral" cascade;`)
    this.addSql(`drop table if exists "loyalty_referral_code" cascade;`)
  }
}
