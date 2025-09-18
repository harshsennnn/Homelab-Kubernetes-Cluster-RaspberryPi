// product-service/db/migrations/20251213110000_add_main_and_subcategory_to_products.js
/**
 * Adds new category fields to products:
 * - mainCategoryId: predefined (admin-service)
 * - subCategory: seller-provided (free text)
 *
 * Also deprecates productCategoryId by:
 * - attempting to drop FK constraints on it (if any)
 * - making it nullable
 *
 * This migration is defensive: it checks column/constraint existence before altering.
 */

exports.up = async function (knex) {
  const tbl = 'products';

  async function getActualColumnName(columnName) {
    const res = await knex.raw(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = ?
         AND lower(column_name) = lower(?)
       LIMIT 1`,
      [tbl, columnName]
    );

    return res?.rows?.[0]?.column_name ?? null;
  }

  // 1) Add mainCategoryId + subCategory if missing
  const mainCategoryCol = await getActualColumnName('mainCategoryId');
  if (!mainCategoryCol) {
    await knex.schema.alterTable(tbl, (t) => {
      t.uuid('mainCategoryId').nullable();
    });
  }

  const subCategoryCol = await getActualColumnName('subCategory');
  if (!subCategoryCol) {
    await knex.schema.alterTable(tbl, (t) => {
      t.text('subCategory').nullable();
    });
  }

  // 2) Deprecate productCategoryId: drop FK constraints and allow NULL
  const productCategoryCol = await getActualColumnName('productCategoryId');
  if (productCategoryCol) {
    // Find FK constraints that involve this column
    const fkRows = await knex.raw(
      `SELECT DISTINCT c.conname
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
       WHERE t.relname = ?
         AND c.contype = 'f'
         AND lower(a.attname) = lower(?)`,
      [tbl, productCategoryCol]
    );

    for (const row of fkRows?.rows ?? []) {
      const constraintName = row.conname;
      // Drop constraint if present
      await knex.raw('ALTER TABLE ?? DROP CONSTRAINT IF EXISTS ??', [tbl, constraintName]);
    }

    // Ensure productCategoryId is nullable
    await knex.raw('ALTER TABLE ?? ALTER COLUMN ?? DROP NOT NULL', [tbl, productCategoryCol]);
  }

  // 3) Indexes (best-effort)
  try {
    await knex.schema.alterTable(tbl, (t) => {
      t.index(['mainCategoryId'], 'idx_products_main_category_id');
      t.index(['subCategory'], 'idx_products_sub_category');
    });
  } catch (e) {
    // ignore index errors (already exist etc.)
    console.warn('Index creation warning:', e.message || e);
  }
};

exports.down = async function (knex) {
  // No-op by default to avoid data loss.
  // If you want to rollback in dev, you can drop the new columns:
  // await knex.schema.alterTable('products', (t) => {
  //   t.dropColumn('mainCategoryId');
  //   t.dropColumn('subCategory');
  // });
};
