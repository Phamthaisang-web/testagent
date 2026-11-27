const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 8080;
const APP_VERSION = process.env.APP_VERSION || 'v1.0.0-stable';

// -------------------------------------------------------------
// Deployment Fault Simulation Flags
// -------------------------------------------------------------
let is5xxRegressionActive = process.env.SIMULATE_5XX_REGRESSION === 'true';
let isFatalCrashActive = process.env.SIMULATE_FATAL_CRASH === 'true';
let isLivenessFailing = process.env.SIMULATE_LIVENESS_FAIL === 'true';
let isDiskFullActive = false;
let simulatedDiskPercent = 12.0;

if (isFatalCrashActive) {
  console.error(`💥 [FATAL CRASH SIMULATED] Deployment started with SIMULATE_FATAL_CRASH=true! Version: ${APP_VERSION}`);
  console.error(`💥 [FATAL CRASH EXIT] Exiting process with code 1 in 1200ms to trigger Kubernetes CrashLoopBackOff...`);
  setTimeout(() => {
    process.exit(1);
  }, 1200);
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// Live Request Metrics Tracking (5-second Rolling Window)
// -------------------------------------------------------------
let leakedMemoryBuffers = [];
const recentRequests = [];
const PRUNE_WINDOW_MS = 10000;
let concurrentActiveRequests = 0;

function recordRequest(statusCode, durationMs) {
  const now = Date.now();
  recentRequests.push({ timestamp: now, statusCode, durationMs });
  const cutoff = now - PRUNE_WINDOW_MS;
  while (recentRequests.length > 0 && recentRequests[0].timestamp < cutoff) {
    recentRequests.shift();
  }
}

function getMetrics() {
  const now = Date.now();
  const window5s = now - 5000;
  const inWindow = recentRequests.filter((r) => r.timestamp >= window5s);
  const total = inWindow.length;
  const errors5xx = inWindow.filter((r) => r.statusCode >= 500 && r.statusCode < 600).length;
  const rps = Math.round((total / 5.0) * 100) / 100;
  const http5xxRate = total > 0 ? Math.round((errors5xx / total) * 10000) / 100 : 0.0;
  const avgLatency =
    total > 0
      ? Math.round(inWindow.reduce((acc, cur) => acc + (cur.durationMs || 0), 0) / total)
      : 0;
  const mem = process.memoryUsage();
  const leakedMb = Math.round(leakedMemoryBuffers.reduce((a, b) => a + b.length, 0) / 1024 / 1024);
  const isUnderAttack = rps >= 30 || http5xxRate >= 10 || avgLatency >= 400 || leakedMb > 100;

  return {
    rps,
    request_rate: rps,
    requestsInWindow: total,
    requestsLast5s: total,
    http5xxRate,
    http_5xx_rate: http5xxRate,
    avgLatencyMs: avgLatency,
    latency: avgLatency,
    errors5xxLast5s: errors5xx,
    concurrentActive: concurrentActiveRequests,
    memoryMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
    leakedMemoryMb: leakedMb,
    isUnderAttack,
    uptimeSeconds: Math.round(process.uptime()),
    hostname: os.hostname(),
    version: APP_VERSION,
    is5xxRegressionActive,
    isFatalCrashActive,
    isLivenessFailing,
    isDiskFullActive,
    simulatedDiskPercent,
    diskPercent: simulatedDiskPercent,
  };
}

// Global traffic logging & concurrency limiting middleware
app.use((req, res, next) => {
  // Always allow health checks to pass through unhindered
  if (req.path === '/health' || req.path === '/api/health') {
    return next();
  }

  concurrentActiveRequests++;
  const start = Date.now();
  let decremented = false;
  const decrement = () => {
    if (!decremented) {
      decremented = true;
      concurrentActiveRequests = Math.max(0, concurrentActiveRequests - 1);
    }
  };

  // If 5xx regression is simulated, intercept business API calls with HTTP 500
  if (
    is5xxRegressionActive &&
    req.path.startsWith('/api') &&
    !req.path.startsWith('/api/chaos') &&
    !req.path.startsWith('/api/metrics') &&
    !req.path.startsWith('/api/db') &&
    !req.path.startsWith('/api/health')
  ) {
    decrement();
    const duration = 20;
    recordRequest(500, duration);
    console.error(`[HTTP 500 REGRESSION] ${req.method} ${req.url} 500 ${duration}ms - Deployment Version ${APP_VERSION} Faulty Exception`);
    return res.status(500).json({
      success: false,
      error: 'DEPLOYMENT_5XX_REGRESSION',
      message: `Critical runtime exception in deployment version ${APP_VERSION}: NullPointerException in business logic handler!`,
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
    });
  }

  if (concurrentActiveRequests > 2500 && Math.random() < 0.65) {
    decrement();
    recordRequest(503, Date.now() - start);
    console.warn(`[HTTP 503] ${req.method} ${req.url} 503 ${Date.now() - start}ms - Service Unavailable`);
    return res.status(503).json({
      success: false,
      error: 'Service Unavailable',
      message: 'Hệ thống đang quá tải hàng đợi (Server Busy / High Concurrency). Vui lòng thử lại sau giây lát!',
      activeConnections: concurrentActiveRequests,
    });
  }

  res.on('finish', () => {
    decrement();
    const duration = Date.now() - start;
    recordRequest(res.statusCode, duration);
    if (res.statusCode >= 500) {
      console.error(`[HTTP ${res.statusCode}] ${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
    } else if (duration > 500 || req.url.includes('/api/')) {
      console.log(`[HTTP ${res.statusCode}] ${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
    }
  });

  res.on('close', () => {
    decrement();
  });

  next();
});

// -------------------------------------------------------------
// Seed Data for Enterprise Store Products
// -------------------------------------------------------------
const INITIAL_PRODUCTS = [
  {
    id: 'prod-001',
    name: 'Máy Chủ Dell PowerEdge R750 Enterprise',
    category: 'Hardware',
    price: 89500000,
    stock: 14,
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=500&auto=format&fit=crop&q=80',
    description: 'Server 2U rack 2-socket Intel Xeon Silver 4314, 64GB RAM DDR4 ECC, 2x 960GB SSD Enterprise.',
  },
  {
    id: 'prod-002',
    name: 'Laptop Doanh Nghiệp Lenovo ThinkPad X1 Carbon Gen 11',
    category: 'Laptops',
    price: 46800000,
    stock: 28,
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=500&auto=format&fit=crop&q=80',
    description: 'Core i7-1365U vPro, 32GB LPDDR5, 1TB SSD NVMe, Màn hình 2.8K OLED 100% DCI-P3, Trọng lượng 1.12kg.',
  },
  {
    id: 'prod-003',
    name: 'Cụm Tăng Tốc Trí Tuệ Nhân Tạo NVIDIA A100 80GB PCIe',
    category: 'AI Acceleration',
    price: 320000000,
    stock: 5,
    rating: 5.0,
    image: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=500&auto=format&fit=crop&q=80',
    description: 'GPU chuyên dụng huấn luyện AI & Deep Learning GRU/LSTM/Transformer, băng thông bộ nhớ 2.0 TB/s.',
  },
  {
    id: 'prod-004',
    name: 'Switch Mạng Cisco Catalyst 9300 48-Port PoE+',
    category: 'Networking',
    price: 58000000,
    stock: 19,
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=500&auto=format&fit=crop&q=80',
    description: 'Thiết bị chuyển mạch mạng doanh nghiệp 48 cổng Gigabit PoE+, Uplink 10G SFP+, hỗ trợ StackWise-480.',
  },
  {
    id: 'prod-005',
    name: 'Gói Bản Quyền Cloud Kubernetes Self-Healing Pro (1 Năm)',
    category: 'Software & Cloud',
    price: 24000000,
    stock: 999,
    rating: 4.95,
    image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop&q=80',
    description: 'Bản quyền giám sát tự phục hồi hạ tầng K8s, dự báo đa rủi ro GRU, can thiệp Zero-Downtime.',
  },
  {
    id: 'prod-006',
    name: 'Màn Hình Đồ Họa Chuyên Nghiệp Dell UltraSharp U3224KB 6K',
    category: 'Hardware',
    price: 68500000,
    stock: 12,
    rating: 4.85,
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&auto=format&fit=crop&q=80',
    description: 'Màn hình 31.5 inch độ phân giải 6K IPS Black, tích hợp 4K HDR Webcam, Thunderbolt 4 140W.',
  },
  {
    id: 'prod-007',
    name: 'Bàn Phím Cơ Không Dây Doanh Nghiệp Keychron Q1 Pro',
    category: 'Accessories',
    price: 4950000,
    stock: 45,
    rating: 4.75,
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=80',
    description: 'Thân nhôm CNC nguyên khối, Switch Gateron Jupiter, kết nối 3 thiết bị Bluetooth, Keycaps PBT Double-shot.',
  },
  {
    id: 'prod-008',
    name: 'Ổ Cứng Di Động Chống Sốc SanDisk Extreme PRO 4TB NVMe',
    category: 'Accessories',
    price: 9200000,
    stock: 35,
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=500&auto=format&fit=crop&q=80',
    description: 'Tốc độ đọc/ghi 2000MB/s chuẩn USB 3.2 Gen 2x2, chuẩn chống nước chống bụi IP55, vỏ nhôm tản nhiệt.',
  },
];

let inMemoryProducts = [...INITIAL_PRODUCTS];
let inMemoryOrders = [];

// -------------------------------------------------------------
// DUAL DATABASE ARCHITECTURE: Master (ecommerce_master_db) & Replace (ecommerce_replace_db)
// -------------------------------------------------------------
const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb://mongodb-0.mongodb-service.test-lab.svc.cluster.local:27017/ecommerce_master_db?directConnection=true&serverSelectionTimeoutMS=5000';

let mongoClient = null;
let dbMaster = null;    // Database 1: ecommerce_master_db
let dbReplace = null;   // Database 2: ecommerce_replace_db
let isMasterTurnedOff = false; // Flag to simulate Master shutdown / switch to Replace

const dbClusterState = {
  connected: false,
  mode: 'DUAL_DATABASE_ACTIVE_REPLACE',
  masterDatabase: 'ecommerce_master_db',
  replaceDatabase: 'ecommerce_replace_db',
  activeDatabase: 'ecommerce_master_db',
  isMasterOnline: true,
  currentPrimaryHost: null,
  secondaries: [],
  syncStatus: 'SYNCHRONIZED_REALTIME',
  failoverCount: 0,
  lastFailoverTime: null,
  failoverHistory: [],
  lastError: null,
};

async function initMongoDB() {
  console.log(`[MongoDB] Connecting with Dual-Database Architecture...`);
  try {
    mongoClient = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      retryWrites: true,
    });

    await mongoClient.connect();
    
    // Connect to BOTH separate databases!
    dbMaster = mongoClient.db('ecommerce_master_db');
    dbReplace = mongoClient.db('ecommerce_replace_db');
    
    dbClusterState.connected = true;
    dbClusterState.syncStatus = 'SYNCHRONIZED_REALTIME';
    console.log('[MongoDB] Connected successfully to both ecommerce_master_db and ecommerce_replace_db!');

    // Seed Master if empty
    const countM = await dbMaster.collection('products').countDocuments();
    if (countM === 0) {
      console.log('[MongoDB] Seeding products into ecommerce_master_db...');
      await dbMaster.collection('products').insertMany(INITIAL_PRODUCTS);
    }

    // Seed Replace if empty
    const countR = await dbReplace.collection('products').countDocuments();
    if (countR === 0) {
      console.log('[MongoDB] Seeding products into ecommerce_replace_db...');
      await dbReplace.collection('products').insertMany(INITIAL_PRODUCTS);
    }

    // Sync any existing orders
    syncDataBetweenDatabases();

    pollClusterTopology();
    setInterval(pollClusterTopology, 5000);
    setInterval(syncDataBetweenDatabases, 10000); // Tự động đồng bộ 2 chiều nhẹ nhàng mỗi 10 giây
  } catch (err) {
    dbClusterState.connected = false;
    dbClusterState.lastError = err.message;
    console.log(`[MongoDB] Initializing database connection: ${err.message}`);
    setTimeout(initMongoDB, 5000);
  }
}

let isSyncingOrders = false;
async function syncDataBetweenDatabases() {
  if (isSyncingOrders) return;
  if (!dbMaster || !dbReplace) return;
  isSyncingOrders = true;
  try {
    // Chỉ so sánh 50 đơn hàng mới nhất thay vì quét cạn hàng chục nghìn đơn hàng trong DB
    const ordersM = await dbMaster.collection('orders').find().sort({ _id: -1 }).limit(50).toArray();
    const ordersR = await dbReplace.collection('orders').find().sort({ _id: -1 }).limit(50).toArray();

    const idsInR = new Set(ordersR.map((o) => o.orderId));
    const missingInR = ordersM.filter((o) => !idsInR.has(o.orderId));
    if (missingInR.length > 0) {
      console.log(`[Auto-Sync] Copying ${missingInR.length} orders from Master -> Replace...`);
      await dbReplace.collection('orders').insertMany(missingInR);
    }

    const idsInM = new Set(ordersM.map((o) => o.orderId));
    const missingInM = ordersR.filter((o) => !idsInM.has(o.orderId));
    if (missingInM.length > 0) {
      console.log(`[Auto-Sync] Copying ${missingInM.length} orders from Replace -> Master...`);
      await dbMaster.collection('orders').insertMany(missingInM);
    }
  } catch (e) {
    console.warn('[Auto-Sync Error]', e.message);
  } finally {
    isSyncingOrders = false;
  }
}

async function pollClusterTopology() {
  if (!mongoClient) return;
  try {
    const adminDb = mongoClient.db('admin');
    const isMasterDoc = await adminDb.command({ isMaster: 1 });

    dbClusterState.currentPrimaryHost = isMasterDoc.primary || (isMasterDoc.ismaster ? isMasterDoc.me : null);
    dbClusterState.secondaries = (isMasterDoc.hosts || []).filter((h) => h !== dbClusterState.currentPrimaryHost);
    dbClusterState.activeDatabase = isMasterTurnedOff ? 'ecommerce_replace_db' : 'ecommerce_master_db';
    dbClusterState.isMasterOnline = !isMasterTurnedOff;
    dbClusterState.connected = true;
    dbClusterState.lastError = null;
  } catch (err) {
    dbClusterState.connected = false;
    dbClusterState.lastError = err.message;
  }
}

initMongoDB();

// -------------------------------------------------------------
// Storefront REST APIs (Dual Database Master / Replace Aware)
// -------------------------------------------------------------

// 1. Health check for Kubernetes Probes
app.get(['/health', '/api/health'], (req, res) => {
  if (isLivenessFailing) {
    return res.status(500).json({
      status: 'DOWN',
      error: 'LIVENESS_PROBE_FAILED',
      message: `Deployment ${APP_VERSION} simulated liveness probe failure`,
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
    });
  }
  const m = getMetrics();
  res.status(200).json({
    status: 'UP',
    version: APP_VERSION,
    service: 'novatech-ecommerce-store',
    timestamp: new Date().toISOString(),
    databases: {
      master: 'ecommerce_master_db',
      replace: 'ecommerce_replace_db',
      activeDatabase: dbClusterState.activeDatabase,
      isMasterOnline: !isMasterTurnedOff,
    },
    metrics: m,
  });
});

// 2. Database Replica Set Live Status & Topology
app.get('/api/db/status', async (req, res) => {
  let masterOrders = 0;
  let replaceOrders = 0;
  let totalProducts = 0;

  if (dbMaster && dbReplace && dbClusterState.connected) {
    try {
      masterOrders = await dbMaster.collection('orders').countDocuments();
      replaceOrders = await dbReplace.collection('orders').countDocuments();
      totalProducts = await (isMasterTurnedOff ? dbReplace : dbMaster).collection('products').countDocuments();
    } catch (e) {}
  }

  res.status(200).json({
    success: true,
    cluster: {
      ...dbClusterState,
      masterOrders,
      replaceOrders,
      totalOrders: isMasterTurnedOff ? replaceOrders : masterOrders,
      totalProducts: totalProducts || 16,
      activeDatabase: isMasterTurnedOff ? 'ecommerce_replace_db' : 'ecommerce_master_db',
      isMasterOnline: !isMasterTurnedOff,
      description: isMasterTurnedOff
        ? '⚠️ Master (ecommerce_master_db) đang TẮT. Đang dùng REPLACE (ecommerce_replace_db) để phục vụ đơn hàng!'
        : '🟢 Master (ecommerce_master_db) đang HOẠT ĐỘNG. Dữ liệu đồng bộ song song với Replace (ecommerce_replace_db).',
    },
  });
});

// 3. Telemetry & Metrics endpoint
app.get('/api/metrics', async (req, res) => {
  let ordersCount = 0;
  if (dbMaster && dbReplace) {
    try {
      ordersCount = await (isMasterTurnedOff ? dbReplace : dbMaster).collection('orders').countDocuments();
    } catch (e) {}
  }

  res.status(200).json({
    success: true,
    metrics: getMetrics(),
    database: dbClusterState,
    totalOrders: ordersCount,
    totalProducts: 16,
  });
});

// 4. Get all products (Reads from Active Database: Master or Replace)
app.get('/api/products', async (req, res) => {
  const { category, search } = req.query;
  const activeDb = isMasterTurnedOff ? dbReplace : dbMaster;

  try {
    let prods = [];
    if (activeDb && dbClusterState.connected) {
      const query = {};
      if (category && category !== 'ALL') {
        query.category = { $regex: new RegExp(`^${category}$`, 'i') };
      }
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }
      prods = await activeDb.collection('products').find(query).toArray();
    } else {
      prods = [...inMemoryProducts];
    }

    res.status(200).json({
      success: true,
      source: isMasterTurnedOff ? 'ecommerce_replace_db (REPLACE)' : 'ecommerce_master_db (MASTER)',
      activeDatabase: isMasterTurnedOff ? 'ecommerce_replace_db' : 'ecommerce_master_db',
      total: prods.length,
      data: prods,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'DB_QUERY_FAILED', message: err.message });
  }
});

// Heavy Query CPU Burner
app.get('/api/search/heavy', (req, res) => {
  const complexity = Math.min(Math.max(parseInt(req.query.complexity, 10) || 150000, 10000), 1000000);
  const q = req.query.q || 'server';
  const start = Date.now();
  let dummy = 0;
  for (let i = 2; i < complexity; i++) {
    dummy += Math.sqrt(i) * Math.sin(i);
  }
  const durationMs = Date.now() - start;
  const filtered = inMemoryProducts.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  res.status(200).json({
    success: true,
    action: 'HEAVY_CPU_SEARCH',
    query: q,
    complexity,
    computedHash: Math.floor(dummy % 100000),
    durationMs,
    resultsCount: filtered.length,
    results: filtered,
  });
});

// 5. Checkout API (Writes to Active DB + Auto-Syncs to Secondary DB)
app.post('/api/cart/checkout', async (req, res) => {
  if (
    req.query.fault === 'internal_error' ||
    req.body?.trigger500 ||
    (Array.isArray(req.body?.items) && req.body.items.some((i) => i.productId === 'crash_system'))
  ) {
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_CHAOS_EXCEPTION',
      message: 'Fault injection triggered: Simulated server failure during checkout',
    });
  }

  const { customerName, customerEmail, customerPhone, items, paymentMethod } = req.body || {};

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Giỏ hàng trống!' });
  }

  await new Promise((resolve) => setTimeout(resolve, 50));

  let orderTotal = 0;
  const processedItems = [];
  const primaryDb = isMasterTurnedOff ? dbReplace : dbMaster;
  const backupDb = isMasterTurnedOff ? null : dbReplace; // If master is online, sync to replace

  try {
    for (const item of items) {
      let prod = null;
      if (primaryDb && dbClusterState.connected) {
        prod = await primaryDb.collection('products').findOne({ id: item.productId });
      } else {
        prod = inMemoryProducts.find((p) => p.id === item.productId);
      }

      if (!prod) {
        return res.status(404).json({ success: false, error: `Sản phẩm #${item.productId} không tồn tại!` });
      }

      const qty = parseInt(item.quantity, 10) || 1;
      if (prod.stock < qty && prod.stock > 0) {
        return res.status(409).json({ success: false, error: 'Hết hàng tồn kho!' });
      }

      // Decrement stock in active DB
      if (primaryDb && dbClusterState.connected && prod.stock > 0 && prod.stock !== 999) {
        await primaryDb.collection('products').updateOne({ id: item.productId }, { $inc: { stock: -qty } });
        if (backupDb) {
          await backupDb.collection('products').updateOne({ id: item.productId }, { $inc: { stock: -qty } }).catch(() => {});
        }
      }

      orderTotal += prod.price * qty;
      processedItems.push({
        productId: prod.id,
        name: prod.name,
        price: prod.price,
        quantity: qty,
        subtotal: prod.price * qty,
      });
    }

    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const newOrder = {
      orderId,
      customerName: customerName || 'Doanh Nghiệp Mẫu',
      customerEmail: customerEmail || 'contact@enterprise.vn',
      customerPhone: customerPhone || '0901234567',
      paymentMethod: paymentMethod || 'BANK_TRANSFER',
      items: processedItems,
      totalAmount: orderTotal,
      status: 'PAID',
      createdAt: new Date().toISOString(),
      savedToDatabase: isMasterTurnedOff ? 'ecommerce_replace_db (REPLACE)' : 'ecommerce_master_db (MASTER)',
    };

    if (primaryDb && dbClusterState.connected) {
      primaryDb.collection('orders').insertOne({ ...newOrder }).catch(() => {});
      // Real-time synchronization to Replace Database!
      if (backupDb) {
        backupDb.collection('orders').insertOne({ ...newOrder }).catch(() => {});
      }
    } else {
      inMemoryOrders.unshift(newOrder);
      if (inMemoryOrders.length > 200) {
        inMemoryOrders.length = 200;
      }
    }

    return res.status(201).json({
      success: true,
      message: isMasterTurnedOff
        ? 'Đơn hàng đã ghi trực tiếp vào Database Replace (ecommerce_replace_db) vì Master đang tắt!'
        : 'Đơn hàng đã ghi vào Database Master (ecommerce_master_db) và TỰ ĐỘNG ĐỒNG BỘ sang Database Replace (ecommerce_replace_db)!',
      order: newOrder,
      activeDatabase: isMasterTurnedOff ? 'ecommerce_replace_db' : 'ecommerce_master_db',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Get Recent Orders
app.get('/api/orders', async (req, res) => {
  const activeDb = isMasterTurnedOff ? dbReplace : dbMaster;
  try {
    let orderList = [];
    if (activeDb && dbClusterState.connected) {
      orderList = await activeDb.collection('orders').find().sort({ _id: -1 }).limit(20).toArray();
    } else {
      orderList = inMemoryOrders.slice(0, 20);
    }

    res.status(200).json({
      success: true,
      database: isMasterTurnedOff ? 'ecommerce_replace_db' : 'ecommerce_master_db',
      total: orderList.length,
      orders: orderList,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// Chaos & Failover Simulation Endpoints: Toggle Master / Replace
// -------------------------------------------------------------
app.post('/api/chaos/stepdown-master', async (req, res) => {
  // Toggle Master on/off
  isMasterTurnedOff = !isMasterTurnedOff;

  if (isMasterTurnedOff) {
    dbClusterState.failoverCount++;
    dbClusterState.lastFailoverTime = new Date().toISOString();
    const event = {
      timestamp: dbClusterState.lastFailoverTime,
      from: 'ecommerce_master_db (MASTER)',
      to: 'ecommerce_replace_db (REPLACE)',
      action: 'FAILOVER_TO_REPLACE_DATABASE',
      reason: 'Người dùng phát lệnh TẮT Master. Hệ thống tự động chuyển toàn bộ luồng sang Database Replace.',
    };
    dbClusterState.failoverHistory.unshift(event);

    console.warn(`\n[FAILOVER TRIGGERED] MASTER TẮT! Web chuyển sang dùng ecommerce_replace_db!\n`);

    return res.status(200).json({
      success: true,
      isMasterOnline: false,
      activeDatabase: 'ecommerce_replace_db',
      message: '💥 Đã TẮT Database Master (ecommerce_master_db)! Website đã tự động chuyển sang sử dụng Database Replace (ecommerce_replace_db) thành công!',
    });
  } else {
    // Turning Master back on -> sync data
    await syncDataBetweenDatabases();
    console.log(`\n[MASTER RESTORED] Master bật lại! Đã đồng bộ ngược dữ liệu từ Replace về Master!\n`);

    return res.status(200).json({
      success: true,
      isMasterOnline: true,
      activeDatabase: 'ecommerce_master_db',
      message: '🔄 Đã BẬT lại Database Master (ecommerce_master_db)! Đã đồng bộ toàn bộ đơn hàng mới từ Replace về Master thành công!',
    });
  }
});

// Standard Chaos Faults
app.all('/api/chaos/leak-memory', (req, res) => {
  const sizeMb = Math.min(Math.max(parseInt(req.body?.sizeMb || req.query?.sizeMb || 25, 10), 1), 200);
  try {
    const buf = Buffer.alloc(sizeMb * 1024 * 1024, 0xaa);
    leakedMemoryBuffers.push(buf);
    const totalLeakedMb = Math.round(leakedMemoryBuffers.reduce((a, b) => a + b.length, 0) / 1024 / 1024);
    res.status(200).json({ success: true, action: 'LEAK_MEMORY', addedMb: sizeMb, totalLeakedMb });
  } catch (err) {
    res.status(500).json({ success: false, error: 'OOM_ALLOCATION_FAILED', message: err.message });
  }
});

app.all('/api/chaos/release-memory', (req, res) => {
  const beforeMb = Math.round(leakedMemoryBuffers.reduce((a, b) => a + b.length, 0) / 1024 / 1024);
  leakedMemoryBuffers = [];
  if (global.gc) {
    try { global.gc(); } catch (e) {}
  }
  res.status(200).json({ success: true, action: 'RELEASE_MEMORY', releasedMb: beforeMb, currentLeakedMb: 0 });
});

app.all('/api/chaos/latency', async (req, res) => {
  const delayMs = Math.min(Math.max(parseInt(req.query.delay || req.body?.delay || 1000, 10), 10), 15000);
  await new Promise((r) => setTimeout(r, delayMs));
  res.status(200).json({ success: true, action: 'LATENCY_INJECT', delayMs });
});

app.all('/api/chaos/error', (req, res) => {
  if (req.query.crash === 'true' || req.body?.crash === true) {
    console.error('💥 [POD_CRASH_PANIC] Process exit requested via /api/chaos/error?crash=true');
    setTimeout(() => process.exit(1), 100);
    return res.status(200).json({ success: true, message: 'Container exiting with ExitCode 1 in 100ms...' });
  }
  res.status(500).json({ success: false, action: 'ERROR_INJECT', message: 'Simulated 500 Internal Server Error' });
});

// Deployment & Chaos Toggle APIs
app.post('/api/chaos/set-regression', (req, res) => {
  const enabled = req.body?.enabled !== undefined ? !!req.body.enabled : !is5xxRegressionActive;
  is5xxRegressionActive = enabled;
  console.log(`[CHAOS CONFIG] SIMULATE_5XX_REGRESSION set to: ${is5xxRegressionActive}`);
  res.status(200).json({
    success: true,
    is5xxRegressionActive,
    version: APP_VERSION,
    message: is5xxRegressionActive
      ? 'Đã kích hoạt giả lập 5XX Regression! Toàn bộ API nghiệp vụ sẽ trả về HTTP 500.'
      : 'Đã tắt giả lập 5XX Regression. API hoạt động bình thường.',
  });
});

app.post('/api/chaos/set-liveness-fail', (req, res) => {
  const enabled = req.body?.enabled !== undefined ? !!req.body.enabled : !isLivenessFailing;
  isLivenessFailing = enabled;
  console.log(`[CHAOS CONFIG] SIMULATE_LIVENESS_FAIL set to: ${isLivenessFailing}`);
  res.status(200).json({
    success: true,
    isLivenessFailing,
    version: APP_VERSION,
    message: isLivenessFailing
      ? 'Đã kích hoạt lỗi Liveness Probe! /health sẽ trả về HTTP 500 khiến K8s restart container.'
      : 'Đã khôi phục Liveness Probe.',
  });
});

app.all('/api/chaos/fill-disk', (req, res) => {
  const targetPct = parseFloat(req.body?.diskPercent || req.query?.diskPercent || 88.5);
  isDiskFullActive = true;
  simulatedDiskPercent = targetPct;
  try {
    const fs = require('fs');
    fs.writeFileSync('/tmp/temp_junk_cache_1.tmp', Buffer.alloc(1024 * 1024 * 5, 0xbb));
    fs.writeFileSync('/tmp/temp_junk_cache_2.tmp', Buffer.alloc(1024 * 1024 * 5, 0xcc));
  } catch (e) {}
  console.log(`[CHAOS CONFIG] DISK PRESSURE SIMULATED: ${simulatedDiskPercent}%`);
  res.status(200).json({
    success: true,
    action: 'FILL_DISK',
    isDiskFullActive,
    simulatedDiskPercent,
    message: `Đã kích hoạt giả lập ổ đĩa đầy ${simulatedDiskPercent}% và tạo file rác trong /tmp.`,
  });
});

app.all('/api/chaos/reset-disk', (req, res) => {
  isDiskFullActive = false;
  simulatedDiskPercent = 12.0;
  try {
    const fs = require('fs');
    if (fs.existsSync('/tmp/temp_junk_cache_1.tmp')) fs.unlinkSync('/tmp/temp_junk_cache_1.tmp');
    if (fs.existsSync('/tmp/temp_junk_cache_2.tmp')) fs.unlinkSync('/tmp/temp_junk_cache_2.tmp');
  } catch (e) {}
  console.log(`[CHAOS CONFIG] DISK CLEANED: ${simulatedDiskPercent}%`);
  res.status(200).json({
    success: true,
    action: 'CLEANUP_DISK',
    isDiskFullActive,
    simulatedDiskPercent,
    message: 'Đã dọn dẹp file rác trong /tmp và phục hồi dung lượng ổ đĩa.',
  });
});

app.post('/api/chaos/reset-all', async (req, res) => {
  is5xxRegressionActive = false;
  isLivenessFailing = false;
  isDiskFullActive = false;
  simulatedDiskPercent = 12.0;
  leakedMemoryBuffers = [];
  recentRequests = [];
  try {
    const fs = require('fs');
    if (fs.existsSync('/tmp/temp_junk_cache_1.tmp')) fs.unlinkSync('/tmp/temp_junk_cache_1.tmp');
    if (fs.existsSync('/tmp/temp_junk_cache_2.tmp')) fs.unlinkSync('/tmp/temp_junk_cache_2.tmp');
  } catch (e) {}
  try {
    if (dbMaster) await dbMaster.collection('orders').deleteMany({});
    if (dbReplace) await dbReplace.collection('orders').deleteMany({});
    console.log('[CHAOS CONFIG] All chaos simulations & orders reset!');
  } catch (e) {
    console.warn('[CHAOS CONFIG] Error clearing orders:', e.message);
  }
  res.status(200).json({
    success: true,
    is5xxRegressionActive,
    isLivenessFailing,
    version: APP_VERSION,
    message: 'Đã reset toàn bộ cờ lỗi và dọn sạch dữ liệu đơn hàng rác.',
  });
});

// Prometheus Metrics Exporter
app.get('/metrics', (req, res) => {
  const m = getMetrics();
  const lines = [
    `ecommerce_requests_per_second ${m.rps}`,
    `ecommerce_active_connections ${m.concurrentActive}`,
    `ecommerce_master_online ${isMasterTurnedOff ? 0 : 1}`,
  ];
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(lines.join('\n') + '\n');
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`================================================================`);
  console.log(`  NOVATECH E-COMMERCE ONLINE WITH DUAL-DATABASE SETUP ON ${PORT} `);
  console.log(`  DB 1 (Master):  ecommerce_master_db                             `);
  console.log(`  DB 2 (Replace): ecommerce_replace_db                            `);
  console.log(`================================================================`);
});
