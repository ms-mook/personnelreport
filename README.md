# รายงานอัตรากำลัง — หน่วยเจาะเลือดเก็บสิ่งส่งตรวจและ POCT

หน้าเว็บอยู่บน **Vercel** ส่วนหลังบ้าน (ฐานข้อมูล Google Sheet, ล็อกอิน, ส่งอีเมล, ตั้งเวลาส่ง) ยังใช้ **Google Apps Script** เดิม

```
เบราว์เซอร์ ──► Vercel: หน้าเว็บ (index.html, css/, js/)
            └─► Vercel: /api/gas  ──►  Apps Script (doPost)  ──►  Google Sheet
                                       └─ ส่งอีเมลรายงาน / ตั้งเวลา 13:00 (ทำงานเหมือนเดิม)
```

## โครงสร้างไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | โครงหน้าเว็บ (HTML อย่างเดียว) |
| `css/style.css` | ธีม เลย์เอาต์ พิมพ์ มือถือ |
| `css/motion.css` | แอนิเมชัน |
| `js/ui.js` | ไอคอน Lucide, กล่องแจ้งเตือน, ตัวเลขวิ่ง |
| `js/app.js` | ล็อกอิน, หน้ากรอก, Dashboard, ตัวเรียก API |
| `js/charts.js` | กราฟ (Chart.js) |
| `js/admin.js` | หน้าผู้ดูแลระบบ |
| `api/gas.js` | ตัวกลาง (Serverless Function) ส่งคำขอต่อไปยัง Apps Script |
| `vercel.json` | ตั้งค่า Vercel (เวลารอสูงสุด 60 วินาที, header ความปลอดภัย) |
| `gas/` | โค้ดหลังบ้านสำหรับ **คัดลอกไปวางใน Apps Script** (Vercel ไม่ได้รันไฟล์ในโฟลเดอร์นี้) |

ไลบรารีโหลดจาก jsDelivr: Tailwind CSS 4 (browser), daisyUI 5, Lucide 0.469.0, Chart.js 4.4.1

---

## ติดตั้งครั้งแรก

### 1) อัปเดต Apps Script (หลังบ้าน)

1. เปิดโปรเจกต์ Apps Script เดิม
2. แทนที่ไฟล์ `Code.gs`, `AdminApi.gs`, `Report.gs` ด้วยไฟล์ในโฟลเดอร์ `gas/` (เพิ่ม `doPost` สำหรับ Vercel)
3. ที่แถบด้านบน เลือกฟังก์ชัน **`setupProxyKey`** → กด **เรียกใช้** → เปิด **บันทึกการดำเนินการ** แล้วคัดลอกค่า `PROXY_KEY = …` เก็บไว้ (ใช้ในขั้นที่ 2)
4. **Deploy → Manage deployments → ✏ (แก้ deployment เดิม) → Version: New version → Deploy**
   - Execute as: **Me**
   - Who has access: **Anyone (ทุกคน)**
5. คัดลอก **Web app URL** (ลงท้ายด้วย `/exec`) เก็บไว้

> ใช้ deployment เดิมเพื่อให้ URL `/exec` ไม่เปลี่ยน ลิงก์เดิมของ Apps Script จะยังเปิดหน้าเว็บเก่าได้ระหว่างย้าย

### 2) สร้างโปรเจกต์บน Vercel

1. เข้า [vercel.com](https://vercel.com) → **Add New… → Project** → เลือก repo **`ms-mook/personnelreport`** → **Import**
2. Framework Preset: **Other** (ไม่ต้องตั้ง Build Command / Output Directory)
3. เปิด **Environment Variables** แล้วเพิ่ม 2 ค่า

   | Name | Value |
   |---|---|
   | `GAS_URL` | Web app URL จากขั้น 1.5 (ลงท้าย `/exec`) |
   | `GAS_PROXY_KEY` | ค่า `PROXY_KEY` จากขั้น 1.3 |

4. กด **Deploy** → ได้ลิงก์ เช่น `https://personnelreport.vercel.app`

> ถ้าเพิ่ม/แก้ Environment Variables ทีหลัง ต้องกด **Deployments → ⋯ → Redeploy** ค่าใหม่จึงจะมีผล

### 3) ตั้งลิงก์ใหม่ในระบบ

เปิดหน้าเว็บบน Vercel → ล็อกอินผู้ดูแล → **ผู้ดูแลระบบ → ตั้งค่า** → ใส่ `APP_URL` เป็นลิงก์ Vercel → บันทึก
(ลิงก์ "เปิด Dashboard" ท้ายอีเมลจะชี้มาที่ Vercel)

### 4) ทดสอบ

- เปิดลิงก์ Vercel โดยไม่ล็อกอิน → เห็น Dashboard สาธารณะ
- ล็อกอิน (ครั้งแรกบนโดเมนใหม่ต้องล็อกอินใหม่) → กรอก → บันทึก
- ผู้ดูแลระบบ → รายงานอีเมล → **ส่งหาตัวเอง** → ได้อีเมลพร้อม PDF

---

## อัปเดตครั้งต่อไป

- **แก้หน้าเว็บ** (`index.html`, `css/`, `js/`, `api/`): commit + push ขึ้น `main` → Vercel deploy ให้อัตโนมัติ (ไม่ต้อง Ctrl+F5)
- **แก้หลังบ้าน** (`gas/`): คัดลอกไฟล์ไปวางใน Apps Script เอง → **Deploy → Manage deployments → ✏ → New version**

## เลิกใช้หน้าเว็บเก่าใน Apps Script (ทำเมื่อพร้อม)

ลบไฟล์ HTML ในโปรเจกต์ Apps Script (`Index`, `Stylesheet`, `Motion`, `UiJS`, `AppJS`, `ChartsJS`, `AdminJS`) → New version
ลิงก์ Apps Script เดิมจะพาไปที่ `APP_URL` อัตโนมัติ

## แก้ปัญหา

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| "ยังไม่ได้ตั้งค่า GAS_URL" | ใส่ `GAS_URL` ใน Vercel แล้ว Redeploy |
| "Apps Script ยังไม่เปิดให้ทุกคนเข้าถึง" | Deploy Apps Script ให้ Who has access = **Anyone** |
| "ไม่อนุญาต" ทุกครั้ง | `GAS_PROXY_KEY` ใน Vercel ไม่ตรงกับ Script Property `PROXY_KEY` |
| "Apps Script ตอบกลับไม่ถูกต้อง" | ยังไม่ได้ New version หลังวาง `Code.gs` ที่มี `doPost` |
| หน้าเว็บเพี้ยน ไม่มีไอคอน | เครือข่ายบล็อก `cdn.jsdelivr.net` |
