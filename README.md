🛒 Fresh Cart — Geo-Distributed Real-Time Inventory Management System
> A production-grade distributed database application built using CockroachDB Cloud, Node.js, and vanilla JavaScript — demonstrating real-world distributed systems concepts including fault tolerance, data replication, and geographic partitioning.
---
📌 Overview
Fresh Cart is a geo-distributed, real-time inventory management system for an e-commerce grocery platform. The system manages 5,045 real products across 4 geographic regions and 6 warehouses, backed by a globally distributed CockroachDB Cloud cluster deployed on AWS.
The project includes a live analytics dashboard, a RESTful backend API, a full data import pipeline, and a comprehensive test suite covering performance benchmarking and fault tolerance validation.
---
🚀 Demo
Dashboard: Open `frontend/index.html` after starting the backend server
API Base URL: `http://localhost:5000`
Video Demo: Watch on YouTube
---
🏗️ System Architecture
```
┌─────────────────────────────────────────┐
│           PRESENTATION LAYER            │
│   Dashboard │ Analytics │ Product Search │
└──────────────────┬──────────────────────┘
                   │ HTTP/REST
┌──────────────────▼──────────────────────┐
│           APPLICATION LAYER             │
│     Node.js + Express API (Port 5000)   │
│     Connection Pool (20) │ Caching      │
└──────────────────┬──────────────────────┘
                   │ PostgreSQL Wire Protocol + TLS
┌──────────────────▼──────────────────────┐
│        DATABASE LAYER — CockroachDB     │
│   AWS us-east-1 (N. Virginia) — Primary │
│   Raft Consensus │ RF=3 │ 5,045 Products│
└─────────────────────────────────────────┘
```
---
✨ Key Features
Real-Time Dashboard — Built with vanilla JavaScript; displays live cluster health, regional inventory analytics, product search and filtering, and performance metrics
Geo-Distribution — Data distributed across 4 regions (East, North, South, West) and 6 warehouses with balanced load (<10% variance)
Fault Tolerance Validation — Tested 100% query success rate across 20 consecutive queries with 0 data loss during simulated network failures
Query Optimization — Strategic indexes (`idx_region_stock`, `idx_warehouse_category`, `idx_category`) achieving 65–75% latency reduction vs full table scans
Full CRUD REST API — 7 endpoints with pagination, filtering, search, and error handling
Data Import Pipeline — Imported 5,045 products from Amazon Product Dataset 2020 with geographic enrichment (97.2% success rate)
System Testing — Validated all API endpoints, dashboard behavior, and cluster connectivity across live multi-region deployment
---
🛠️ Tech Stack
Layer	Technology	Version
Database	CockroachDB Cloud	v25.4
Backend	Node.js + Express	v24 / v5.1
DB Driver	pg (PostgreSQL)	v8.16
Frontend	HTML / CSS / JavaScript	ES6+
Cloud	AWS (us-east-1)	Serverless
---
📊 Performance Results
Metric	Target	Achieved
Read Latency	< 100ms	49ms avg
Write Latency	< 100ms	71ms avg
Throughput	> 10 QPS	14.07 QPS
Availability	99%+	100%
Data Loss	0	0
Failover Time	< 60s	< 1s
---
🗂️ Project Structure
```
fresh-cart/
├── backend/
│   ├── config/
│   │   └── db.js                # CockroachDB connection pool + SSL
│   ├── scripts/
│   │   └── import-products.js   # Data import pipeline
│   ├── test/
│   │   ├── performance-test.js  # Latency & throughput benchmarks
│   │   ├── fault-tolerance.js   # Availability & consistency testing
│   │   └── retry-logic.js       # Exponential backoff validation
│   ├── server.js                # Express REST API server
│   ├── setup.js                 # Database schema & index creation
│   └── package.json
└── frontend/
    └── index.html               # Real-time analytics dashboard
```
---
⚙️ Setup & Installation
Prerequisites
Node.js v18+
CockroachDB Cloud account (free tier at cockroachlabs.com)
1. Clone the repository
```bash
git clone https://github.com/VandhanaVemuri/fresh-cart.git
cd fresh-cart/backend
```
2. Install dependencies
```bash
npm install
```
3. Configure environment
Create a `.env` file in the `backend/` folder:
```env
PORT=5000
NODE_ENV=production
DB_HOST=your-cluster.cockroachlabs.cloud
DB_PORT=26257
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=defaultdb
DB_SSL=true
DB_SSL_CERT=C:\\Users\\YourName\\AppData\\Roaming\\postgresql\\root.crt
```
4. Download CA Certificate
Run in PowerShell:
```powershell
mkdir -p $env:appdata\postgresql; Invoke-WebRequest -Uri https://cockroachlabs.cloud/clusters/YOUR_CLUSTER_ID/cert -OutFile $env:appdata\postgresql\root.crt
```
5. Create database schema
```bash
node setup.js
```
6. Import product data
```bash
node scripts/import-products.js
```
7. Start the server
```bash
node server.js
```
8. Open the dashboard
Open `frontend/index.html` in your browser.
---
🔌 API Endpoints
Method	Endpoint	Description
GET	`/api/products`	List all products (paginated, filterable)
GET	`/api/products/:id`	Get product by ID
POST	`/api/products`	Create new product
PUT	`/api/products/:id`	Update product
DELETE	`/api/products/:id`	Delete product
GET	`/api/cluster/status`	Cluster health & node info
GET	`/api/analytics/inventory`	Regional inventory analytics
---
📦 Data Distribution
Region	Products	Stock Units
East	1,295 (25.7%)	392,232
North	1,254 (24.9%)	376,136
South	1,282 (25.4%)	385,124
West	1,214 (24.1%)	357,869
---
🎓 Context
Built for CSE 512: Distributed Database Systems at Arizona State University (Fall 2025). This project demonstrates practical implementation of distributed systems concepts including the CAP theorem, Raft consensus algorithm, geographic data partitioning, and serializable isolation — applied to a real-world e-commerce inventory use case.
---
Built with CockroachDB Cloud · Node.js · Express · JavaScript
