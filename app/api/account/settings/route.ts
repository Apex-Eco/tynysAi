import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

type SettingsPayload = {
  name?: string;
  currentPassword?: string;
  newPassword?: string;
};

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    const sessionEmail = session?.user?.email;

    if (!sessionEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const payload: SettingsPayload = {
      name: asTrimmedString(body.name),
      currentPassword: asTrimmedString(body.currentPassword),
      newPassword: asTrimmedString(body.newPassword),
    };

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, sessionEmail))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updates: { name?: string; password?: string } = {};

    if (payload.name && payload.name !== user.name) {
      if (payload.name.length < 2) {
        return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
      }
      updates.name = payload.name;
    }

    if (payload.newPassword) {
      if (!payload.currentPassword) {
        return NextResponse.json({ error: "Current password is required" }, { status: 400 });
      }

      if (!user.password) {
        return NextResponse.json({ error: "Password change is unavailable for this account" }, { status: 400 });
      }

      const isCurrentPasswordValid = await compare(payload.currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }

      if (payload.newPassword.length < 8) {
        return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
      }

      updates.password = await hash(payload.newPassword, 12);
    }

    if (!updates.name && !updates.password) {
      return NextResponse.json({ error: "No changes to save" }, { status: 400 });
    }

    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, user.id))
      .returning({ id: users.id, name: users.name, email: users.email });

    return NextResponse.json({
      message: "Account settings updated",
      user: updatedUser,
      nameUpdated: Boolean(updates.name),
      passwordUpdated: Boolean(updates.password),
    });
  } catch (error) {
    console.error("Failed to update account settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
