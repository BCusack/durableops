import { z } from "zod";
import { createSession, createUser } from "@/lib/auth-store";

const schema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(128),
  role: z.enum(["requester", "tech"]).default("requester"),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await createUser(input.username, input.password, input.role);
    const token = await createSession(user.id);
    const response = Response.json({ ok: true, user });
    response.headers.append(
      "Set-Cookie",
      `durableops_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
    );
    return response;
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message : "Could not create account" }, { status: 400 });
  }
}
