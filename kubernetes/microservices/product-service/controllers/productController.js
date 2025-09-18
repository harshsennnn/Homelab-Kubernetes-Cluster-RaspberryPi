// product-service/controllers/productController.js
const axios = require('axios');
const productRepository = require('../repositories/productRepository');
const categoryRepo = require('../repositories/categoryRepository');

// In this service we often rely on `x-user-id` for identifying the caller.
// Previously we also required `x-user-role=seller`, but the API gateway doesn't
// forward that header everywhere. To avoid blocking legitimate sellers, we
// verify the role from user-service when the role header is missing.
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:5006';

async function fetchUserById(userId) {
  if (!userId) return null;

  // Primary: docker-compose service DNS
  try {
    const resp = await axios.get(`${USER_SERVICE_URL}/users/${userId}`);
    return resp.data;
  } catch (e) {
    // Fallback: local dev without docker DNS
    try {
      const resp = await axios.get(`http://localhost:5006/users/${userId}`);
      return resp.data;
    } catch (e2) {
      console.error('fetchUserById error:', e2.response?.data || e2.message);
      return null;
    }
  }
}

async function isSellerUser(userId, roleHeader) {
  if (roleHeader) return String(roleHeader).toLowerCase() === 'seller';
  const user = await fetchUserById(userId);
  return user?.role === 'seller';
}

// ===========================================================
// PUBLIC — All Products
// ===========================================================
exports.getAllPublicProducts = async (req, res) => {
  try {
    const products = await productRepository.findPublicProducts();
    res.json(products);
  } catch (err) {
    console.error('getAllPublicProducts error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// ===========================================================
// PUBLIC — Products by Main Category
// ===========================================================
exports.getPublicProductsByMainCategory = async (req, res) => {
  try {
    const { mainCategoryId } = req.params;
    if (!mainCategoryId) return res.status(400).json({ message: 'mainCategoryId is required' });

    // Optional validation against predefined main categories
    const mainCat = await categoryRepo.getMainCategoryById(mainCategoryId);
    if (!mainCat) return res.status(400).json({ message: 'Invalid mainCategoryId' });

    const products = await productRepository.findPublicProductsByMainCategory(mainCategoryId);
    res.json(products);
  } catch (err) {
    console.error('getPublicProductsByMainCategory error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// ===========================================================
// PRIVATE — Seller Products by Main Category
// ===========================================================
exports.getSellerProductsByMainCategory = async (req, res) => {
  try {
    const sellerId = req.headers['x-user-id'];
    if (!sellerId)
      return res.status(401).json({ message: 'Unauthorized: Missing X-User-ID header' });

    const { mainCategoryId } = req.params;
    if (!mainCategoryId) return res.status(400).json({ message: 'mainCategoryId is required' });

    // Optional validation against predefined main categories
    const mainCat = await categoryRepo.getMainCategoryById(mainCategoryId);
    if (!mainCat) return res.status(400).json({ message: 'Invalid mainCategoryId' });

    const products = await productRepository.findProductsBySellerIdAndMainCategory(sellerId, mainCategoryId);
    res.json(products);
  } catch (err) {
    console.error('getSellerProductsByMainCategory error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// ===========================================================
// PUBLIC — Main Categories
// Note: categories are owned by admin-service; product-service proxies via categoryRepository.
// ===========================================================
exports.getMainCategories = async (req, res) => {
  try {
    const categories = await categoryRepo.getAllMainCategories();
    res.json(categories);
  } catch (err) {
    console.error('getMainCategories error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// ===========================================================
// PUBLIC — Single Product
// ===========================================================
exports.getPublicProductById = async (req, res) => {
  try {
    const product = await productRepository.findPublicProductById(req.params.productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    console.error('getPublicProductById error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// ===========================================================
// PRIVATE — Seller Products
// ===========================================================
exports.getProductsBySeller = async (req, res) => {
  try {
    const sellerId = req.headers['x-user-id'];
    if (!sellerId)
      return res.status(401).json({ message: 'Unauthorized: Missing X-User-ID header' });

    const sellerProducts = await productRepository.findProductsBySellerId(sellerId);
    res.json(sellerProducts);
  } catch (err) {
    console.error('getProductsBySeller error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// ===========================================================
// CREATE PRODUCT (Seller Only)
// ===========================================================
exports.createProduct = async (req, res) => {
  try {
    const sellerId = req.headers['x-user-id'];
    const roleHeader = req.headers['x-user-role'];

    if (!sellerId)
      return res.status(401).json({ message: 'Unauthorized: Missing X-User-ID header' });

    const isSeller = await isSellerUser(sellerId, roleHeader);
    if (!isSeller)
      return res.status(403).json({ message: 'Forbidden: Only sellers can create products' });

    const {
      name,
      description,
      price,
      unit,
      stockQuantity,
      status,
      brand,
      mainCategoryId,
      subCategory, // seller-provided (free text)
    } = req.body;

    if (!name || !description || !brand)
      return res.status(400).json({ message: 'Missing required fields: name, description, brand' });

    if (!mainCategoryId || !subCategory)
      return res.status(400).json({ message: 'Missing required fields: mainCategoryId, subCategory' });

    if (typeof subCategory !== 'string' || !subCategory.trim())
      return res.status(400).json({ message: 'subCategory must be a non-empty string' });

    // ✅ Validate main category exists (predefined). Sub-category is free text.
    const mainCat = await categoryRepo.getMainCategoryById(mainCategoryId);
    if (!mainCat) return res.status(400).json({ message: 'Invalid mainCategoryId' });

    // DB has a NOT NULL businessCategory column (legacy). Map it to main category name.
    const businessCategory = mainCat.name;

    // ✅ Create product
    const [newProduct] = await productRepository.create({
      name,
      description,
      brand,
      price: price ? parseFloat(price) : null,
      unit,
      stockQuantity: stockQuantity ? parseInt(stockQuantity) : 0,
      status: status || 'draft',
      businessCategory,
      mainCategoryId,
      subCategory,
      sellerId,
    });

    res.status(201).json(newProduct);
  } catch (err) {
    console.error('createProduct error:', err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

// ===========================================================
// UPDATE PRODUCT (Seller Only)
// ===========================================================
exports.updateProduct = async (req, res) => {
  try {
    const sellerId = req.headers['x-user-id'];
    const roleHeader = req.headers['x-user-role'];

    if (!sellerId)
      return res.status(401).json({ message: 'Unauthorized: Missing X-User-ID header' });

    const isSeller = await isSellerUser(sellerId, roleHeader);
    if (!isSeller)
      return res.status(403).json({ message: 'Forbidden: Only sellers can update products' });

    const productId = req.params.productId;
    const product = await productRepository.findProductById(productId);

    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (product.sellerId !== sellerId)
      return res.status(403).json({ message: 'Forbidden: You do not own this product' });

    const {
      name,
      description,
      price,
      unit,
      stockQuantity,
      status,
      mainCategoryId,
      subCategory,
    } = req.body;

    // Optional main category validation
    let businessCategory;
    if (mainCategoryId) {
      const mainCat = await categoryRepo.getMainCategoryById(mainCategoryId);
      if (!mainCat) return res.status(400).json({ message: 'Invalid mainCategoryId' });
      // keep legacy NOT NULL column in sync with main category
      businessCategory = mainCat.name;
    }

    if (subCategory !== undefined && (typeof subCategory !== 'string' || !subCategory.trim()))
      return res.status(400).json({ message: 'subCategory must be a non-empty string' });

    const [updatedProduct] = await productRepository.update(productId, {
      name,
      description,
      price: price ? parseFloat(price) : undefined,
      unit,
      stockQuantity: stockQuantity ? parseInt(stockQuantity) : undefined,
      status,
      businessCategory,
      mainCategoryId,
      subCategory,
    });

    res.json(updatedProduct);
  } catch (err) {
    console.error('updateProduct error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// ===========================================================
// DELETE PRODUCT
// ===========================================================
exports.deleteProduct = async (req, res) => {
    try {
        const sellerId = req.headers['x-user-id'];
        if (!sellerId) {
            return res.status(401).json({ message: 'Unauthorized: Missing X-User-ID header' });
        }
        const productId = req.params.productId;

        const product = await productRepository.findProductById(productId);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (product.sellerId !== sellerId) {
            return res.status(403).json({ message: 'Forbidden: You do not own this product' });
        }

        await productRepository.remove(productId);
        res.json({ message: 'Product deleted successfully' });
    } catch (err) {
        console.error("deleteProduct error:", err);
        res.status(500).json({ message: "Server Error" });
    }
};




// near top, keep existing requires

// ------------------ New: Public product stats ------------------
exports.getProductStats = async (req, res) => {
  try {
    // optionally support query params like ?lowStockThreshold=10
    const lowStockThreshold = parseInt(req.query.lowStockThreshold, 10) || 5;
    const brandLimit = parseInt(req.query.brandLimit, 10) || 6;
    const categoryLimit = parseInt(req.query.categoryLimit, 10) || 6;

    // run queries in parallel
    const [
      totalPublic,
      statusCounts,
      lowStockCount,
      byBrand,
      byCategory
    ] = await Promise.all([
      productRepository.countAllPublic(),
      productRepository.countByStatus(),
      productRepository.countLowStock(lowStockThreshold),
      productRepository.countByBrand(brandLimit),
      productRepository.countByCategory(categoryLimit)
    ]);

    res.json({
      totalProducts: totalPublic,
      statusCounts,         // { published: 10, draft: 2, ... }
      lowStockCount,
      byBrand,
      byCategory
    });
  } catch (err) {
    console.error("getProductStats error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

// ------------------ New: Seller specific product stats ------------------
exports.getSellerProductStats = async (req, res) => {
  try {
    const sellerId = req.headers['x-user-id'];
    if (!sellerId) {
      return res.status(401).json({ message: 'Unauthorized: Missing X-User-ID header' });
    }
    const stats = await productRepository.countBySeller(sellerId);
    res.json(stats);
  } catch (err) {
    console.error("getSellerProductStats error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};
