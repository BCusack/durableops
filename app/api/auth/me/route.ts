import { cookies } from "next/headers";
import { getUserFromSession, sessionCookieName } from "@/lib/auth-store";

export async function GET() {
  const user = await getUserFromSession((await cookies()).get(sessionCookieName())?.value);
  return Response.json({ ok: true, user });
}
