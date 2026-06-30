require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool, testConnection } = require('./config/db');
const app = express();

app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const elapsed = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${elapsed}ms`);
  });
  next();
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      database: 'connected',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      error: err.message
    });
  }
});
app.get('/api/deployment/info', (req, res) => {
  res.json({
    success: true,
    deployment: {
      type: "CockroachDB Cloud Serverless",
      cluster_host: "fresh-cart-cluster-19041.j77.cockroachlabs.cloud",
      cloud_provider: "AWS",
      regions: [
        "Mumbai (ap-south-1) - Asia",
        "N. Virginia (us-east-1) - US East",
        "Ohio (us-east-2) - US Central",
        "Oregon (us-west-2) - US West PRIMARY"
      ],
      total_regions: 4,
      continents: ["North America", "Asia"],
      max_distance: "~9,000 miles (Oregon to Mumbai)",
      products_stored: 5045,
      storage_used: "8.37 MiB",
      deployment_type: "Multi-region cloud cluster",
      deployment_date: "December 2, 2025",
      timestamp: new Date().toISOString()
    },
    message: "Connected to CockroachDB Cloud multi-region deployment"
  });
});
app.get('/api/cluster/status', async (req, res) => {
  try {
    const start = Date.now();

    const nodes = await pool.query(`
      SELECT node_id, address, is_live
      FROM crdb_internal.gossip_nodes
      ORDER BY node_id
    `);

    const ranges = await pool.query(`
      SELECT COUNT(*) as total FROM crdb_internal.ranges
    `);

    const version = await pool.query('SELECT version()');
    const duration = Date.now() - start;

    res.json({
      success: true,
      cluster: {
        nodes: nodes.rows,
        total_nodes: nodes.rows.length,
        live_nodes: nodes.rows.filter(n => n.is_live).length,
        total_ranges: parseInt(ranges.rows[0].total),
        version: version.rows[0].version
      },
      query_time_ms: duration
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const start = Date.now();
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const { region, warehouse, category, search } = req.query;

    let conditions = [];
    let params = [];
    let index = 1;

    if (region) {
      conditions.push(`region = $${index++}`);
      params.push(region);
    }

    if (warehouse) {
      conditions.push(`warehouse = $${index++}`);
      params.push(warehouse);
    }

    if (category) {
      conditions.push(`category ILIKE $${index++}`);
      params.push(`%${category}%`);
    }

    if (search) {
      conditions.push(`(name ILIKE $${index} OR description ILIKE $${index} OR category ILIKE $${index})`);
      params.push(`%${search}%`);
      index++;
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const count_result = await pool.query(`SELECT COUNT(*) FROM products ${where}`, params);
    const total = parseInt(count_result.rows[0].count);

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT * FROM products ${where} ORDER BY product_id LIMIT $${index++} OFFSET $${index++}`,
      params
    );

    const duration = Date.now() - start;

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_next: page < Math.ceil(total / limit),
        has_prev: page > 1
      },
      query_time_ms: duration
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const start = Date.now();
    const result = await pool.query(
      'SELECT * FROM products WHERE product_id = $1',
      [req.params.id]
    );
    const duration = Date.now() - start;

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
        product_id: req.params.id
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      query_time_ms: duration
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/products/region/:region', async (req, res) => {
  try {
    const start = Date.now();
    const result = await pool.query(
      'SELECT * FROM products WHERE region = $1 ORDER BY stock DESC',
      [req.params.region]
    );
    const duration = Date.now() - start;

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      region: req.params.region,
      query_time_ms: duration
    });
  } catch (error) {
    console.error('Error fetching products by region:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/products/warehouse/:warehouse', async (req, res) => {
  try {
    const start = Date.now();
    const result = await pool.query(
      'SELECT * FROM products WHERE warehouse = $1 ORDER BY stock DESC',
      [req.params.warehouse]
    );
    const duration = Date.now() - start;

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      warehouse: req.params.warehouse,
      query_time_ms: duration
    });
  } catch (error) {
    console.error('Error fetching products by warehouse:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const start = Date.now();
    const { product_id, name, category, warehouse, region, stock, price, description, image_url } = req.body;

    if (!product_id || !name || !price) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: product_id, name, price'
      });
    }

    const result = await pool.query(
      `INSERT INTO products (product_id, name, category, warehouse, region, stock, price, description, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [product_id, name, category || null, warehouse || null, region || null, stock || 0, price, description || null, image_url || null]
    );

    const duration = Date.now() - start;

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Product created successfully',
      query_time_ms: duration
    });
  } catch (error) {
    console.error('Error creating product:', error);
    if (error.code === '23505') {
      res.status(409).json({ success: false, error: 'Product ID already exists' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});
app.put('/api/products/:id', async (req, res) => {
  try {
    const start = Date.now();
    const { name, category, warehouse, region, stock, price, description, image_url } = req.body;
    const result = await pool.query(
      `UPDATE products
       SET name = COALESCE($1, name),
           category = COALESCE($2, category),
           warehouse = COALESCE($3, warehouse),
           region = COALESCE($4, region),
           stock = COALESCE($5, stock),
           price = COALESCE($6, price),
           description = COALESCE($7, description),
           image_url = COALESCE($8, image_url)
       WHERE product_id = $9 RETURNING *`,
      [name, category, warehouse, region, stock, price, description, image_url, req.params.id]
    );

    const duration = Date.now() - start;
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
        product_id: req.params.id
      });
    }
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Product updated successfully',
      query_time_ms: duration
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.patch('/api/products/:id/stock', async (req, res) => {
  try {
    const start = Date.now();
    const { quantity, operation } = req.body;

    if (!quantity || !operation) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: quantity, operation'
      });
    }
    let query;
    switch (operation) {
      case 'add':
        query = 'UPDATE products SET stock = stock + $1 WHERE product_id = $2 RETURNING *';
        break;
      case 'subtract':
        query = 'UPDATE products SET stock = GREATEST(stock - $1, 0) WHERE product_id = $2 RETURNING *';
        break;
      case 'set':
        query = 'UPDATE products SET stock = $1 WHERE product_id = $2 RETURNING *';
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid operation. Use: add, subtract, or set'
        });
    }
    const result = await pool.query(query, [quantity, req.params.id]);
    const duration = Date.now() - start;
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
        product_id: req.params.id
      });
    }
    res.json({
      success: true,
      data: result.rows[0],
      message: `Stock ${operation} operation completed`,
      query_time_ms: duration
    });
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.delete('/api/products/:id', async (req, res) => {
  try {
    const start = Date.now();
    const result = await pool.query(
      'DELETE FROM products WHERE product_id = $1 RETURNING *',
      [req.params.id]
    );
    const duration = Date.now() - start;
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
        product_id: req.params.id
      });
    }
    res.json({
      success: true,
      message: 'Product deleted successfully',
      deleted_product: result.rows[0],
      query_time_ms: duration
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get('/api/analytics/inventory', async (req, res) => {
  try {
    const start = Date.now();
    const result = await pool.query(`
      SELECT
        region,
        COUNT(*) as product_count,
        SUM(stock) as total_stock,
        ROUND(AVG(price)::numeric, 2) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price,
        ROUND(SUM(stock * price)::numeric, 2) as inventory_value
      FROM products
      GROUP BY region
      ORDER BY region
    `);
    const duration = Date.now() - start;
    res.json({
      success: true,
      data: result.rows,
      query_time_ms: duration
    });
  } catch (error) {
    console.error('Error fetching inventory analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get('/api/analytics/warehouse', async (req, res) => {
  try {
    const start = Date.now();
    const result = await pool.query(`
      SELECT
        warehouse,
        COUNT(*) as product_count,
        SUM(stock) as total_stock,
        ROUND(AVG(price)::numeric, 2) as avg_price,
        ROUND(SUM(stock * price)::numeric, 2) as inventory_value
      FROM products
      GROUP BY warehouse
      ORDER BY warehouse
    `);
    const duration = Date.now() - start;

    res.json({
      success: true,
      data: result.rows,
      query_time_ms: duration
    });
  } catch (error) {
    console.error('Error fetching warehouse analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get('/api/analytics/category', async (req, res) => {
  try {
    const start = Date.now();
    const result = await pool.query(`
      SELECT
        category,
        COUNT(*) as product_count,
        SUM(stock) as total_stock,
        ROUND(AVG(price)::numeric, 2) as avg_price
      FROM products
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY product_count DESC
      LIMIT 20
    `);
    const duration = Date.now() - start;
    res.json({
      success: true,
      data: result.rows,
      query_time_ms: duration
    });
  } catch (error) {
    console.error('Error fetching category analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});
const PORT = process.env.PORT || 5000;
testConnection().then(connected => {
  if (connected) {
    console.log('Database connection verified!\n');
  } else {
    console.log('Database connection failed - check your .env configuration\n');
  }
});
app.listen(PORT, () => {
  console.log('Fresh Cart API Server Started');
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`Products: http://localhost:${PORT}/api/products`);
  console.log(`Cluster: http://localhost:${PORT}/api/cluster/status`);
  console.log(`Analytics: http://localhost:${PORT}/api/analytics/inventory`);
  console.log(`Deployment: http://localhost:${PORT}/api/deployment/info`);
});
module.exports = app;