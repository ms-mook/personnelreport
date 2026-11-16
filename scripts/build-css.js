// สร้าง css/tailwind.css จากคลาสที่ใช้ใน index.html และ js/*.js (Tailwind CSS v4)
// วิธีใช้: npm install && npm run css   — รันใหม่ทุกครั้งที่เพิ่ม/เปลี่ยนคลาส Tailwind ในหน้าเว็บ แล้ว commit ไฟล์ css/tailwind.css
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const TW = path.dirname(require.resolve('tailwindcss/package.json'));
const { compile } = require(path.join(TW, 'dist/lib.js'));

(async () => {
  const files = [path.join(ROOT, 'index.html')].concat(fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => path.join(ROOT, 'js', f)));
  const src = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
  const candidates = new Set(src.match(/[A-Za-z0-9_:\/.\[\]%#\-(),]+/g) || []);
  const compiler = await compile('@import "tailwindcss";', {
    base: TW,
    loadStylesheet: async (id, base) => {
      const p = id === 'tailwindcss' ? path.join(TW, 'index.css') : id.startsWith('tailwindcss/') ? path.join(TW, id.slice(12)) : path.resolve(base, id);
      return { path: p, base: path.dirname(p), content: fs.readFileSync(p, 'utf8') };
    }
  });
  let css = compiler.build([...candidates]);
  // ย่อขนาดแบบง่าย: ตัดคอมเมนต์และช่องว่างซ้ำ
  css = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*\n/g, '\n').replace(/^\s+/gm, '');
  const out = path.join(ROOT, 'css', 'tailwind.css');
  fs.writeFileSync(out, '/* สร้างอัตโนมัติด้วย scripts/build-css.js (Tailwind ' + require(path.join(TW, 'package.json')).version + ') — ห้ามแก้มือ */\n' + css);
  console.log('เขียน ' + path.relative(ROOT, out) + ' ขนาด ' + (Buffer.byteLength(css) / 1024).toFixed(1) + ' KB');
})().catch(e => { console.error(e); process.exit(1); });
