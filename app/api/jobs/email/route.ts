import { timingSafeEqual } from "node:crypto";
import { adminDb, env, failure } from "@/lib/server";
import { deliverEmail } from "@/lib/payments";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const supplied = Buffer.from(request.headers.get("authorization") || ""),
      expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      return new Response("Unauthorized", { status: 401 });
    const { data, error } = await adminDb()
      .from("shop_email_outbox")
      .select("order_id")
      .neq("status", "sent")
      .or(`locked_until.is.null,locked_until.lt.${new Date().toISOString()}`)
      .order("created_at")
      .limit(5);
    if (error) throw error;
    const results = await Promise.allSettled(
      (data || []).map((job) => deliverEmail(job.order_id)),
    );
    const sent = results.filter(
      (result) => result.status === "fulfilled" && result.value,
    ).length;
    return Response.json({ processed: data?.length || 0, sent });
  } catch (error) {
    return failure(error);
  }
}
