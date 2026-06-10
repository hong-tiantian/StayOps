import { NextResponse } from "next/server";
import { auditFromIntake, type AuditFromIntakeRequest } from "@/lib/intake/auditFromIntake";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as AuditFromIntakeRequest;
  try {
    return NextResponse.json(await auditFromIntake(body));
  } catch (err) {
    if (err instanceof Error && err.message === "intake_message_required") {
      return NextResponse.json(
        {
          ok: false,
          error: "intake_message_required",
          accepted_shapes: [
            "{ body_text, source?, sender?, subject?, received_at?, booking_id? }",
            "{ messages: IntakeMessage[], booking_id? }",
          ],
        },
        { status: 400 }
      );
    }
    throw err;
  }
}
