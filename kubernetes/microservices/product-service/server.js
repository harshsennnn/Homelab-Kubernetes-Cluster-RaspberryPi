// server.js
const express = require('express');
const productController = require('./controllers/productController');
const db = require('./db');

const app = express();
const port = 5002;

app.use(express.json());

// Simple request logger to help debug route matching
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// UUID pattern (adjust if your IDs are not UUIDs)
const UUID_PATTERN = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

// ----------------------
// Public routes
// ----------------------

// Main categories (used by the API gateway)
app.get('/categories/main', productController.getMainCategories);
// Backward/typo-friendly alias
app.get('/category/main', productController.getMainCategories);

// List all public/published products
app.get('/products', productController.getAllPublicProducts);

// Public products by main category
app.get('/products/main-category/:mainCategoryId', productController.getPublicProductsByMainCategory);

// Static stats endpoint must be registered BEFORE the dynamic :productId route
app.get('/products/stats', productController.getProductStats);

// Public single product by ID (only match UUIDs)
app.get(`/products/:productId(${UUID_PATTERN})`, productController.getPublicProductById);

// ----------------------
// Seller / Private routes
// Note: we use 'x-user-id' header to simulate auth in this service.
// ----------------------

// Seller-specific stats (requires x-user-id header)
app.get('/seller/products/stats', productController.getSellerProductStats);

// List products for seller
app.get('/seller/products', productController.getProductsBySeller);

// Seller products by main category
app.get('/seller/products/main-category/:mainCategoryId', productController.getSellerProductsByMainCategory);

// Create a product (seller must send x-user-id header)
app.post('/products', productController.createProduct);

// Update / Delete product (only match UUIDs to avoid collision with static routes)
app.put(`/products/:productId(${UUID_PATTERN})`, productController.updateProduct);
app.delete(`/products/:productId(${UUID_PATTERN})`, productController.deleteProduct);

// ----------------------
// Start service (run migrations first)
// ----------------------
db.migrate.latest()
  .then(() => {
    console.log('Migrations are up to date');
    app.listen(port, () => {
      console.log(`✅ Product service listening at http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error('❌ Error running migrations', err);
    process.exit(1);
  });
