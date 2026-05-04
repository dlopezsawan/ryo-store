import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Batch 1 — Cimientos. New tables:
 *   - finanzas_wallet_entry        (ledger)
 *   - finanzas_transfer            (wallet-to-wallet metadata)
 *   - finanzas_audit_log           (immutable audit trail)
 *   - finanzas_rate_snapshot       (historical FX)
 *   - finanzas_product_cost_history (versioned costs)
 *
 * Also adds `status` column to finanzas_expense for the recurring-expenses
 * cron to mark auto-generated rows as `pending_payment` until paid.
 */
export class Migration20260427200000 extends Migration {
  override async up(): Promise<void> {
    // ── finanzas_wallet_entry ───────────────────────────────────────────
    this.addSql(`
      create table if not exists "finanzas_wallet_entry" (
        "id" text not null,
        "wallet_id" text not null,
        "amount" numeric not null,
        "currency" text not null,
        "source_type" text not null,
        "source_id" text null,
        "note" text null,
        "entry_at" timestamptz not null,
        "reconciled_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "finanzas_wallet_entry_pkey" primary key ("id")
      );
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_wallet_entry_wallet" ON "finanzas_wallet_entry" ("wallet_id") WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_wallet_entry_source" ON "finanzas_wallet_entry" ("source_type", "source_id") WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_wallet_entry_entry_at" ON "finanzas_wallet_entry" ("entry_at" DESC);
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_wallet_entry_deleted_at" ON "finanzas_wallet_entry" ("deleted_at") WHERE deleted_at IS NULL;
    `)

    // ── finanzas_transfer ───────────────────────────────────────────────
    this.addSql(`
      create table if not exists "finanzas_transfer" (
        "id" text not null,
        "from_wallet_id" text not null,
        "to_wallet_id" text not null,
        "amount" numeric not null,
        "currency" text not null,
        "rate" numeric null,
        "amount_received" numeric null,
        "note" text null,
        "transferred_at" timestamptz not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "finanzas_transfer_pkey" primary key ("id")
      );
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_transfer_from" ON "finanzas_transfer" ("from_wallet_id");
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_transfer_to" ON "finanzas_transfer" ("to_wallet_id");
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_transfer_deleted_at" ON "finanzas_transfer" ("deleted_at") WHERE deleted_at IS NULL;
    `)

    // ── finanzas_audit_log ──────────────────────────────────────────────
    this.addSql(`
      create table if not exists "finanzas_audit_log" (
        "id" text not null,
        "entity_type" text not null,
        "entity_id" text not null,
        "action" text not null,
        "before" jsonb null,
        "after" jsonb null,
        "user_id" text null,
        "user_email" text null,
        "note" text null,
        "at" timestamptz not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "finanzas_audit_log_pkey" primary key ("id")
      );
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_audit_log_entity" ON "finanzas_audit_log" ("entity_type", "entity_id");
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_audit_log_at" ON "finanzas_audit_log" ("at" DESC);
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_audit_log_deleted_at" ON "finanzas_audit_log" ("deleted_at") WHERE deleted_at IS NULL;
    `)

    // ── finanzas_rate_snapshot ──────────────────────────────────────────
    this.addSql(`
      create table if not exists "finanzas_rate_snapshot" (
        "id" text not null,
        "taken_at" timestamptz not null,
        "bcv_eur_to_bs" numeric null,
        "bcv_usd_to_bs" numeric null,
        "paralelo_usdt_to_bs" numeric null,
        "spread_ratio" numeric null,
        "source" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "finanzas_rate_snapshot_pkey" primary key ("id")
      );
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_rate_snapshot_taken_at" ON "finanzas_rate_snapshot" ("taken_at" DESC);
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_rate_snapshot_deleted_at" ON "finanzas_rate_snapshot" ("deleted_at") WHERE deleted_at IS NULL;
    `)

    // ── finanzas_product_cost_history ───────────────────────────────────
    this.addSql(`
      create table if not exists "finanzas_product_cost_history" (
        "id" text not null,
        "variant_id" text not null,
        "unit_cost_eur" numeric not null,
        "valid_from" timestamptz not null,
        "valid_to" timestamptz null,
        "changed_by" text null,
        "note" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "finanzas_product_cost_history_pkey" primary key ("id")
      );
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_pch_variant" ON "finanzas_product_cost_history" ("variant_id");
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_pch_active" ON "finanzas_product_cost_history" ("variant_id") WHERE valid_to IS NULL AND deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_pch_deleted_at" ON "finanzas_product_cost_history" ("deleted_at") WHERE deleted_at IS NULL;
    `)

    // ── add status column to finanzas_expense ───────────────────────────
    this.addSql(`
      ALTER TABLE "finanzas_expense"
        ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'paid';
      ALTER TABLE "finanzas_expense"
        ADD COLUMN IF NOT EXISTS "auto_generated_for_month" text NULL;
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_expense_status" ON "finanzas_expense" ("status");
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE "finanzas_expense" DROP COLUMN IF EXISTS "auto_generated_for_month";`)
    this.addSql(`ALTER TABLE "finanzas_expense" DROP COLUMN IF EXISTS "status";`)
    this.addSql(`drop table if exists "finanzas_product_cost_history" cascade;`)
    this.addSql(`drop table if exists "finanzas_rate_snapshot" cascade;`)
    this.addSql(`drop table if exists "finanzas_audit_log" cascade;`)
    this.addSql(`drop table if exists "finanzas_transfer" cascade;`)
    this.addSql(`drop table if exists "finanzas_wallet_entry" cascade;`)
  }
}
