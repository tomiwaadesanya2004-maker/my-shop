export async function POST() {
  return Response.json(
    { error: "Order emails are sent automatically after verified payment." },
    { status: 410 },
  );
}
