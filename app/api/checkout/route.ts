import { authenticate, env, failure, HttpError, paystack } from "@/lib/server";
export async function POST(request: Request) {
  try {
    const { db, user } = await authenticate(request);
    let body: Record<string, unknown>;
    try {
      const parsed = await request.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error("Invalid body");
      body = parsed;
    } catch {
      throw new HttpError("Please submit valid checkout details.");
    }
    const text = (key: string, min: number, max: number) => {
      const value = typeof body[key] === "string" ? body[key].trim() : "";
      if (value.length < min || value.length > max)
        throw new HttpError(`Please enter a valid ${key}.`);
      return value;
    };
    const name = text("name", 2, 100),
      address = text("address", 5, 300),
      city = text("city", 2, 100),
      phone = text("phone", 7, 30);
    if (
      !/^[+\d\s()-]+$/.test(phone) ||
      phone.replace(/\D/g, "").length < 7 ||
      phone.replace(/\D/g, "").length > 15
    )
      throw new HttpError("Please enter a valid phone number.");
    if (!user.email)
      throw new HttpError("Your account needs an email address.");
    if (
      typeof body.checkoutKey !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
        body.checkoutKey,
      )
    )
      throw new HttpError("Invalid checkout key.");
    const origin = new URL(env("APP_URL")).origin;
    const { data: orderId, error } = await db.rpc("shop_create_order", {
      p_user_id: user.id,
      p_checkout_key: body.checkoutKey,
      p_name: name,
      p_email: user.email,
      p_address: address,
      p_city: city,
      p_phone: phone,
    });
    if (error)
      throw new HttpError(
        error.message.includes("empty")
          ? "Your cart is empty."
          : "Cannot create order. Check product availability and retry.",
        409,
      );
    const { data: order, error: readError } = await db
      .from("shop_orders")
      .select("*")
      .eq("id", orderId)
      .single();
    if (readError) throw readError;
    if (order.status === "paid")
      return Response.json({
        url: `${origin}/checkout/success?reference=${order.reference}`,
      });
    if (order.authorization_url)
      return Response.json({ url: order.authorization_url });
    const payment = await paystack("/transaction/initialize", {
      email: order.email,
      amount: order.total_kobo,
      currency: "NGN",
      reference: order.reference,
      callback_url: `${origin}/checkout/success`,
      metadata: { order_id: order.id },
    });
    const paymentUrl = new URL(payment.authorization_url);
    if (
      paymentUrl.protocol !== "https:" ||
      paymentUrl.hostname !== "checkout.paystack.com"
    )
      throw new Error("Unexpected payment URL");
    const { error: saveError } = await db
      .from("shop_orders")
      .update({ authorization_url: payment.authorization_url })
      .eq("id", order.id);
    if (saveError) throw saveError;
    return Response.json({ url: payment.authorization_url });
  } catch (error) {
    return failure(error);
  }
}
