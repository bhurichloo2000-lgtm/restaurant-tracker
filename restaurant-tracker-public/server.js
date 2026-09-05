/**
 * RESTAURANT TRACKER - MULTI-DEVICE POS BACKEND SERVER
 * Zero-dependency, Local-Network Multi-Device Database with Real-Time Sync
 * Password Protected: YOUR_SHARED_PASSWORD
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// -------------------------------------------------------------
// 1. DATABASE MANAGEMENT
// -------------------------------------------------------------
const DEFAULT_DB = {
  settings: {
    shared_password: 'YOUR_SHARED_PASSWORD',
    restaurant_name: 'Restaurant Tracker',
    updated_at: new Date().toISOString()
  },
  orders: [],
  sessions: []
};

let db = DEFAULT_DB;

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(raw);
      // Ensure required structure
      if (!db.settings) db.settings = DEFAULT_DB.settings;
      if (!db.orders) db.orders = [];
      if (!db.sessions) db.sessions = [];
    } else {
      saveDatabaseSync();
    }
  } catch (err) {
    console.error('Error loading database, initializing default:', err);
    db = DEFAULT_DB;
    saveDatabaseSync();
  }
}

function saveDatabaseSync() {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

loadDatabase();

// -------------------------------------------------------------
// 2. REAL-TIME SERVER-SENT EVENTS (SSE) BROADCASTER
// -------------------------------------------------------------
const sseClients = new Set();

function broadcastSSE(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

// -------------------------------------------------------------
// 3. HTTP SERVER & API ROUTES
// -------------------------------------------------------------
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  // CORS Headers for multi-device support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const [reqPath, queryString] = req.url.split('?');
  const params = new URLSearchParams(queryString || '');

  // Helper to parse JSON body with strict UTF-8 support
  function parseJsonBody(callback) {
    req.setEncoding('utf8');
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) { // 1MB limit
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const json = body ? JSON.parse(body) : {};
        callback(null, json);
      } catch (err) {
        callback(err);
      }
    });
  }

  function sendJson(statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  }

  // --- API: Realtime SSE Stream ---
  if (req.method === 'GET' && reqPath === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(': connected\n\n');
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // --- API: Login ---
  if (req.method === 'POST' && reqPath === '/api/login') {
    parseJsonBody((err, payload) => {
      if (err) return sendJson(400, { success: false, error: 'ข้อมูลไม่ถูกต้อง' });

      const name = (payload.name || '').trim();
      const password = payload.password || '';

      if (!name || !password) {
        return sendJson(400, { success: false, error: 'กรุณากรอกชื่อและรหัสผ่าน' });
      }

      const expectedPassword = db.settings.shared_password;
      if (password !== expectedPassword) {
        return sendJson(401, { success: false, error: 'รหัสผ่านไม่ถูกต้อง' });
      }

      const token = 'tok_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      const session = {
        token,
        staff_name: name,
        created_at: new Date().toISOString()
      };

      db.sessions.push(session);
      saveDatabaseSync();

      return sendJson(200, {
        success: true,
        name: name,
        token: token
      });
    });
    return;
  }

  // --- API: Get Orders (Multi-device shared) ---
  if (req.method === 'GET' && reqPath === '/api/orders') {
    const filterDate = params.get('date');
    let results = db.orders;

    if (filterDate) {
      results = results.filter(o => o.date === filterDate);
    }

    return sendJson(200, {
      success: true,
      orders: results
    });
  }

  // --- API: Create Order (Multi-device broadcast) ---
  if (req.method === 'POST' && reqPath === '/api/orders') {
    parseJsonBody((err, newOrder) => {
      if (err || !newOrder || !newOrder.main_item || typeof newOrder.total !== 'number') {
        return sendJson(400, { success: false, error: 'ข้อมูลออเดอร์ไม่สมบูรณ์' });
      }

      // Ensure consistent fields
      const order = {
        id: newOrder.id || 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        staff_name: newOrder.staff_name || 'Staff',
        main_item: newOrder.main_item,
        main_price: newOrder.main_price || 30,
        addons: Array.isArray(newOrder.addons) ? newOrder.addons : [],
        total: newOrder.total,
        date: newOrder.date || new Date().toISOString().split('T')[0],
        ordered_at: newOrder.ordered_at || new Date().toISOString()
      };

      // Add to database
      db.orders.unshift(order);
      saveDatabaseSync();

      // Broadcast immediately to all connected devices (phones, iPads, desktops)
      broadcastSSE({
        type: 'ORDER_CREATED',
        order: order
      });

      return sendJson(200, {
        success: true,
        order: order
      });
    });
    return;
  }

  // --- API: Change Shared Password ---
  if (req.method === 'POST' && reqPath === '/api/change-password') {
    parseJsonBody((err, payload) => {
      if (err) return sendJson(400, { success: false, error: 'ข้อมูลไม่ถูกต้อง' });

      const { currentPassword, newPassword } = payload;
      if (!newPassword || newPassword.trim().length === 0) {
        return sendJson(400, { success: false, error: 'รหัสผ่านใหม่ต้องไม่ว่างเปล่า' });
      }

      if (currentPassword !== db.settings.shared_password) {
        return sendJson(401, { success: false, error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
      }

      db.settings.shared_password = newPassword.trim();
      db.settings.updated_at = new Date().toISOString();
      saveDatabaseSync();

      return sendJson(200, { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
    });
    return;
  }

  // --- Static Files Handler ---
  let filePath = reqPath === '/' ? '/index.html' : reqPath;
  const fullPath = path.join(__dirname, filePath);
  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 ไม่พบหน้าที่ค้นหา');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

// Helper to get Local Wi-Fi IPv4 address
function getLocalNetworkIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalNetworkIp();
  console.log('========================================================');
  console.log('🍽️  RESTAURANT TRACKER - MULTI-DEVICE SERVER IS LIVE!');
  console.log('========================================================');
  console.log(`💻 บนคอมพิวเตอร์นี้:        http://localhost:${PORT}`);
  console.log(`📱 บนมือถือ / iPad (Wi-Fi): http://${localIp}:${PORT}`);
  console.log(`🔑 รหัสผ่านพนักงาน:         ${db.settings.shared_password}`);
  console.log('========================================================');
  console.log('⚡ รองรับ Multi-Device ซิงก์ออเดอร์และรายได้แบบเรียลไทม์');
  console.log('💾 บันทึกข้อมูลลงฐานข้อมูลส่วนกลาง (data/database.json)');
  console.log('========================================================');
});
