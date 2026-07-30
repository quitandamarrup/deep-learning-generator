import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

export type AdminSession = { isAdmin?: boolean; loggedInAt?: string };

export function sessionConfig() {
  const password = process.env.ADMIN_SESSION_SECRET;
  if (!password) throw new Error("Missing ADMIN_SESSION_SECRET");
  return {
    password,
    name: "admin-session",
    maxAge: 60 * 60 * 8, // 8 hours
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

export async function getAdminSession() {
  return useSession<AdminSession>(sessionConfig());
}

export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session.data.isAdmin) throw new Error("Forbidden: admin session required");
}
