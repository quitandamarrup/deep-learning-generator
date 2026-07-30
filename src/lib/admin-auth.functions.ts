import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ username: z.string().min(1), password: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { safeEqual, getAdminSession } = await import("./admin-auth.server");
    const expectedUser = process.env.ADMIN_USERNAME;
    const expectedPass = process.env.ADMIN_PASSWORD;
    if (!expectedUser || !expectedPass) {
      throw new Error("Admin credentials not configured");
    }
    const userOk = safeEqual(data.username, expectedUser);
    const passOk = safeEqual(data.password, expectedPass);
    if (!userOk || !passOk) return { ok: false as const };
    const session = await getAdminSession();
    await session.update({ isAdmin: true, loggedInAt: new Date().toISOString() });
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { getAdminSession } = await import("./admin-auth.server");
  const session = await getAdminSession();
  await session.clear();
  return { ok: true as const };
});

export const adminMe = createServerFn({ method: "GET" }).handler(async () => {
  const { getAdminSession } = await import("./admin-auth.server");
  const session = await getAdminSession();
  return { isAdmin: Boolean(session.data.isAdmin) };
});
