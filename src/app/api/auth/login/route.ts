import { db } from "@/lib/db";
import { badRequest, createSessionToken, normalisasiUsername, rapikanNama, rateLimitLogin, serializeUser, setSessionCookie, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Format permintaan tidak valid");
  }
  const username = (body.username ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!username || !password) return badRequest("Nama pengguna dan kata sandi wajib diisi");

  // Pembatasan percobaan login (brute force guard)
  const rl = rateLimitLogin(`login:${username}`);
  if (!rl.ok) {
    return Response.json({ error: "Terlalu banyak percobaan gagal. Coba lagi dalam 5 menit." }, { status: 429 });
  }

  const sertakan = {
    kebun: { include: { estate: true } },
    afdeling: true,
    bindings: { include: { estate: true, kebun: true, afdeling: true, barak: true } },
  } as const;

  // Pencarian akun bertahap — user yang didaftarkan dari web memakai username
  // otomatis dari nama (huruf kecil tanpa spasi, mis. "Budi Santoso" → "budisantoso"),
  // padahal orang sering mengetik nama lengkapnya. Maka dicoba berurutan:
  //   1. username persis seperti diketik;
  //   2. bentuk baku username (spasi/tanda baca dibuang);
  //   3. nama lengkap, hanya bila cocok dengan TEPAT satu akun.
  let user = await db.user.findUnique({ where: { username }, include: sertakan });
  if (!user) {
    const baku = normalisasiUsername(username);
    if (baku && baku !== username) {
      user = await db.user.findUnique({ where: { username: baku }, include: sertakan });
    }
  }
  if (!user) {
    const target = rapikanNama(username);
    const semua = await db.user.findMany({ select: { id: true, nama: true } });
    const cocok = semua.filter((u) => rapikanNama(u.nama) === target);
    if (cocok.length === 1) {
      user = await db.user.findUnique({ where: { id: cocok[0].id }, include: sertakan });
    }
  }

  // Sandi: dicoba persis seperti diketik, lalu tanpa spasi di ujung — sandi
  // saat pendaftaran selalu di-trim, sedangkan keyboard ponsel sering
  // menambah spasi di akhir kata.
  let sandiBenar = false;
  if (user) {
    sandiBenar = await verifyPassword(password, user.passwordHash);
    if (!sandiBenar && password !== password.trim()) {
      sandiBenar = await verifyPassword(password.trim(), user.passwordHash);
    }
  }

  if (!user || !sandiBenar) {
    return Response.json({ error: "Nama pengguna atau kata sandi salah" }, { status: 401 });
  }
  if (user.status === "PENDING") {
    return Response.json({ error: "Akun masih menunggu persetujuan admin" }, { status: 403 });
  }
  if (user.status === "REJECTED") {
    return Response.json({ error: "Pendaftaran akun Anda ditolak admin" }, { status: 403 });
  }

  await setSessionCookie(user.id);
  const token = await createSessionToken(user.id);
  await db.aksiLog.create({
    data: { userId: user.id, aktor: user.nama, aksi: "Login berhasil (sesi JWT aktif 7 hari)" },
  });

  const payload = serializeUser(user as never);
  return Response.json({
    // Token Bearer: andal di iframe preview & WebView Capacitor (cookie SameSite
    // diblokir browser pada konteks lintas-situs); cookie tetap diterbitkan sebagai cadangan.
    token,
    user: payload,
    // Binding kebun ditegakkan server: user melihat kebun tempatnya didaftarkan
    binding: user.kebunId
      ? { kebunId: user.kebunId, kebunNama: user.kebun?.nama, estate: user.kebun?.estate.nama, afdeling: user.afdeling?.nama }
      : null,
    periode: `${BULAN[new Date().getMonth()]} ${new Date().getFullYear()}`,
  });
}
