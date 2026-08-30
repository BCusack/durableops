import { z } from "zod";
import { authenticate, createSession } from "@/lib/auth-store";

const schema = z.object({ username: z.string().trim().min(1), password: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await authenticate(input.username, input.password);
    if (!user) return Response.json({ ok: false, message: "Invalid username or password" }, { status: 401 });
    const token = await createSession(user.id);
    const response = Response.json({ ok: true, user });
    response.headers.append(
      "Set-Cookie",
      `durableops_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
    );
    return response;
  } catch {
    return Response.json({ ok: false, message: "Please enter a username and password" }, { status: 400 });
  }
}
