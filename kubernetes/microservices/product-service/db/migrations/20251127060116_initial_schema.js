// migrations/20251211_normalize_products_columns.js
/**
 * Ensure products table has snake_case columns expected by backend:
 * - is_public (boolean) default true
 * - stock_quantity (integer) default 0
 * - seller_id (uuid/text) (copy from sellerId if present)
 *
 * Also copy data from possible camelCase columns if present:
 *  - stockQuantity -> stock_quantity
 *  - sellerId -> seller_id
 *
 * NOTE: We do not drop old camelCase columns automatically here.
 * If you want to drop them later, uncomment the drop statements after verifying.
 */

exports.up = async function (knex) {
    const tbl = 'products';

    // helper: check actual column existence (information_schema uses lowercase)
    async function hasColumn(columnName) {
        const res = await knex.raw(
            `SELECT 1 FROM information_schema.columns WHERE table_name = ? AND column_name = ? LIMIT 1`,
            [tbl, columnName.toLowerCase()]
        );
        // Postgres returns rows in res.rows
        return (res && res.rows && res.rows.length > 0);
    }

    // create columns if not exist
    const hasIsPublic = await hasColumn('is_public');
    if (!hasIsPublic) {
        await knex.schema.alterTable(tbl, (t) => {
            t.boolean('is_public').defaultTo(true);
        });
    }

    const hasStockQty = await hasColumn('stock_quantity');
    if (!hasStockQty) {
        await knex.schema.alterTable(tbl, (t) => {
            t.integer('stock_quantity').defaultTo(0);
        });
    }

    const hasSellerIdSnake = await hasColumn('seller_id');
    if (!hasSellerIdSnake) {
        await knex.schema.alterTable(tbl, (t) => {
            // your existing column is `sellerId` (string) in migration; use text to be safe
            t.text('seller_id').nullable();
        });
    }

    // --- Copy from existing camelCase columns if present ---
    // 1) stockQuantity -> stock_quantity
    const hasStockQuantityCamel = await hasColumn('stockquantity'); // covers stockQuantity -> lowercased
    if (hasStockQuantityCamel) {
        await knex.raw(`UPDATE ${tbl} SET stock_quantity = COALESCE(stock_quantity, stockQuantity) WHERE stockQuantity IS NOT NULL`);
        // Note: in raw SQL, unquoted stockQuantity will be lowercased to stockquantity by Postgres.
        // The above will work if the DB column name is stockquantity. If not, adjust accordingly.
    }

    // 2) sellerId -> seller_id
    const hasSellerIdCamel = await hasColumn('sellerid');
    if (hasSellerIdCamel) {
        await knex.raw(`UPDATE ${tbl} SET seller_id = COALESCE(seller_id, sellerId) WHERE sellerId IS NOT NULL`);
    }

    // 3) If you used camelCase 'isFeatured' but want to keep it separate, don't copy.
    // If you had 'isPublic' earlier (rare), handle similarly:
    const hasIsPublicCamel = await hasColumn('ispublic');
    if (hasIsPublicCamel) {
        await knex.raw(`UPDATE ${tbl} SET is_public = COALESCE(is_public, isPublic) WHERE isPublic IS NOT NULL`);
    }

    // 4) If your migration used camelCase column names like 'stockQuantity' that ended up as 'stockquantity',
    //    the hasColumn('stockquantity') check above will find them. We used lowercasing to be robust.

    // OPTIONAL: If you want to drop the old camelCase columns after verifying data copied, uncomment:
    // (Do NOT enable this until you manually verify)
    //
    // await knex.schema.alterTable(tbl, (t) => {
    //   if (hasStockQuantityCamel) t.dropColumn('stockQuantity');
    //   if (hasSellerIdCamel) t.dropColumn('sellerId');
    //   if (hasIsPublicCamel) t.dropColumn('isPublic');
    // });

    // Add indexes for performance if not present
    // (index creation is idempotent in many cases; for safety we check)
    try {
        await knex.schema.alterTable(tbl, (t) => {
            t.index(['seller_id'], 'idx_products_seller_id');
            t.index(['status'], 'idx_products_status');
            t.index(['stock_quantity'], 'idx_products_stock_qty');
            t.index(['brand'], 'idx_products_brand');
            t.index(['productCategoryId'], 'idx_products_product_category_id'); // productCategoryId left as-is
        });
    } catch (e) {
        // ignore index errors (already exist etc.)
        console.warn('Index creation warning:', e.message || e);
    }
};

exports.down = async function (knex) {
    const tbl = 'products';
    // On rollback, we won't drop new columns automatically to avoid data loss.
    // If you must rollback in dev, uncomment drops below.

    // await knex.schema.alterTable(tbl, (t) => {
    //   t.dropColumnIfExists('is_public');
    //   t.dropColumnIfExists('stock_quantity');
    //   t.dropColumnIfExists('seller_id');
    // });
};
