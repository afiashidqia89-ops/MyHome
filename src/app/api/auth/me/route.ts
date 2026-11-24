import { getSessionUser, serializeUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const me = await getSessionUser();
  if (!me) {
    return Response.json({ authenticated: false }, { status: 401 });
  }
  return Response.json({
    authenticated: true,
    user: serializeUser(me),
    binding: me.kebunId
      ? { kebunId: me.kebunId, kebunNama: me.kebun?.nama, afdeling: me.afdeling?.nama }
      : null,
  });
}
