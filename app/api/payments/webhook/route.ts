import { createHmac, timingSafeEqual } from "node:crypto";
import { env, failure } from "@/lib/server";
import { verifyPayment } from "@/lib/payments";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const signature = request.headers.get("x-paystack-signature") || "";
    const expected = createHmac("sha512", env("PAYSTACK_SECRET_KEY"))
      .update(raw)
      .digest("hex");
    if (
      !/^[a-f0-9]{128}$/i.test(signature) ||
      !timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expected, "hex"),
      )
    )
      return new Response("Invalid signature", { status: 401 });
    const event = JSON.parse(raw);
    if (
      event.event === "charge.success" &&
      typeof event.data?.reference === "string" &&
      event.data.reference.startsWith("shop_")
    )
      await verifyPayment(event.data.reference, undefined, false);
    return Response.json({ received: true });
  } catch (error) {
    return failure(error);
  }
}
