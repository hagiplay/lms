import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { verifyHmac } from "@/lib/domain/crypto";
import { paymentEventSchema } from "@/lib/domain/webhook";
import { processPaymentEvent } from "@/lib/data/payments";

/**
 * POST /api/webhooks/payments?provider=<name>
 * Header: X-Signature: sha256=<hex HMAC-SHA256 of the raw body with PAYMENT_WEBHOOK_SECRET>
 * Body: see paymentEventSchema (src/lib/domain/webhook.ts).
 */
export async function POST(req: NextRequest) {
  if (!env.paymentWebhookSecret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const raw = await req.text();
  if (raw.length > 64_000) return NextResponse.json({ error: "too large" }, { status: 413 });
  if (!verifyHmac(env.paymentWebhookSecret, raw, req.headers.get("x-signature"))) return NextResponse.json({ error: "bad signature" }, { status: 401 });

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const parsed = paymentEventSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid payload", issues: parsed.error.issues.map((i) => i.message) }, { status: 422 });

  const provider = (req.nextUrl.searchParams.get("provider") ?? "generic").replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "generic";
  try {
    const r = await processPaymentEvent(provider, parsed.data);
    return NextResponse.json(r);
  } catch (e) {
    // 500 so the provider retries; the error is recorded on the payment_events row.
    console.error("[payments] processing failed", e);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
