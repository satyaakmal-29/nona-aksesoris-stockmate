-- Tambah kolom dengan default sementara
ALTER TABLE "Users" ADD COLUMN "username" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Users" ADD COLUMN "password" TEXT NOT NULL DEFAULT '';

-- Isi username dari email (ambil bagian sebelum @)
UPDATE "Users" SET "username" = SPLIT_PART("email", '@', 1);

-- Isi password dengan hash bcrypt dari 'password123' (untuk user lama)
-- Hash: $2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK8i
UPDATE "Users" SET "password" = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK8i';

-- Tambah unique constraint setelah data terisi
ALTER TABLE "Users" ADD CONSTRAINT "Users_username_key" UNIQUE ("username");
ALTER TABLE "Users" ADD CONSTRAINT "Users_email_key" UNIQUE ("email");

-- Hapus default (kolom tetap NOT NULL tapi tidak ada default lagi)
ALTER TABLE "Users" ALTER COLUMN "username" DROP DEFAULT;
ALTER TABLE "Users" ALTER COLUMN "password" DROP DEFAULT;