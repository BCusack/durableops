import { cookies } from "next/headers";
import { deleteSession, sessionCookieName } from "@/lib/auth-store";

export async function POST() {
  const cookieStore = await cookies();
  await deleteSession(cookieStore.get(sessionCookieName())?.value);
  return new Response(null, { status: 204, headers: { "Set-Cookie": `${sessionCookieName()}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax` } });
}
