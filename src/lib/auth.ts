// ============================================================
// RumahLayak — Autentikasi produksi
// bcryptjs (hash sandi) + jose (JWT HS256 di cookie httpOnly)
// ============================================================
import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const COOKIE = "rl_session";
const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "rl-dev-secret-ganti-di-produksi");

export type SessionUser = Prisma.UserGetPayload<{
  include: { kebun: true; afdeling: true; bindings: { include: { estate: true; kebun: true; afdeling: true; barak: true } } };
}>;

/**
 * Bentuk baku username: huruf kecil + angka saja, maksimal 20 karakter.
 * Dipakai di DUA tempat agar selalu sepadan: pembuatan username otomatis saat
 * pendaftaran (api/users) dan pencocokan input saat login (api/auth/login).
 */
export function normalisasiUsername(teks: string) {
  return teks.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20);
}

/** Rapikan nama untuk pencocokan: huruf kecil, spasi ganda dijadikan satu. */
export function rapikanNama(teks: string) {
  return teks.toLowerCase().replace(/\s+/g, " ").trim();
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}
export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function createSessionToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("rumahlayak")
    .setExpirationTime("7d")
    .sign(secret);
}

export async function setSessionCookie(userId: string) {
  const token = await createSessionToken(userId);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/**
 * Ambil token sesi dari dua saluran:
 *  1. Header `Authorization: Bearer <jwt>`  — dipakai klien di iframe preview,
 *     WebView Capacitor, dan konteks lintas-situs (cookie SameSite diblokir browser).
 *  2. Cookie httpOnly `rl_session`          — dipakai saat portal dibuka langsung di tab.
 */
async function resolveToken(): Promise<string | null> {
  const h = await headers();
  const auth = h.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ") && auth.slice(7).trim()) {
    return auth.slice(7).trim();
  }
  const jar = await cookies();
  return jar.get(COOKIE)?.value ?? null;
}

/** Baca & verifikasi sesi (header Bearer dulu, lalu cookie), lalu muat user dari database. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await resolveToken();
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: "rumahlayak" });
    if (!payload.sub) return null;
    const user = await db.user.findUnique({
      where: { id: payload.sub },
      include: {
        kebun: true,
        afdeling: true,
        bindings: { include: { estate: true, kebun: true, afdeling: true, barak: true } },
      },
    });
    if (!user || user.status !== "ACTIVE") return null;
    return user;
  } catch {
    return null;
  }
}

/** Serialisasi user untuk klien (tanpa hash sandi) + daftar binding. */
export function serializeUser(u: SessionUser) {
  const labels = u.bindings
    .map((b) => [b.estate?.nama, b.kebun?.nama, b.afdeling?.nama, b.barak?.nama].filter(Boolean).join(" / "))
    .filter(Boolean);
  return {
    id: u.id,
    nama: u.nama,
    username: u.username,
    role: u.role as "AUDITOR" | "AUDITEE" | "ADMIN",
    jabatan: u.jabatan ?? "",
    kebunId: u.kebunId,
    kebunNama: u.kebun?.nama ?? null,
    afdelingId: u.afdelingId,
    afdelingNama: u.afdeling?.nama ?? null,
    bindings: [...new Set(labels)], // multi binding — bisa lebih dari satu kebun/afdeling
    status: u.status as "ACTIVE" | "PENDING" | "REJECTED",
    menuAkses: u.menuAkses ?? null, // akses menu portal web — null = ikut default peran
    createdAt: u.createdAt.toISOString(),
  };
}

export type UserPayload = ReturnType<typeof serializeUser>;

/** Pemfilteran data berdasar binding pengguna (produksi — multi kebun). */
export function scopeFilter(me: SessionUser, kebunIdParam?: string | null) {
  // ADMIN corporate: melihat seluruh kebun, dapat memilih via query param
  if (me.role === "ADMIN") {
    return kebunIdParam ? { kebunId: kebunIdParam } : {};
  }
  // AUDITOR/AUDITEE: terikat kebun tempat dia didaftarkan (binding tunggal kompat)
  return { kebunId: me.kebunId ?? "__none__" };
}

// ---------- Rate limit login sederhana (in-memory) ----------
const attempts = new Map<string, { n: number; reset: number }>();
export function rateLimitLogin(key: string, max = 8, windowMs = 5 * 60_000) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || rec.reset < now) {
    attempts.set(key, { n: 1, reset: now + windowMs });
    return { ok: true, sisa: max - 1 };
  }
  rec.n += 1;
  if (rec.n > max) return { ok: false, sisa: 0 };
  return { ok: true, sisa: max - rec.n };
}

export function unauthorized() {
  return Response.json({ error: "Tidak terautentikasi — silakan login" }, { status: 401 });
}
export function forbidden(msg = "Peran Anda tidak diizinkan melakukan aksi ini") {
  return Response.json({ error: msg }, { status: 403 });
}
export function badRequest(msg: string) {
  return Response.json({ error: msg }, { status: 400 });
}
