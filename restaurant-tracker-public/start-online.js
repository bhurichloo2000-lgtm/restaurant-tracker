/**
 * RESTAURANT TRACKER - ONLINE LAUNCHER
 * Automatically starts the local POS server and creates a secure public HTTPS link
 * Accessible from ANY internet connection (4G/5G, different Wi-Fi, anywhere in the world)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const CLOUDFLARED_PATH = path.join(__dirname, 'bin', 'cloudflared.exe');

console.log('========================================================');
console.log('🚀 กำลังเริ่มระบบ Restaurant Tracker (โหมดออนไลน์สาธารณะ)...');
console.log('========================================================');

// 1. Start Local Server
require('./server.js');

// 2. Start Cloudflare Tunnel
if (!fs.existsSync(CLOUDFLARED_PATH)) {
  console.error('❌ ไม่พบไฟล์ cloudflared.exe ที่:', CLOUDFLARED_PATH);
  process.exit(1);
}

const tunnel = spawn(CLOUDFLARED_PATH, ['tunnel', '--url', 'http://localhost:3000'], {
  stdio: ['ignore', 'pipe', 'pipe']
});

let publicUrlFound = false;

function processOutput(data) {
  const text = data.toString();
  
  // Extract https://*.trycloudflare.com
  const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match && !publicUrlFound) {
    publicUrlFound = true;
    const url = match[0];

    console.log('\n========================================================');
    console.log('🎉 ระบบออนไลน์พร้อมใช้งานแล้ว! (เข้าได้จากเน็ตมือถือ 4G/5G ทุกที่)');
    console.log('========================================================');
    console.log(`\n📱 ลิงก์สำหรับโทรศัพท์ / iPad / ทุกอุปกรณ์:`);
    console.log(`👉  ${url}`);
    console.log(`\n💻 ใช้งานบนคอมพิวเตอร์เครื่องนี้:`);
    console.log(`👉  http://localhost:3000`);
    console.log(`\n🔑 รหัสผ่านร้าน: YOUR_SHARED_PASSWORD`);
    console.log('========================================================');
    console.log('💡 ส่งลิงก์ด้านบนให้พนักงานเปิดบนมือถือจากที่ไหนก็ได้ทันที!');
    console.log('⚠️  เปิดหน้าต่างนี้ทิ้งไว้ขณะเปิดใช้งานร้าน');
    console.log('========================================================\n');
  }
}

tunnel.stderr.on('data', processOutput);
tunnel.stdout.on('data', processOutput);

tunnel.on('close', (code) => {
  console.log('Cloudflare tunnel process exited with code:', code);
});

process.on('SIGINT', () => {
  tunnel.kill();
  process.exit();
});
