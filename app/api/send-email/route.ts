import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { name, email, items, total } = await req.json();

  const list = items
    .map((i: { name: string; price: number }) => `- ${i.name}: $${i.price}`)
    .join("\n");

  const form = new FormData();
  form.append("from", `My Shop <postmaster@${process.env.MAILGUN_DOMAIN}>`);
  form.append("to", email);
  form.append("subject", "Your order is confirmed");
  form.append(
    "text",
    `Hi ${name},\n\nThanks for your order!\n\n${list}\n\nTotal: $${total}`
  );

  const res = await fetch(
    `https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from("api:" + process.env.MAILGUN_API_KEY).toString("base64"),
      },
      body: form,
    }
  );

  return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : 500 });
}