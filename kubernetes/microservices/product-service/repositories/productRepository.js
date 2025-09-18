// repositories/productRepository.js
const db = require('../db'); // knex instance

module.exports = {
  // PUBLIC: return only published products
  findPublicProducts: async () => {
    return db('products').where({ status: 'published' }).select('*');
  },

  findPublicProductsByMainCategory: async (mainCategoryId) => {
    return db('products')
      .where({ status: 'published', mainCategoryId })
      .select('*');
  },

  findPublicProductById: async (productId) => {
    // treat "published" products as public
    return db('products').where({ id: productId, status: 'published' }).first();
  },

  // Seller-specific (your table uses sellerId as string column)
  findProductsBySellerId: async (sellerId) => {
    return db('products').where({ sellerId }).select('*');
  },

  findProductsBySellerIdAndMainCategory: async (sellerId, mainCategoryId) => {
    return db('products').where({ sellerId, mainCategoryId }).select('*');
  },

  findProductById: async (productId) => {
    return db('products').where({ id: productId }).first();
  },

  create: async (payload) => {
    // Keep using camelCase keys matching your schema
    const toInsert = {
      name: payload.name,
      description: payload.description,
      price: payload.price,
      unit: payload.unit,
      image: payload.image,
      // category fields
      businessCategory: payload.businessCategory,
      mainCategoryId: payload.mainCategoryId,
      subCategory: payload.subCategory,
      // productCategoryId removed from API (kept in DB only for backwards compatibility)
      brand: payload.brand,
      stockQuantity: payload.stockQuantity ?? 0,
      isFeatured: payload.isFeatured ?? false,
      status: payload.status ?? 'draft',
      isLeadPlaceholder: payload.isLeadPlaceholder ?? false,
      hsnCode: payload.hsnCode,
      gstRate: payload.gstRate,
      gstInclusive: payload.gstInclusive ?? false,
      sellerId: payload.sellerId
    };
    const [row] = await db('products').insert(toInsert).returning('*');
    return [row];
  },

  update: async (productId, payload) => {
    const updatePayload = {};
    if (payload.name !== undefined) updatePayload.name = payload.name;
    if (payload.description !== undefined) updatePayload.description = payload.description;
    if (payload.price !== undefined) updatePayload.price = payload.price;
    if (payload.unit !== undefined) updatePayload.unit = payload.unit;
    if (payload.image !== undefined) updatePayload.image = payload.image;
    if (payload.businessCategory !== undefined) updatePayload.businessCategory = payload.businessCategory;
    if (payload.mainCategoryId !== undefined) updatePayload.mainCategoryId = payload.mainCategoryId;
    if (payload.subCategory !== undefined) updatePayload.subCategory = payload.subCategory;
    if (payload.brand !== undefined) updatePayload.brand = payload.brand;
    if (payload.stockQuantity !== undefined) updatePayload.stockQuantity = payload.stockQuantity;
    if (payload.isFeatured !== undefined) updatePayload.isFeatured = payload.isFeatured;
    if (payload.status !== undefined) updatePayload.status = payload.status;
    if (payload.isLeadPlaceholder !== undefined) updatePayload.isLeadPlaceholder = payload.isLeadPlaceholder;
    if (payload.hsnCode !== undefined) updatePayload.hsnCode = payload.hsnCode;
    if (payload.gstRate !== undefined) updatePayload.gstRate = payload.gstRate;
    if (payload.gstInclusive !== undefined) updatePayload.gstInclusive = payload.gstInclusive;
    // sellerId normally shouldn't be updated, but allow if provided
    if (payload.sellerId !== undefined) updatePayload.sellerId = payload.sellerId;

    const [row] = await db('products').where({ id: productId }).update(updatePayload).returning('*');
    return [row];
  },

  remove: async (productId) => {
    return db('products').where({ id: productId }).del();
  },

  /* -----------------------------
     Stats / Aggregation helpers
     ----------------------------- */

  // total published products
  countAllPublic: async () => {
    const row = await db('products').where({ status: 'published' }).count('id as count').first();
    return parseInt(row.count, 10) || 0;
  },

  // count by status (draft / published)
  countByStatus: async () => {
    const rows = await db('products')
      .select('status')
      .count('id as count')
      .groupBy('status');
    return rows.reduce((acc, r) => {
      acc[r.status || 'unknown'] = parseInt(r.count, 10);
      return acc;
    }, {});
  },

  // low stock items using stockQuantity column (as per your migration)
  countLowStock: async (threshold = 5) => {
    const row = await db('products')
      .where('stockQuantity', '<=', threshold)
      .count('id as count')
      .first();
    return parseInt(row.count, 10) || 0;
  },

  // counts per brand (top N)
  countByBrand: async (limit = 10) => {
    const rows = await db('products')
      .select('brand')
      .count('id as count')
      .groupBy('brand')
      .orderBy('count', 'desc')
      .limit(limit);
    return rows.map(r => ({ brand: r.brand, count: parseInt(r.count, 10) }));
  },

  // counts per mainCategoryId (top N)
  countByCategory: async (limit = 10) => {
    const rows = await db('products')
      .select('mainCategoryId')
      .count('id as count')
      .groupBy('mainCategoryId')
      .orderBy('count', 'desc')
      .limit(limit);
    return rows.map(r => ({ categoryId: r.mainCategoryId, count: parseInt(r.count, 10) }));
  },

  // seller-specific totals using sellerId column
  countBySeller: async (sellerId) => {
    const totalRow = await db('products').where({ sellerId }).count('id as count').first();
    const lowStockRow = await db('products').where({ sellerId }).andWhere('stockQuantity', '<=', 5).count('id as count').first();
    const byStatusRows = await db('products').where({ sellerId }).select('status').count('id as count').groupBy('status');

    return {
      total: parseInt(totalRow.count, 10) || 0,
      lowStock: parseInt(lowStockRow.count, 10) || 0,
      byStatus: byStatusRows.reduce((acc, r) => {
        acc[r.status || 'unknown'] = parseInt(r.count, 10);
        return acc;
      }, {})
    };
  }
};
