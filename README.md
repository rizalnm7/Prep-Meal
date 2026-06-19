# Dapur Rencana — Meal Prep Planner

Web app pribadi untuk merencanakan meal prep harian: resep, bahan yang dibutuhkan,
dan pengecekan otomatis apakah bahan sudah ada di stok atau perlu dibeli.

Dibuat dengan **HTML/CSS/JS murni (tanpa build tool)** + **Supabase** sebagai backend.
Bisa langsung di-deploy ke **Vercel** sebagai static site.

## Fitur

- **Hari Ini** — menu yang direncanakan hari ini, lengkap dengan status tiap bahan (cap "Ada" / "Beli")
- **Rencana Mingguan** — atur menu per hari (sarapan/makan siang/makan malam/camilan), navigasi minggu sebelumnya/berikutnya
- **Resep** — simpan resep dengan daftar bahan, takaran, porsi, dan cara membuat
- **Stok** — catat bahan yang kamu punya di rumah beserta jumlahnya
- **Belanja** — tombol "Generate" menghitung total kebutuhan bahan dari rencana 7 hari ke depan, dibandingkan dengan stok, lalu otomatis menghasilkan daftar bahan yang kurang. Bisa centang manual & tambah item non-bahan (mis. plastik wrap).

## 1. Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com) (gratis).
2. Buka **SQL Editor**, copy-paste seluruh isi file `schema.sql`, lalu **Run**.
3. Buka **Project Settings → API**, salin:
   - `Project URL`
   - `anon public` key
4. Buka `js/config.js` di project ini, isi:
   ```js
   const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   const SUPABASE_ANON_KEY = "eyJxxxxxxxxxxxxxxxxxx";
   ```

> Catatan: app ini didesain untuk **single-user** (kamu sendiri), jadi RLS policy
> di `schema.sql` membuka akses penuh lewat anon key. Jangan bagikan URL app
> secara publik kalau tidak ingin orang lain bisa mengubah datamu.

## 2. Coba di lokal

> ⚠️ **Jangan buka `index.html` langsung dengan double-click di File Explorer.**
> Browser akan membukanya sebagai `file:///C:/...` dan memblokir script CDN serta
> request ke Supabase, sehingga app terlihat "stuck" padahal config sudah benar.
> Selalu jalankan lewat server lokal:

```bash
npx serve .
```
Lalu buka alamat `http://localhost:...` yang muncul di terminal (bukan file-nya langsung).

## 3. Deploy ke Vercel

**Lewat Vercel CLI:**
```bash
npm install -g vercel
vercel
```
Pilih "Other" sebagai framework (tidak perlu build command, ini static site).

**Atau lewat dashboard Vercel:**
1. Push folder ini ke repo GitHub baru.
2. Di [vercel.com](https://vercel.com) → New Project → Import repo tersebut.
3. Framework Preset: **Other**. Build Command & Output Directory dikosongkan saja.
4. Deploy.

Karena `js/config.js` berisi key Supabase, pastikan repo-nya **private** kalau kamu
push ke GitHub (anon key memang aman dipakai di frontend, tapi tetap baiknya
tidak diumbar ke publik bersama URL project Supabase-mu).

## Struktur project

```
meal-prep-planner/
├── index.html
├── schema.sql          ← jalankan sekali di Supabase SQL Editor
├── css/
│   └── style.css
└── js/
    ├── config.js        ← isi kredensial Supabase di sini
    ├── utils.js         ← helper tanggal, format, dll
    ├── db.js             ← semua query Supabase
    ├── ui.js             ← bottom sheet modal & navigasi tab
    ├── recipes.js        ← modul Resep
    ├── pantry.js          ← modul Stok
    ├── planner.js         ← modul Hari Ini & Rencana Mingguan
    ├── shopping.js        ← modul Belanja (logika generate otomatis)
    └── app.js             ← inisialisasi & lazy loading tiap halaman
```

## Cara kerja pengecekan stok → belanja

1. Tiap resep punya daftar bahan + takaran (tersimpan di tabel `recipe_ingredients`).
2. Kamu mencatat stok bahan di rumah di tab **Stok** (tabel `pantry_stock`).
3. Saat menekan **Generate** di tab Belanja, app menjumlahkan semua kebutuhan
   bahan dari rencana makan 7 hari ke depan (di-scale sesuai jumlah porsi
   yang kamu rencanakan vs porsi asli resep), lalu dikurangi dengan stok yang
   kamu punya. Sisa kekurangannya itulah yang masuk daftar belanja.
4. Saat kamu centang item belanja sebagai sudah dibeli, jumlahnya otomatis
   ditambahkan kembali ke stok — jadi siklusnya tertutup tanpa perlu input dua kali.

## Pengembangan lanjutan (ide)

- Upload foto resep langsung (Supabase Storage) alih-alih URL manual
- Drag-and-drop resep antar hari di tampilan mingguan
- Filter resep berdasarkan bahan yang sedang berlebih di stok
- Reminder/notifikasi belanja H-1 sebelum stok habis
