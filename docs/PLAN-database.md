# Rencana Migrasi Database & Monitoring Kinerja Sopir

## 1. Tujuan

Admin dapat memantau setiap sopir:

- kapan sopir aktif (mulai/selesai memakai mobil),
- kapan sopir benar-benar mengemudi dan berapa lama,
- berapa km yang ditempuh,
- mobil apa yang dipakai,
- posisi sekarang.

## 2. Kondisi Saat Ini

| Data | Penyimpanan sekarang | Masalah |
|---|---|---|
| Penugasan sopir ↔ mobil | `.data/assignments.json` (map `imei → driver`) | Hanya status saat ini, tanpa waktu mulai/selesai, tanpa riwayat |
| Info mobil (nama, kapasitas) | `.data/fleet.json` | Tidak relasional; mobil manual (`manual-*`) bercampur dengan IMEI |
| Profil sopir | `.data/profiles.json` | Terpisah dari data akun |
| Chat | `.data/messages.json` | File tunggal, tumbuh tanpa batas |
| Akun login | env `DRIVER_ACCOUNTS_JSON`, dll. (`src/lib/auth.ts`) | Tidak bisa dikelola dari aplikasi |
| Data GPS | Diambil langsung dari `getdevice` setiap 10 detik (`src/lib/fleet.ts`) | Tidak ada data historis yang dipakai |

## 3. Sumber Data Maxtracker (dari `OpenAPI.pdf`)

| Endpoint | Dipakai untuk |
|---|---|
| `GET /openapi/getdevice?token&username` | Posisi terkini semua mobil, `odometer`, `engine`, `status`, `nopol`, `jenis` |
| `GET /openapi/getdevicebyimei?token&imei` | Detail satu mobil |
| `GET /openapi/gethistory?token&imei&begintime&endtime` | Titik GPS historis: `datatime`, `lat`, `lng`, `speed`, `acc`, `mileage` |
| `GET /openapi/getalarm?token&imei&begintime&endtime` | Event alarm/geofence (opsional) |
| `GET /openapi/getgeofence?token&username` | Daftar geofence (opsional) |

Catatan:

- Semua waktu dalam **UNIX timestamp GMT** → simpan sebagai `TIMESTAMPTZ`, tampilkan dalam WIB.
- Token dikirim via query string → semua panggilan **harus** tetap di server (`src/lib/` / API route).
- Arti field `mileage` di `gethistory` belum jelas (nilai contoh naik-turun: 0.01, 0.07, 0.01). **Perlu diverifikasi dengan data asli** sebelum dipakai. Sampai jelas, total km dihitung dari selisih `odometer`.
- Lama retensi data `gethistory` tidak disebutkan di dokumen → **tanyakan ke Maxtracker**. Ini menentukan kapan ringkasan wajib disimpan.

## 4. Keputusan Teknologi

- **Database:** PostgreSQL (hosting: Supabase / Neon, atau Docker lokal untuk development).
- **ORM:** Prisma (migrasi + type-safe client di Next.js).
- **Tidak perlu TimescaleDB di awal** — riwayat GPS mentah tetap di Maxtracker (`gethistory`); database kita hanya menyimpan penugasan dan ringkasan. Bisa ditambah nanti bila ingin menyimpan titik GPS sendiri.

## 5. Skema Database

```prisma
enum Role { driver passenger admin }

model User {
  id          String       @id            // sama dengan id akun sekarang, mis. "driver-budi"
  name        String
  role        Role
  email       String?
  phone       String?
  address     String?
  createdAt   DateTime     @default(now())
  assignments Assignment[]
  messages    Message[]    @relation("DriverMessages")
}

model Vehicle {
  id                String       @id       // IMEI untuk mobil GPS, "manual-<uuid>" untuk mobil manual
  imei              String?      @unique   // null untuk mobil manual
  name              String
  nopol             String?
  jenis             String?
  passengerCapacity Int?
  currentPassengers Int?
  createdAt         DateTime     @default(now())
  assignments       Assignment[]
}

model Assignment {
  id             String    @id @default(uuid())
  driverId       String
  vehicleId      String
  startedAt      DateTime  @default(now())
  endedAt        DateTime?                 // null = sedang aktif
  startOdometer  Decimal?
  endOdometer    Decimal?
  driver         User      @relation(fields: [driverId], references: [id])
  vehicle        Vehicle   @relation(fields: [vehicleId], references: [id])
  summary        AssignmentSummary?

  @@index([driverId, startedAt])
  @@index([vehicleId, startedAt])
}

model AssignmentSummary {
  assignmentId    String   @id
  distanceKm      Decimal                  // endOdometer - startOdometer (fallback: dari gethistory)
  drivingSeconds  Int                      // acc=On && speed>0
  idleSeconds     Int                      // acc=On && speed=0
  maxSpeed        Int
  avgMovingSpeed  Decimal?
  pointCount      Int
  computedAt      DateTime @default(now())
  assignment      Assignment @relation(fields: [assignmentId], references: [id])
}

model Message {
  id         String   @id @default(uuid())
  driverId   String
  senderId   String
  senderName String
  senderRole Role
  text       String
  createdAt  DateTime @default(now())
  driver     User     @relation("DriverMessages", fields: [driverId], references: [id])

  @@index([driverId, createdAt])
}
```

Constraint eksklusif (ditambahkan lewat migrasi SQL manual, karena Prisma belum mendukung partial index):

```sql
-- Satu mobil hanya boleh punya satu penugasan aktif
CREATE UNIQUE INDEX assignment_one_active_vehicle ON "Assignment"("vehicleId") WHERE "endedAt" IS NULL;
-- Satu sopir hanya boleh memakai satu mobil aktif
CREATE UNIQUE INDEX assignment_one_active_driver  ON "Assignment"("driverId")  WHERE "endedAt" IS NULL;
```

## 6. Cara Menghitung Setiap Metrik

| Metrik | Rumus / Sumber |
|---|---|
| Mobil yang dipakai | `Assignment.vehicleId` → `Vehicle.name / nopol` |
| Waktu aktif | `startedAt` → `endedAt` (atau `now()` bila masih aktif) |
| Total km | `endOdometer - startOdometer` (odometer dari `getdevice` saat mulai/selesai) |
| Durasi mengemudi | Dari `gethistory` rentang penugasan: jumlah selisih waktu antar titik berurutan di mana `acc = On` dan `speed > 0` |
| Durasi idle | Sama, untuk `acc = On` dan `speed = 0` |
| Kecepatan maks | `max(speed)` dari `gethistory` |
| Posisi sekarang | `getdevice` (sudah ada di `listVehicles()`) |

Aturan perhitungan durasi:

- Urutkan titik berdasarkan `datatime`.
- Untuk setiap pasangan titik `(p[i], p[i+1])`, durasi = `p[i+1].datatime - p[i].datatime`, kategori mengikuti `p[i]`.
- Abaikan gap > 5 menit (GPS putus) agar durasi tidak membengkak.
- Untuk penugasan panjang, panggil `gethistory` per potongan (mis. per 6 jam) untuk menghindari respons terlalu besar.

## 7. Tahapan Implementasi

### Fase 0 — Persiapan
- [ ] Tanyakan ke Maxtracker: arti `mileage`, retensi `gethistory`, batas rentang waktu per request, rate limit.
- [ ] Uji `gethistory` dengan satu IMEI asli, simpan contoh respons (tanpa token) untuk referensi.

### Fase 1 — Setup Database
- [ ] `npm install prisma @prisma/client`, `npx prisma init`.
- [ ] Tambahkan `DATABASE_URL` ke `.env.local` dan `.env.example` (tanpa nilai rahasia).
- [ ] Tulis `prisma/schema.prisma` sesuai bagian 5.
- [ ] Buat migrasi awal + migrasi SQL untuk partial unique index.
- [ ] Buat `src/lib/db.ts` (singleton `PrismaClient` via `globalThis`, seperti pola cache di `fleet.ts`).

### Fase 2 — Migrasi Data dari `.data/*.json`
- [ ] Script `scripts/migrate-json.ts`:
  - akun dari `configuredUsers()` + `profiles.json` → `User`,
  - `fleet.json` → `Vehicle` (`imei` diisi bila id bukan `manual-*`),
  - `assignments.json` → `Assignment` aktif (`startedAt = now()`, `startOdometer` dari `getdevice`),
  - `messages.json` → `Message`.
- [ ] Jalankan sekali, verifikasi jumlah baris, simpan backup `.data/`.

### Fase 3 — Ganti Penyimpanan di `src/lib/`
- [ ] `fleet.ts`: ganti `readAssignments / persistAssignments / readFleetInfo / persistFleetInfo` dengan query Prisma.
- [ ] `assignVehicle()`:
  - dalam satu transaksi: akhiri penugasan aktif sopir (isi `endedAt`, `endOdometer`), buat penugasan baru dengan `startOdometer`,
  - tangkap error unique constraint → kembalikan `false` (mobil sudah dipakai sopir lain).
- [ ] `releaseDriverVehicle()`: isi `endedAt` + `endOdometer`, lalu picu perhitungan ringkasan (Fase 4).
- [ ] `profiles.ts` dan `chat.ts`: pindah ke tabel `User` dan `Message`.
- [ ] Bentuk response API (`/api/vehicles`, `/api/admin/...`) **tetap sama** agar komponen UI tidak perlu diubah di fase ini.

### Fase 4 — Integrasi Riwayat & Ringkasan
- [ ] `src/lib/maxtracker.ts`: pindahkan pemanggilan HTTP (`getdevice`, `getdevicebyimei`) dari `fleet.ts`, tambahkan `getHistory(imei, begin, end)` dan `getAlarms(imei, begin, end)` dengan timeout dan parsing aman.
- [ ] `src/lib/driverStats.ts`:
  - `computeAssignmentSummary(assignmentId)` → panggil `getHistory`, hitung sesuai bagian 6, simpan ke `AssignmentSummary`.
  - `liveAssignmentStats(assignmentId)` → hitung on-the-fly untuk penugasan yang masih aktif (cache 1–2 menit).
- [ ] Dipanggil otomatis saat penugasan berakhir; sediakan juga endpoint admin untuk menghitung ulang.
- [ ] Mode demo (tanpa token): buat `demoHistory()` agar UI tetap bisa dicoba.

### Fase 5 — API & UI Admin
- [ ] `GET /api/admin/drivers/[id]/assignments?from&to` → daftar penugasan + ringkasan.
- [ ] `GET /api/admin/drivers/[id]/stats?from&to` → total km, total durasi mengemudi/idle, jumlah hari aktif.
- [ ] `GET /api/admin/assignments/[id]/track` → titik `gethistory` untuk ditampilkan di peta (playback rute).
- [ ] Halaman `admin/drivers/[id]`: kartu statistik, tabel riwayat penugasan, peta rute per penugasan.
- [ ] Halaman `admin/drivers`: kolom "status sekarang" (mengemudi / idle / tidak aktif), mobil, durasi sesi berjalan.
- [ ] Semua endpoint dicek `role === "admin"` (sopir hanya boleh melihat datanya sendiri).

### Fase 6 — Penyempurnaan (opsional)
- [ ] Pindahkan akun login dari env ke tabel `User` (dengan hash password, mis. `bcrypt`/`argon2`).
- [ ] Job terjadwal harian: hitung ringkasan untuk penugasan yang lupa diakhiri sopir (mis. auto-end setelah mesin mati > 2 jam).
- [ ] Tabel `gps_points` + TimescaleDB bila ternyata retensi `gethistory` pendek atau butuh laporan jangka panjang.
- [ ] Alarm `getalarm` (geofence, overspeed) ditampilkan di riwayat penugasan.
- [ ] Ekspor laporan per sopir ke CSV/Excel.

## 8. Validasi

Belum ada test framework. Minimal per fase:

- `npm run lint` dan `npm run build` lulus.
- Uji manual:
  - dua sopir memilih mobil yang sama bersamaan → hanya satu berhasil,
  - sopir ganti mobil → penugasan lama tertutup dengan `endOdometer`, penugasan baru terbuka,
  - sopir selesai → `AssignmentSummary` terbentuk dengan km dan durasi masuk akal,
  - mode demo (tanpa token) tetap berjalan.
- Bila test framework ditambahkan, prioritaskan unit test untuk: perhitungan durasi dari titik GPS (termasuk gap), penugasan eksklusif, dan akses per role.

## 9. Keamanan & Konfigurasi

- `DATABASE_URL`, `MAXTRACKER_TOKEN` hanya di `.env.local` / environment server — tidak pernah di komponen client.
- `.data/` tetap di `.gitignore`; hapus setelah migrasi terverifikasi dan backup disimpan di luar repo.
- Jangan commit contoh respons API yang memuat token atau nomor SIM card asli.

## 10. Pertanyaan Terbuka

1. Arti pasti field `mileage` di `gethistory`?
2. Berapa lama Maxtracker menyimpan riwayat GPS?
3. Apakah ada batas rentang waktu / rate limit untuk `gethistory`?
4. Hosting database yang dipilih (Supabase, Neon, atau server sendiri)?
5. Apakah "aktif" cukup didefinisikan sebagai rentang penugasan, atau perlu fitur clock-in/clock-out terpisah?
