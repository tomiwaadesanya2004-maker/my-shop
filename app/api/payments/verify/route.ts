import { authenticate, failure } from "@/lib/server";
import { verifyPayment } from "@/lib/payments";
export async function POST(request: Request) {
  try {
    const { user } = await authenticate(request);
    const { reference } = await request.json();
    const order = await verifyPayment(
      typeof reference === "string" ? reference : "",
      user.id,
    );
    return Response.json({ order });
  } catch (error) {
    return failure(error);
  }
}
