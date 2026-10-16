# OTK — Otewe Kantin (mode lokal siap jalan)

Versi ini menambahkan **mode standalone** supaya website bisa langsung dicoba di localhost tanpa instalasi npm, React, PostgreSQL, atau konfigurasi backend. Tampilan menggunakan logo OTK asli.

## Cara paling mudah di Windows
1. Ekstrak file ZIP.
2. Pastikan Python 3 terpasang (centang `Add Python to PATH` saat instalasi).
3. Klik dua kali `launch.bat`.
4. Buka `http://localhost:5173` jika browser belum terbuka otomatis.

## Cara manual
Buka terminal di folder proyek lalu jalankan:

```bash
python -m http.server 5173
```

Windows tertentu menggunakan `py -m http.server 5173`. Lalu buka `http://localhost:5173`.

> Jangan membuka `index.html` langsung melalui file explorer bila ingin memakai localhost. Gunakan server lokal di atas.

## Fitur mode lokal
- Katalog makanan, pencarian, filter kategori, dan keranjang.
- Form data pemesan dan pembuatan pesanan lokal.
- Riwayat pesanan dan status pesanan.
- Dashboard admin untuk tambah/edit/hapus menu dan mengubah status pesanan.
- Penyimpanan data browser melalui `localStorage`.
- Layout responsif dan logo OTK.

## Login admin lokal
- Email: `admin@otk.local`
- Password: `OtkAdmin123!`

Login ini hanya untuk demonstrasi lokal. Jangan deploy mode ini ke internet sebagai sistem admin sungguhan.

## Menggunakan MySQL melalui phpMyAdmin (backend Prisma)

Bagian ini menyiapkan database MySQL untuk backend TypeScript + Prisma. Catatan: website standalone yang dijalankan dengan `launch.bat` masih menyimpan data demo di `localStorage`; agar pesanan dari halaman itu masuk ke MySQL, frontend perlu dipanggil ke API backend. Folder `backend/` adalah backend API terpisah.

1. Jalankan Apache dan MySQL dari XAMPP, lalu buka `http://localhost/phpmyadmin`.
2. Klik **New / Baru**, buat database bernama `otk_db`, dengan collation `utf8mb4_unicode_ci`.
3. Pilih database `otk_db`, buka tab **Import**, pilih file `database/otk_mysql.sql`, lalu klik **Import / Go**. File SQL membuat tabel `Product`, `Order`, `OrderItem`, dan `PaymentEvent`.
4. Salin `backend/.env.example` menjadi `backend/.env`. Untuk XAMPP default (user `root`, password kosong), gunakan `DATABASE_URL="mysql://root:@localhost:3306/otk_db"`. Jika root kamu memakai password, formatnya `mysql://root:PASSWORD_KAMU@localhost:3306/otk_db`. Jangan membagikan file `.env`.
5. Di terminal, masuk ke folder `backend`, lalu jalankan `npm install`, `npx prisma validate`, dan `npx prisma generate`.
6. Jika sudah mengimpor SQL, kamu tidak perlu menjalankan `migrate dev` untuk membuat tabel lagi. Untuk menyelaraskan schema Prisma dengan database saat pengembangan, kamu bisa menjalankan `npx prisma db push` setelah memastikan database benar.
7. Jalankan API dengan `npm run dev`. Backend menggunakan port 4000 secara default. Buka `http://localhost:4000/api/health` untuk mengecek apakah API hidup.
8. Untuk mengisi contoh menu, jalankan `npm run seed` dari folder `backend`.

**Integrasi katalog produk React dengan MySQL:**

1. Dari folder `backend`, salin `.env.example` menjadi `.env` dan isi `DATABASE_URL` sesuai MySQL XAMPP.
2. Ubah `ADMIN_PASSWORD` menjadi password admin milikmu dan `ADMIN_API_KEY` menjadi string rahasia panjang. Jangan membagikan file `.env`.
3. Dari folder `backend`, jalankan `npm install`, `npx prisma validate`, `npx prisma generate`, lalu `npx prisma db push` jika tabel database sudah dibuat melalui SQL dan schema sudah diperiksa.
4. Jalankan `npm run seed` untuk memasukkan contoh produk awal ke tabel `Product` (jika ingin memakai contoh menu).
5. Jalankan backend dengan `npm run dev` dari folder `backend`.
6. Di terminal kedua, masuk ke folder `frontend`, jalankan `npm install`, lalu `npm run dev`.
7. Buka alamat Vite yang ditampilkan (biasanya `http://localhost:5173`). Login admin menggunakan `ADMIN_EMAIL` dan `ADMIN_PASSWORD` dari `backend/.env`.
8. Setelah login, katalog admin diambil dari API. Tambah/edit/hapus produk dan ubah stok akan dikirim ke backend lalu disimpan melalui Prisma ke MySQL. Pengunjung juga mengambil katalog aktif dari API.

**Catatan:** halaman standalone `index.html` yang dijalankan dengan `launch.bat` masih menggunakan `localStorage`. Integrasi database ini berjalan pada aplikasi React di folder `frontend/`, bersama API di folder `backend/`. Metode pembayaran pada checkout hanya berupa pilihan (Tunai, Transfer Bank, QRIS, DANA, GoPay, OVO, ShopeePay). Pilihan dicatat di database; tidak ada integrasi payment gateway atau pembayaran otomatis. Pengelola mengonfirmasi pembayaran secara manual.

## Penting: pembayaran nyata
Mode standalone **tidak memproses pembayaran online**. Pembayaran riil harus menggunakan backend aman, akun merchant Midtrans aktif, Server Key yang disimpan hanya di backend, HTTPS, dan URL webhook publik. Jangan pernah memasukkan Server Key ke `app.js` atau file frontend. Folder `frontend/` dan `backend/` tetap disediakan sebagai dasar pengembangan React/Express sebelumnya, tetapi mode localhost termudah berjalan dari `index.html` melalui server statis.

## Notifikasi pesanan melalui WhatsApp
1. Jalankan website dan masuk ke dashboard admin.
2. Pada bagian **Notifikasi WhatsApp**, masukkan nomor WhatsApp kantin dengan kode negara, misalnya `6281234567890` (tanpa tanda `+`).
3. Klik **Simpan nomor WhatsApp**.
4. Saat pelanggan membuat pesanan, browser akan membuka WhatsApp dengan rincian pesanan yang sudah diisi sebagai pesan. Pelanggan perlu menekan tombol **Kirim** di WhatsApp.
5. Admin juga dapat menekan tombol **WhatsApp** pada setiap pesanan di dashboard untuk membuka pesan rincian pesanan.

Catatan: WhatsApp tidak mengirim pesan otomatis di latar belakang. Tautan membuka WhatsApp dengan teks yang sudah disiapkan, dan pengguna harus mengonfirmasi pengiriman. Nomor pengaturan tersimpan di localStorage browser admin ini.

### Konfirmasi pembayaran dan cetak struk
- Pada daftar **Pesanan terbaru**, pelanggan dapat memilih **Sudah bayar? Konfirmasi via WhatsApp**. Tombol membuka WhatsApp ke nomor `085772354593` dengan detail pesanan yang sudah terisi; pelanggan dapat melampirkan bukti transfer lalu menekan **Kirim**.
- Tombol **Cetak struk** membuka dialog cetak browser untuk struk pesanan.
- Website lokal ini tidak memverifikasi pembayaran otomatis. Konfirmasi harus diperiksa oleh pengelola melalui WhatsApp, dan pop-up browser perlu diizinkan untuk mencetak struk.
