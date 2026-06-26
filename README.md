# 🛍️ Product API with Cursor Pagination

A high-performance product catalog API built with Node.js, Express, and PostgreSQL. Handles **200,000+ products** with cursor-based pagination for consistent results even when data changes in real-time.

## 🚀 Live Demo

-https://product-api-wnhc.onrender.com/


## ✨ Features

- ✅ **200,000+ products** with batch insertion
- ✅ **Cursor-based pagination** - No duplicates, no missed products
- ✅ **Category filtering** - Filter products by category
- ✅ **Real-time consistency** - Handles concurrent updates gracefully
- ✅ **Search functionality** - Search products by name
- ✅ **Beautiful frontend** - Clean UI with skeleton loading
- ✅ **Fast queries** - Optimized with database indexes
- ✅ **Deployed on Render** - Free hosting with auto-deploy

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Node.js + Express** | Backend framework |
| **PostgreSQL (Neon)** | Database |
| **Cursor Pagination** | Consistent pagination |
| **Render** | Hosting |
| **HTML/CSS/JS** | Frontend |


## API endpoints
- GET /api/products - Get products (limit, category, cursor)
- GET /api/categories - Get all categories
- GET /api/health - Health check

## Run Locally
```bash
npm install
npm run setup
npm run seed
npm run dev


