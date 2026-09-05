# 🥢 Restaurant Tracker (ระบบบันทึกออเดอร์ร้านอาหาร POS)

ระบบ POS บันทึกออเดอร์ร้านอาหารและคำนวณรายได้รวมแบบเรียลไทม์ ใช้งานง่าย รวดเร็ว รองรับมือถือ (**Mobile-First**), แท็บเล็ต (**iPad**) และคอมพิวเตอร์ (**Desktop**) 

พัฒนาด้วย **Plain HTML + CSS + Vanilla JavaScript (100% Zero-Framework / No Build Tool)** และรองรับการเชื่อมต่อกับ **Supabase Cloud Database & Realtime** สำหรับซิงก์ข้อมูลข้ามหลายอุปกรณ์พร้อมกัน

---

## ✨ จุดเด่นและฟังก์ชันการทำงาน

* **📱 Mobile-First POS Design:** หน้าต่างเลือกเครื่องเพิ่มแบบ Bottom Sheet บนมือถือ และจัดเลย์เอาต์ 2 คอลัมน์บน iPad / Desktop สัมผัสง่ายด้วยนิ้วเดียว
* **💰 คำนวณเฉพาะรายได้รวม (Strictly Revenue Only):** บันทึกและแสดงผลเฉพาะ **"รายได้รวม"** ไม่แสดงต้นทุนหรือกำไร (ตามขอบเขตความต้องการ)
* **⚡ Multi-Device Realtime Sync:** รองรับการเชื่อมต่อหลายอุปกรณ์พร้อมกัน (โทรศัพท์, แท็บเล็ต, คอมพิวเตอร์) เมื่อเครื่องหนึ่งกดสั่ง หน้าจอเครื่องอื่นจะอัปเดตยอดขายและออเดอร์ทันที
* **🔒 Shared Password Authentication:** ระบบล็อกอินด้วยรหัสผ่านกลางของร้าน และให้พนักงานระบุชื่อตนเองได้อย่างอิสระ
* **🛡️ ป้องกันการลบข้อมูล (No Delete/Clear):** ไม่มีปุ่มลบหรือรีเซ็ตออเดอร์ ป้องกันพนักงานเผลอกดลบประวัติการขาย
* **📅 ระบบกรองตามวันที่ (Date Picker):** เลือกดูยอดขายย้อนหลังและจำนวนออเดอร์ของแต่ละวันได้อย่างแม่นยำ

---

## 📂 โครงสร้างโปรเจกต์ (Project Structure)

```text
restaurant-tracker/
├── index.html              # หน้าเว็บ POS หลัก (Login, เมนู, Modal, ออเดอร์)
├── style.css               # สไตล์ลิ่ง Responsive, POS Layout, Touch-friendly (Safe-Area)
├── app.js                  # ลอจิกการทำงาน, เชื่อมต่อ Supabase, คำนวณรายได้
├── server.js               # Node.js Server สำหรับรันในวงแลน / Multi-device
├── start.bat               # สคริปต์เปิดเซิร์ฟเวอร์ Local (1-Click)
├── start-online.bat        # สคริปต์เปิดเซิร์ฟเวอร์ Online สาธารณะ (1-Click)
├── start-online.js         # ลอจิกรันเซิร์ฟเวอร์คู่กับ Cloudflare Quick Tunnel
├── supabase-setup.sql      # สคริปต์สร้างตารางและ RLS บน Supabase (1-Click Run)
├── supabase-schema.sql     # สคริปต์ฐานข้อมูลเวอร์ชันเต็ม
├── data/
│   └── database.example.json # ตัวอย่างไฟล์ฐานข้อมูลกรณีรันแบบ Local
└── supabase/
    ├── config.toml
    └── functions/login/index.ts
```

---

## 🚀 วิธีตั้งค่าและเริ่มใช้งาน (Getting Started)

### 1. ตั้งค่าฐานข้อมูล Supabase (แนะนำสำหรับใช้งานจริง 24 ชม.)
1. สมัครใช้งานฟรีที่ [supabase.com](https://supabase.com) และสร้าง New Project
2. ไปที่ **SQL Editor** ในแดชบอร์ด Supabase คัดลอกเนื้อหาจากไฟล์ `supabase-setup.sql` ไปวางแล้วกด **Run**
3. ไปที่ **Project Settings > API** แล้วคัดลอกค่า:
   * **Project URL**
   * **anon / public key**
4. เปิดไฟล์ `app.js` และใส่ค่าที่คัดลอกมา:
   ```javascript
   const SUPABASE_URL = 'YOUR_SUPABASE_URL';
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
   const SHARED_PASSWORD_FALLBACK = 'YOUR_SHARED_PASSWORD';
   ```

### 2. วิธีการเปิดใช้งาน

#### วิธีที่ A: เปิดออนไลน์ฟรี 24 ชม. (ไม่ต้องเปิดคอมทิ้งไว้)
1. นำโฟลเดอร์นี้ไปลากวางที่ **[app.netlify.com/drop](https://app.netlify.com/drop)** หรือเชื่อมต่อผ่าน **Vercel**
2. จะได้ลิงก์ถาวร เช่น `https://your-restaurant.netlify.app` ที่สามารถเปิดใช้งานได้จากโทรศัพท์มือถือและ iPad ทุกเครื่องผ่านอินเทอร์เน็ต 4G/5G ได้ทันที

#### วิธีที่ B: รันผ่าน Local Server บนคอมพิวเตอร์
```powershell
node server.js
```
* คอมพิวเตอร์: `http://localhost:3000`
* มือถือ/iPad ในวง Wi-Fi เดียวกัน: `http://<IP_เครื่องคอม>:3000`

#### วิธีที่ C: รันโหมด Online Tunnel จากคอมพิวเตอร์
```powershell
node start-online.js
```
(หรือดับเบิลคลิกที่ไฟล์ `start-online.bat`)

---

## 🔑 การเปลี่ยนรหัสผ่านร้าน
* **บน Supabase:** เข้าไปที่ Table Editor > ตาราง `settings` > แก้ไขค่าในคอลัมน์ `shared_password` ได้ทันที ทุกเครื่องจะเปลี่ยนไปใช้รหัสใหม่โดยอัตโนมัติ
* **บน Local Mode:** แก้ไขค่า `shared_password` ในไฟล์ `data/database.json`

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
