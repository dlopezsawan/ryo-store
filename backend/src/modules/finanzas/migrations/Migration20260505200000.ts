import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Make finanzas_conversion.pago_movil_id nullable so the panel's
 * "Nueva conversión" modal can register standalone Bs→USDT swaps that
 * aren't tied to a specific pago_movil row (e.g. converting surplus Bs
 * from the business wallet, accumulated change, manual-sale residue).
 *
 * Existing rows already have pago_movil_id set, so this is a non-
 * destructive widening of the constraint — no data migration needed.
 */
export class Migration20260505200000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "finanzas_conversion" ALTER COLUMN "pago_movil_id" DROP NOT NULL;`
    )
  }

  override async down(): Promise<void> {
    // Reverting requires that no rows have pago_movil_id IS NULL. If any
    // standalone conversions exist, this will fail — and that's the
    // correct behavior (you can't roll back a feature with data using
    // it). Operator would need to either delete those rows or migrate
    // them onto a synthetic pago_movil first.
    this.addSql(
      `ALTER TABLE "finanzas_conversion" ALTER COLUMN "pago_movil_id" SET NOT NULL;`
    )
  }
}
