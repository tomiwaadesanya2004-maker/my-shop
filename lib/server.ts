import "server-only";
import { createClient } from "@supabase/supabase-js";
export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function env(name: string) {
  const value = process.env[name];
  if (!value)
    throw new HttpError(`Server configuration is missing ${name}.`, 503);
  return value;
}
export function adminDb() {
  return createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function authenticate(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError("Please sign in to continue.", 401);
  const db = adminDb();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user)
    throw new HttpError("Your session has expired. Please sign in again.", 401);
  return { db, user: data.user };
}
export function failure(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error("Shop API error:", error);
  return Response.json(
    { error: "We could not complete this request. Please try again." },
    { status: 500 },
  );
}
export async function paystack(path: string, body?: unknown) {
  const response = await fetch(`https://api.paystack.co${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${env("PAYSTACK_SECRET_KEY")}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok || !result.status)
    throw new HttpError(
      "Payment service is unavailable. Please retry your checkout.",
      502,
    );
  return result.data;
}
