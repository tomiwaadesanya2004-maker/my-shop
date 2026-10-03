import "server-only";
import { adminDb, env, HttpError, paystack } from "./server";
import { money, type Order, type OrderItem } from "./types";
export async function deliverEmail(orderId: string) {
  const db = adminDb();
  const { data: claims, error } = await db.rpc("shop_claim_email", {
    p_order_id: orderId,
  });
  if (error) throw error;
  const claim = claims?.[0];
  if (!claim) return false;
  try {
    const { data: order, error: orderError } = await db
      .from("shop_orders")
      .select("*")
      .eq("id", orderId)
      .single();
    if (orderError) throw orderError;
    const { data: items, error: itemError } = await db
      .from("shop_order_items")
      .select("*")
      .eq("order_id", orderId);
    if (itemError) throw itemError;
    const form = new FormData();
    form.set(
      "from",
      process.env.MAILGUN_FROM || `My Shop <orders@${env("MAILGUN_DOMAIN")}>`,
    );
    form.set("to", order.email);
    form.set("subject", `Payment received — ${order.reference}`);
    form.set(
      "text",
      `Hi ${order.name},\n\nThank you! Payment for order ${order.reference} has been received.\n\n${(items as OrderItem[]).map((i) => `${i.quantity} × ${i.name}: ${money(i.quantity * i.unit_price_kobo)}`).join("\n")}\n\nDelivery: ${money(order.shipping_kobo)}\nTotal paid: ${money(order.total_kobo)}\n\nDeliver to: ${order.address}, ${order.city}\n\nView your order in My Shop under Orders.`,
    );
    const base =
      process.env.MAILGUN_REGION === "EU"
        ? "https://api.eu.mailgun.net"
        : "https://api.mailgun.net";
    const response = await fetch(
      `${base}/v3/${encodeURIComponent(env("MAILGUN_DOMAIN"))}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${env("MAILGUN_API_KEY")}`).toString("base64")}`,
        },
        body: form,
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) throw new Error(`Mailgun returned ${response.status}`);
    const { error: finishError } = await db
      .from("shop_email_outbox")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        locked_until: null,
      })
      .eq("order_id", orderId)
      .eq("lease_id", claim.lease_id);
    if (finishError) throw finishError;
    return true;
  } catch (error) {
    await db
      .from("shop_email_outbox")
      .update({
        status: "pending",
        locked_until: null,
        last_error: error instanceof Error ? error.message : "Email failed",
      })
      .eq("order_id", orderId)
      .eq("lease_id", claim.lease_id);
    throw error;
  }
}
export async function verifyPayment(
  reference: string,
  userId?: string,
  sendEmail = true,
): Promise<Order> {
  if (
    !/^shop_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      reference,
    )
  )
    throw new HttpError("Invalid payment reference.");
  const db = adminDb();
  let query = db.from("shop_orders").select("*").eq("reference", reference);
  if (userId) query = query.eq("user_id", userId);
  const { data: order, error } = await query.single();
  if (error || !order) throw new HttpError("Order not found.", 404);
  const payment = await paystack(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
  if (
    payment.reference !== reference ||
    payment.amount !== order.total_kobo ||
    payment.currency !== order.currency ||
    payment.customer?.email?.toLowerCase() !== order.email.toLowerCase()
  )
    throw new HttpError("Payment details do not match this order.", 409);
  if (payment.status !== "success") return order;
  const { error: settleError } = await db.rpc("shop_settle_order", {
    p_order_id: order.id,
    p_transaction_id: String(payment.id),
  });
  if (settleError) throw settleError;
  if (sendEmail)
    try {
      await deliverEmail(order.id);
    } catch (error) {
      console.error(
        "Order email queued for retry",
        error instanceof Error ? error.message : "Email failed",
      );
    }
  return { ...order, status: "paid" };
}
