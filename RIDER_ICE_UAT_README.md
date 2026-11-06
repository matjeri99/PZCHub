# PZC Rider ICE v1.0 — patch UAT (6 Nov 2026)

## STATUS: KOD DISEDIAKAN, BELUM DEPLOY / BELUM UAT SEBENAR

Patch dibina daripada ZIP frontend `PZCHub-main.zip` dan backend `PZC-Backend-STAGING-20261106.zip` yang diberikan Webmaster.

**Jangan push ke branch `main` dahulu.** Netlify mengikuti GitHub; push ke `main` boleh menerbitkan perubahan ke dua alamat serentak.

## Fungsi

- Peringatan ICE selepas login untuk ahli diluluskan (banner pada Home dan Profile).
- Borang waris 1 (wajib), waris 2, kumpulan darah, alahan, keadaan penting, ubat dan implan.
- Persetujuan wajib, paparan perubatan pilihan, pengaktifan/nyahaktif dan putar token QR.
- Halaman QR awam tanpa login; butang telefon waris dan kecemasan 999.
- Cetakan awal kad 85.6 × 54 mm dan stiker 50 × 50 mm; saiz perlu diuji secara fizikal.

## Backend

Fail kemas kini: `Config.js`, `Api.js`. Fail baharu: `RiderICE.js` (folder `backend_patch/` dalam pakej penghantaran).

1. Cipta salinan **projek Apps Script STAGING** dan **Google Sheets MASTER DATABASE** untuk UAT. Pastikan `SPREADSHEET_ID` di Script Properties projek ujian menunjuk kepada **salinan** Sheets, bukan data ahli sebenar.
2. Semak perbezaan `Config.js` dan `Api.js`; tambah hanya kes `RIDER_ICE` / `doGet(e)` / empat aksi RPC, kekalkan perubahan lain yang dibuat selepas ZIP ini.
3. Tambah fail `RiderICE.gs` daripada `RiderICE.js` dalam projek Apps Script salinan.
4. Jalankan **`setupRiderICE()`** satu kali. Ia menambah tab `RIDER_ICE` dan Script Property `ICE_QR_SECRET` (perlu disimpan rahsia).
5. Deploy salinan Apps Script sebagai Web App ujian: *Execute as owner*, akses **Anyone** hanya jika halaman QR awam benar-benar perlu diuji. Periksa polisi privasi dan had akses dahulu.
6. Gateway Cloudflare ujian mesti diarahkan ke deployment staging ini dan dibenarkan untuk origin ujian. **Jangan ubah Worker production.**

## Frontend

Fail baharu `js/rider-ice.js`, serta perubahan pada `index.html`, `css/styles.css`, `sw.js`.

1. Deploy frontend dalam branch/URL preview berasingan. JANGAN gabungkan ke `main` sebelum UAT.
2. Konfigurasi `js/config.js` *pada salinan preview* kepada API gateway ujian yang berkaitan.
3. QR menggunakan perpustakaan QRCode.js dimuat dari CDN. Ini perlu di-*vendor* secara lokal dan diberi pemeriksaan keselamatan sebelum produksi. Token URL diproses dalam pelayar dan tidak dihantar kepada API penjana QR pihak ketiga.
4. Uji login, Home, Profile, status siap/tidak siap, QR scan tanpa login, cetakan, dan pembatalan token.

## Senarai UAT wajib

- [ ] Ahli belum isi ICE → banner, tidak menghalang fungsi Hub.
- [ ] Ahli isi waris tanpa persetujuan → backend tolak.
- [ ] Telefon tidak sah / waris kedua separuh diisi → backend tolak.
- [ ] Simpan ICE → QR boleh dibaca telefon tanpa login.
- [ ] `show_medical` kosong → halaman awam **tidak** memaparkan butiran kesihatan.
- [ ] Nyahaktifkan ICE → QR lama paparkan tidak aktif.
- [ ] Rotate QR → kod lama tidak aktif; kod baharu berfungsi.
- [ ] Admin tidak boleh baca jadual ICE menerusi RPC sedia ada.
- [ ] Satu ahli tidak boleh membaca/menulis ICE ahli lain.
- [ ] Semak paparan/tautan tanpa token, token rawak, nombor telefon, kumpulan darah salah.
- [ ] Uji cetakan kad/stiker pada skala 100% dan QR pada permukaan helmet.
- [ ] Regression: login, tambah ahli, Hero Photo Manager, event, Store, SPOT ME, Gallery.
- [ ] Semak kedua-dua URL GitHub Pages dan Netlify pada deployment ujian.

## Had teknikal yang belum ditutup

- Tiada pengujian integrasi nyata terhadap Apps Script/Worker/Firebase; ZIP sahaja tidak membekalkan akaun/dataset UAT.
- Fail frontend ZIP bertarikh 4 Nov; semak sama ada ada commit production lebih baru sebelum merge.
- Pautan Apps Script melalui `ScriptApp.getService().getUrl()` mesti menunjukkan web app **staging**; jangan pakai URL production ketika UAT.
- Data kesihatan dalam Sheets ialah data sensitif. Akses editor Sheets, audit akses, polisi retensi dan persetujuan ahli mesti diperketat sebelum go-live.
- Halaman QR awam sengaja mendedahkan telefon waris; ahli mesti faham bahawa sesiapa yang memegang/merakam QR boleh melihatnya. Pautan yang ditarik balik akan terhenti selepas permintaan berikutnya, tertakluk pada cache pelayar.
- Maklumat kumpulan darah tidak boleh digunakan sebagai pengganti ujian padanan darah atau keputusan klinikal.
UAT DEPLOY TRIGGER: 06 November 2026 - Rider ICE staging branch.
## Jurnal pembangunan

**06/11/2026** — Dua ZIP kod sumber diterima. Audit backend 20 fail, frontend 17 entri ZIP. Dapatan: Firebase Auth, `MEMBERS`, `PZC_Gateway`, API satu pintu. Ditambah modul Rider ICE asing, empat aksi RPC, halaman QR awam dan interface Home/Profile/ICE, cetakan UAT. Status **kod prototaip siap untuk semakan**, bukan deployment atau kelulusan produksi. Persetujuan Senate terdahulu 4/7 respons, tiga belum respons bertulis.
