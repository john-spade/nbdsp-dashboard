import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { withAuth, clientIp } from "@/lib/api/handler";
import { setUserDisabled } from "@/lib/data/users";
import { audit } from "@/lib/logging/logger";

export const runtime = "nodejs";

/** PATCH /api/admin/users/:uid  body: { disabled: boolean } — enable/disable. */
export const PATCH = withAuth("user:manage", async (req: NextRequest, { user, params }) => {
  const body = await req.json().catch(() => null);
  if (typeof body?.disabled !== "boolean") {
    return NextResponse.json({ error: "Expected { disabled: boolean }" }, { status: 400 });
  }
  if (params.uid === user.uid) {
    return NextResponse.json({ error: "You cannot disable your own account." }, { status: 400 });
  }

  await setUserDisabled(params.uid, body.disabled);
  await audit({
    action: "user.create", // reuse user-mgmt audit category
    actorUid: user.uid,
    actorEmail: user.email,
    role: user.role,
    resource: params.uid,
    detail: { op: body.disabled ? "disable" : "enable" },
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  revalidatePath("/admin/users");
  return NextResponse.json({ ok: true });
});
