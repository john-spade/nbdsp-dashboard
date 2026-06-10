import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { withAuth, clientIp } from "@/lib/api/handler";
import { createManagedUser, listManagedUsers } from "@/lib/data/users";
import { createUserSchema } from "@/lib/fhir/validate";
import { audit } from "@/lib/logging/logger";

export const runtime = "nodejs";

/** GET /api/admin/users → all users (Auth ⨝ Firestore profile). Admin only. */
export const GET = withAuth("user:manage", async () => {
  const users = await listManagedUsers();
  return NextResponse.json({ users });
});

/** POST /api/admin/users → create an account. Admin only (no public signup). */
export const POST = withAuth("user:manage", async (req: NextRequest, { user }) => {
  const body = await req.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const created = await createManagedUser({
      ...parsed.data,
      createdBy: user.email ?? user.uid,
    });

    await audit({
      action: "user.create",
      actorUid: user.uid,
      actorEmail: user.email,
      role: user.role,
      resource: created.uid,
      detail: { targetEmail: created.email, role: created.role },
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    revalidatePath("/admin/users");
    return NextResponse.json({ user: created }, { status: 201 });
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    if (code === "auth/email-already-exists") {
      return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
    }
    if (code === "auth/invalid-password") {
      return NextResponse.json({ error: "Password is too weak." }, { status: 400 });
    }
    throw err; // → generic 500 via withAuth
  }
});
