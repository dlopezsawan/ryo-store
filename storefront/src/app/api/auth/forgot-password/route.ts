import { NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  process.env.MEDUSA_BACKEND_URL ||
  "http://localhost:9000";

export async function POST(request: Request) {
  try {
    const { email } = (await request.json()) as { email?: string };

    if (!email) {
      // Still return 200 to not reveal whether email exists
      return NextResponse.json({ message: "Email sent" });
    }

    try {
      await fetch(`${BACKEND_URL}/auth/customer/emailpass/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email }),
      });
    } catch {
      // Silently fail — don't reveal if the email exists
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({ message: "Email sent" });
  } catch {
    return NextResponse.json({ message: "Email sent" });
  }
}
