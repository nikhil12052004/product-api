const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// GET products with cursor-based pagination
app.get('/api/products', async (req, res) => {
    try {
        const { category, cursor, limit = 20 } = req.query;
        const parsedLimit = parseInt(limit);
        
        console.log('📦 Request:', { category, cursor, limit });
        
        let query = 'SELECT * FROM products';
        const params = [];
        let paramCounter = 1;
        
        const conditions = [];
        
        // Category filter
        if (category) {
            conditions.push(`category = $${paramCounter}`);
            params.push(category);
            paramCounter++;
        }
        
        // Cursor pagination
        if (cursor) {
            const parts = cursor.split('_');
            if (parts.length !== 2) {
                throw new Error('Invalid cursor format. Expected: timestamp_id');
            }
            const [cursorDate, cursorId] = parts;
            conditions.push(`(updated_at, id) < ($${paramCounter}::TIMESTAMP, $${paramCounter + 1}::INTEGER)`);
            params.push(cursorDate, parseInt(cursorId));
            paramCounter += 2;
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        // Always ORDER BY updated_at DESC, id DESC for cursor pagination
        query += ` ORDER BY updated_at DESC, id DESC LIMIT $${paramCounter}`;
        params.push(parsedLimit + 1);
        
        console.log('🔍 Query:', query);
        console.log('📊 Params:', params);
        
        const result = await pool.query(query, params);
        
        const hasMore = result.rows.length > parsedLimit;
        const items = result.rows.slice(0, parsedLimit);
        
        let nextCursor = null;
        if (hasMore && items.length > 0) {
            const lastItem = items[items.length - 1];
            nextCursor = `${lastItem.updated_at.toISOString()}_${lastItem.id}`;
        }
        
        res.json({
            success: true,
            data: items,
            pagination: {
                nextCursor,
                hasMore,
                limit: parsedLimit,
                count: items.length
            }
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('❌ Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Get categories
app.get('/api/categories', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT category 
            FROM products 
            ORDER BY category
        `);
        
        res.json({
            success: true,
            data: result.rows.map(row => row.category)
        });
    } catch (error) {
        console.error('❌ Categories error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Frontend route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(` Server running on port ${PORT}`);
    console.log(` Health check: http://localhost:${PORT}/api/health`);
    console.log(` Products API: http://localhost:${PORT}/api/products`);
    console.log(` Frontend: http://localhost:${PORT}`);
});