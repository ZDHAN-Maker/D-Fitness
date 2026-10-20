# Personal Fitness OS

Platform kebugaran pribadi (nutrisi, latihan, recovery, tubuh, goals, analytics, AI coach) di atas **Next.js 15 + Supabase + Vercel**.
**Status: Phase 1–6 selesai (… + AI). Tinggal Phase 7 (hardening).** Lihat `docs/ARCHITECTURE.md`.

## Menjalankan lokal
```bash
npm install
cp .env.example .env.local        # isi URL + anon key Supabase
npx supabase start                # atau pakai project Supabase hosted
npm run db:reset                  # terapkan migrasi 001…017 + seed
npm run dev                       # http://localhost:3000
```
Supabase hosted: `npx supabase link --project-ref <ref> && npx supabase db push`.
Di Auth → URL Configuration tambahkan `http://localhost:3000/auth/callback` dan URL Vercel Anda.

## Perintah
| Perintah | Fungsi |
|---|---|
| `npm run db:verify` | Uji schema + RLS + fungsi di Postgres in-memory (tanpa Docker) |
| `npm run typecheck` / `lint` / `test` / `build` | Kualitas kode |
| `npm run seed:import` | Muat dataset starter JSON → `012_starter_dataset.sql` (ID asli dipertahankan) |
| `npm run db:types` | Generate tipe TS dari DB lokal |

## Dataset starter
Prompt menyebut dataset starter, tetapi **file dataset tidak ikut terunggah**. `010_seed_master_data.sql` berisi data dasar kecil (17 makanan *perkiraan*, 23 latihan, 20 aktivitas, 13 template goal, 16 achievement). Untuk memakai dataset asli: taruh JSON di `scripts/starter-data/`, sesuaikan `scripts/starter-data.mapping.json`, jalankan `npm run seed:import` lalu `npm run db:reset`.

## Deploy ke Vercel
Import repo → set env var dari `.env.example` (service role & AI key **tanpa** prefix `NEXT_PUBLIC_`) → deploy.

## Mengaktifkan AI (Gemini)
Tambahkan sebagai environment variable (Vercel → Project → Settings → Environment Variables, atau `.env.local`), lalu deploy ulang:
```
AI_PROVIDER=gemini
AI_API_KEY=<kunci Gemini Anda>
SUPABASE_SERVICE_ROLE_KEY=<service role key Supabase>   # wajib: untuk batas pemakaian yang tak bisa dicurangi
# opsional: AI_MODEL_TEXT, AI_MODEL_VISION, AI_BASE_URL, AI_DAILY_LIMIT, AI_DAILY_VISION_LIMIT
```
Buka **AI Coach** → **Check AI connection** untuk memastikan kunci diterima. **Jangan** menaruh kunci di kode, repo, chat, atau tangkapan layar; jika pernah terekspos, cabut dan buat yang baru.
