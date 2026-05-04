import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260427180000 extends Migration {
  override async up(): Promise<void> {
    // ── finanzas_wallet ──────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "finanzas_wallet" (
        "id" text not null,
        "name" text not null,
        "currency" text not null,
        "description" text null,
        "is_active" boolean not null default true,
        "sort_order" integer not null default 0,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "finanzas_wallet_pkey" primary key ("id")
      );
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_wallet_deleted_at" ON "finanzas_wallet" ("deleted_at") WHERE deleted_at IS NULL;
    `)

    // ── finanzas_split_rule ──────────────────────────────────────────────
    this.addSql(`
      create table if not exists "finanzas_split_rule" (
        "id" text not null,
        "bucket" text not null,
        "percentage" numeric not null,
        "description" text null,
        "is_active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "finanzas_split_rule_pkey" primary key ("id")
      );
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_split_rule_deleted_at" ON "finanzas_split_rule" ("deleted_at") WHERE deleted_at IS NULL;
    `)

    // ── finanzas_product_cost ────────────────────────────────────────────
    this.addSql(`
      create table if not exists "finanzas_product_cost" (
        "id" text not null,
        "variant_id" text not null,
        "product_id" text null,
        "product_handle" text null,
        "variant_title" text null,
        "unit_cost_eur" numeric not null,
        "notes" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "finanzas_product_cost_pkey" primary key ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_finanzas_product_cost_variant_id_unique"
        ON "finanzas_product_cost" ("variant_id") WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_product_cost_deleted_at" ON "finanzas_product_cost" ("deleted_at") WHERE deleted_at IS NULL;
    `)

    // ── finanzas_pago_movil ──────────────────────────────────────────────
    this.addSql(`
      create table if not exists "finanzas_pago_movil" (
        "id" text not null,
        "order_id" text not null,
        "order_display_id" integer not null,
        "order_email" text null,
        "customer_name" text null,
        "cedula" text null,
        "customer_phone" text null,
        "bcv_eur_rate" numeric not null,
        "usdt_eur_rate" numeric not null,
        "amount_eur_subtotal" numeric not null,
        "amount_eur_discount" numeric not null default 0,
        "amount_eur_total" numeric not null,
        "amount_bs_total" numeric not null,
        "amount_usdt_theoretical" numeric not null,
        "amount_eur_cogs" numeric not null default 0,
        "amount_bs_cogs" numeric not null default 0,
        "amount_usdt_cogs" numeric not null default 0,
        "amount_eur_margin" numeric not null default 0,
        "amount_bs_margin" numeric not null default 0,
        "amount_usdt_margin" numeric not null default 0,
        "split_restock_eur" numeric not null default 0,
        "split_restock_bs" numeric not null default 0,
        "split_restock_usdt" numeric not null default 0,
        "split_gastos_fijos_eur" numeric not null default 0,
        "split_gastos_fijos_bs" numeric not null default 0,
        "split_gastos_fijos_usdt" numeric not null default 0,
        "split_marketing_eur" numeric not null default 0,
        "split_marketing_bs" numeric not null default 0,
        "split_marketing_usdt" numeric not null default 0,
        "split_ganancia_eur" numeric not null default 0,
        "split_ganancia_bs" numeric not null default 0,
        "split_ganancia_usdt" numeric not null default 0,
        "status" text not null default 'verificado',
        "cogs_complete" boolean not null default true,
        "margin_negative" boolean not null default false,
        "bs_converted_total" numeric not null default 0,
        "bs_pending" numeric not null default 0,
        "payment_proof_url" text null,
        "notes" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "finanzas_pago_movil_pkey" primary key ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_finanzas_pago_movil_order_id_unique"
        ON "finanzas_pago_movil" ("order_id") WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_pago_movil_status" ON "finanzas_pago_movil" ("status");
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_pago_movil_created" ON "finanzas_pago_movil" ("created_at" DESC);
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_pago_movil_deleted_at" ON "finanzas_pago_movil" ("deleted_at") WHERE deleted_at IS NULL;
    `)

    // ── finanzas_pago_movil_line ─────────────────────────────────────────
    this.addSql(`
      create table if not exists "finanzas_pago_movil_line" (
        "id" text not null,
        "pago_movil_id" text not null,
        "order_line_item_id" text null,
        "product_id" text null,
        "variant_id" text null,
        "product_handle" text null,
        "title" text not null,
        "quantity" integer not null,
        "unit_price_eur" numeric not null,
        "line_subtotal_eur" numeric not null,
        "line_discount_eur" numeric not null default 0,
        "line_revenue_eur" numeric not null,
        "unit_cost_eur" numeric null,
        "line_cost_eur" numeric null,
        "line_margin_eur" numeric null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "finanzas_pago_movil_line_pkey" primary key ("id")
      );
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_pago_movil_line_parent" ON "finanzas_pago_movil_line" ("pago_movil_id");
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_pago_movil_line_deleted_at" ON "finanzas_pago_movil_line" ("deleted_at") WHERE deleted_at IS NULL;
    `)

    // ── finanzas_conversion ──────────────────────────────────────────────
    this.addSql(`
      create table if not exists "finanzas_conversion" (
        "id" text not null,
        "pago_movil_id" text not null,
        "amount_bs" numeric not null,
        "amount_usdt" numeric not null,
        "rate_bs_per_usdt" numeric not null,
        "source_wallet_id" text null,
        "dest_wallet_id" text null,
        "note" text null,
        "converted_at" timestamptz not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "finanzas_conversion_pkey" primary key ("id")
      );
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_conversion_parent" ON "finanzas_conversion" ("pago_movil_id");
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_conversion_deleted_at" ON "finanzas_conversion" ("deleted_at") WHERE deleted_at IS NULL;
    `)

    // ── finanzas_expense_category ────────────────────────────────────────
    this.addSql(`
      create table if not exists "finanzas_expense_category" (
        "id" text not null,
        "name" text not null,
        "bucket" text not null,
        "description" text null,
        "is_recurring" boolean not null default false,
        "recurring_amount_usdt" numeric null,
        "recurring_day_of_month" integer null,
        "is_active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "finanzas_expense_category_pkey" primary key ("id")
      );
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_expense_category_deleted_at" ON "finanzas_expense_category" ("deleted_at") WHERE deleted_at IS NULL;
    `)

    // ── finanzas_expense ────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "finanzas_expense" (
        "id" text not null,
        "category_id" text not null,
        "description" text not null,
        "amount_usdt" numeric not null,
        "amount_bs" numeric null,
        "rate_bs_per_usdt" numeric null,
        "paid_from_wallet_id" text null,
        "receipt_url" text null,
        "expense_date" timestamptz not null,
        "notes" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "finanzas_expense_pkey" primary key ("id")
      );
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_expense_category" ON "finanzas_expense" ("category_id");
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_expense_date" ON "finanzas_expense" ("expense_date" DESC);
      CREATE INDEX IF NOT EXISTS "IDX_finanzas_expense_deleted_at" ON "finanzas_expense" ("deleted_at") WHERE deleted_at IS NULL;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "finanzas_expense" cascade;`)
    this.addSql(`drop table if exists "finanzas_expense_category" cascade;`)
    this.addSql(`drop table if exists "finanzas_conversion" cascade;`)
    this.addSql(`drop table if exists "finanzas_pago_movil_line" cascade;`)
    this.addSql(`drop table if exists "finanzas_pago_movil" cascade;`)
    this.addSql(`drop table if exists "finanzas_product_cost" cascade;`)
    this.addSql(`drop table if exists "finanzas_split_rule" cascade;`)
    this.addSql(`drop table if exists "finanzas_wallet" cascade;`)
  }
}
