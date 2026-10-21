# ITS Buggy Car

Website monitoring mobil penumpang untuk sopir, penumpang, dan admin di Kampus ITS Sukolilo, Surabaya. Peta dibuka terpusat ke kawasan ITS; data GPS nyata tetap ditampilkan sesuai koordinat yang diterima. Sopir masuk lalu memilih satu mobil kosong; penumpang dapat melihat status dan lokasi seluruh mobil serta nama sopir. Admin dapat melihat daftar sopir, data diri, status kendaraan, dan bertukar pesan dengan sopir. Tombol Detail pada kartu kendaraan membuka informasi telemetri dari API Maxtracker di tab baru. Tidak ada pemasangan penumpang ke mobil.

## Menjalankan secara lokal

```sh
npm install
cp .env.example .env.local
npm run dev
```

Buka `http://localhost:3000`. Tanpa `MAXTRACKER_TOKEN` dan `MAXTRACKER_USERNAME`, backend otomatis memakai Dummy API internal: lima kendaraan contoh bergerak pada lintasan kecil di kawasan ITS dan posisi/speed berubah berkala. Dashboard dan halaman detail memperbarui lokasi setiap 10 detik; tampilan peta dikunci pada area ITS. Akun lokal pengembangan:

| Peran | Nama akun / email | Kata sandi |
| --- | --- | --- |
| Sopir | `Budi Santoso` | `sopir123` |
| Sopir | `Siti Rahma` | `sopir123` |
| Sopir | `sopir` | `123` |
| Admin | `admin` | `123` |

Akun contoh diimpor ke database pengembangan saat database masih kosong dan `NODE_ENV` bukan `production`. Halaman penumpang (`/`) terbuka tanpa login. Akun admin dapat membuka daftar sopir dan chat melalui menu samping **Daftar sopir & chat**, serta mengelola kendaraan melalui **Kelola armada**. Di sana admin dapat menambah armada dan mengubah nama, kapasitas, serta jumlah penumpang saat ini. Informasi penumpang tampil pada kartu dan detail kendaraan. Jumlah saat ini diperbarui manual oleh admin karena aplikasi belum memiliki alur naik/turun penumpang. Kendaraan manual tersimpan di database dan tampil dengan lokasi tidak tersedia hingga ada perangkat GPS terkait. Sopir membuka **Pesan admin** pada menu samping untuk membalas. Admin menambah, mengganti kata sandi, dan menghapus akun sopir dari **Daftar sopir & chat**. `ADMIN_ACCOUNTS_JSON` dan `DRIVER_ACCOUNTS_JSON` hanya dipakai untuk mengisi database yang masih kosong; contoh format ada di `.env.example`. Set `AUTH_SECRET` ke nilai acak yang panjang untuk setiap deployment.

### API untuk mencoba interaksi

Dummy API menggunakan endpoint yang sama dengan aplikasi, jadi pemilihan mobil dan tampilan penumpang dapat dicoba dari website setelah login.

| Method | Endpoint | Kegunaan |
| --- | --- | --- |
| `POST` | `/api/login` | Masuk memakai akun demo; kirim JSON `{"role":"driver","identity":"sopir","password":"123"}` untuk akun sopir. |
| `GET` | `/api/session` | Melihat sesi login aktif. |
| `GET` | `/api/admin/drivers` | Admin: melihat daftar sopir, kontak, dan kendaraan aktif. |
| `GET` | `/api/messages?driverId={id}` | Admin: membaca percakapan dengan sopir. Sopir membaca percakapannya sendiri di `/api/messages`. |
| `POST` | `/api/messages` | Mengirim pesan. Admin menyertakan `driverId`; sopir hanya menyertakan `text`. Perlu login sebagai admin atau sopir. |
| `GET` | `/api/vehicles` | Membaca daftar kendaraan, status sopir, dan koordinat GPS demo. Perlu login. |
| `POST` | `/api/vehicles` | Sopir memilih mobil dengan `{"vehicleId":"3596331045888551"}` atau melepasnya dengan `{"action":"release"}`. Perlu sesi sopir. |
| `GET` | `/api/vehicles/{imei}` | Membaca detail telemetri dan posisi satu kendaraan. Perlu login. |

Contoh alur di website: login sebagai `sopir` / `123`, pilih **Pilih mobil**, lalu buka halaman penumpang `/` untuk melihat status serta nama sopir. Penugasan disimpan di tabel `assignments`. Jangan isi kredensial Maxtracker bila ingin tetap menggunakan Dummy API.

## GPS Maxtracker

Atur `MAXTRACKER_TOKEN` dan `MAXTRACKER_USERNAME` di `.env.local`. Server mengambil daftar posisi terbaru dari `/getdevice` pada `MAXTRACKER_BASE_URL`; kredensial tidak dikirim ke browser. Dashboard dan detail meminta pembaruan tiap 10 detik, dengan cache server singkat untuk membatasi panggilan berulang. Kecepatan pembaruan aktual tetap bergantung pada seberapa sering perangkat GPS mengirim posisi ke Maxtracker. Jika permintaan GPS gagal, aplikasi menandai koneksi terganggu dan menampilkan lokasi contoh sampai API pulih. Lokasi yang lebih lama dari dua menit ditandai di daftar sopir.

Peta menampilkan garis jejak dari maksimal tiga posisi terakhir yang berbeda per kendaraan. Riwayat singkat ini disimpan di memori proses; restart server menghapus jejak. Untuk riwayat perjalanan yang lebih lama, integrasikan endpoint histori perjalanan Maxtracker bila tersedia.

Peta memakai tile OpenStreetMap dan perlu akses internet pada browser. Akun, profil, kendaraan, dan penugasan disimpan di PostgreSQL (lihat bagian Database). Percakapan masih disimpan di `.data/messages.json`, yang ditujukan untuk satu instance Node.

## Deploy dengan Docker

`Dockerfile` membangun image Next.js `standalone`. `docker-compose.yml` menjalankannya sebagai container `monitoring-mobil` di port host `47823` dengan `restart: unless-stopped`, sehingga container ikut jalan lagi setelah server reboot. Service `db` menjalankan PostgreSQL dengan data di `./pgdata`; folder `./data` dipasang ke `/app/.data` untuk chat dan impor data lama.

```sh
rsync -az --delete --exclude-from=.dockerignore --include=Dockerfile --include=docker-compose.yml --exclude=.env ./ user@server:monitoring-mobil/
ssh user@server 'cd ~/monitoring-mobil && bash -s' < scripts/create-server-env.sh   # menambah POSTGRES_PASSWORD/AUTH_SECRET/akun awal yang belum ada
ssh user@server 'cd ~/monitoring-mobil && docker compose up -d --build'
```

Container berjalan dengan `NODE_ENV=production`, jadi akun demo tidak aktif.

## Database

Akun admin dan sopir (termasuk data diri), metadata kendaraan, serta penugasan sopir–mobil disimpan di PostgreSQL melalui Drizzle ORM (`src/db/schema.ts`, migrasi SQL di `drizzle/`). Migrasi dijalankan otomatis saat aplikasi pertama kali mengakses database. Ketika database masih kosong, aplikasi mengimpor sekali akun dari `ADMIN_ACCOUNTS_JSON`/`DRIVER_ACCOUNTS_JSON` (atau akun demo saat pengembangan) serta file lama di `.data/` (`drivers.json`, `profiles.json`, `fleet.json`, `assignments.json`). Setelah itu akun dikelola dari aplikasi; mengubah `*_ACCOUNTS_JSON` tidak lagi berpengaruh. Pesan chat masih tersimpan di `.data/messages.json`.

Pengembangan lokal:

```sh
docker compose -f docker-compose.dev.yml up -d   # Postgres di 127.0.0.1:55432, data di ./pgdata-dev
echo 'DATABASE_URL=postgres://monitoring:monitoring_dev@127.0.0.1:55432/monitoring' >> .env.local
npm run dev
```

Setelah mengubah `src/db/schema.ts`, buat migrasi baru dengan `npx drizzle-kit generate`. Di Docker, service `db` (postgres:16-alpine) menyimpan data di `./pgdata`, tidak membuka port ke host, dan memakai `POSTGRES_PASSWORD` dari `.env`.

## Perintah

- `npm run dev` menjalankan server pengembangan.
- `npm run build` membuat build produksi.
- `npm start` menjalankan build produksi.
- `npm run lint` menjalankan pemeriksaan ESLint.
