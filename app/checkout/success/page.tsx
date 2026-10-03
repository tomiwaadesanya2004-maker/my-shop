"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useShop } from "@/components/shop-provider";
import { money, type Order } from "@/lib/types";
export default function PaymentResult() {
  const { ready, user, api, reload, signIn } = useShop();
  const [order, setOrder] = useState<Order | null>(null),
    [checking, setChecking] = useState(false),
    [error, setError] = useState("");
  const started = useRef(false);
  const verify = useCallback(async () => {
    setChecking(true);
    setError("");
    try {
      const reference =
        new URLSearchParams(window.location.search).get("reference") || "";
      const result = await api("/api/payments/verify", { reference });
      const verified = result.order as Order;
      setOrder(verified);
      if (verified.status === "paid") {
        sessionStorage.removeItem("my-shop-checkout");
        await reload();
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not verify payment. Please retry.",
      );
    } finally {
      setChecking(false);
    }
  }, [api, reload]);
  useEffect(() => {
    if (ready && user && !started.current) {
      started.current = true;
      void verify();
    }
  }, [ready, user, verify]);
  return (
    <div className="page-container result-page">
      <div className="result-symbol">
        {order?.status === "paid" ? "✓" : "◇"}
      </div>
      <p className="eyebrow">YOUR ORDER, YOUR EVERYDAY</p>
      <h1>
        {order?.status === "paid"
          ? "Good things are coming."
          : "Let’s check your payment."}
      </h1>
      {!ready || checking ? (
        <p role="status">Verifying your payment securely…</p>
      ) : !user ? (
        <>
          <p>Sign in to view your payment result.</p>
          <button className="button dark" onClick={signIn}>
            Continue with Google
          </button>
        </>
      ) : order?.status === "paid" ? (
        <>
          <p>
            Thank you, {order.name}. We received your payment of{" "}
            <strong>{money(order.total_kobo)}</strong>.
          </p>
          <p className="muted">
            Your confirmation email is queued for {order.email}. You can also
            find the receipt in your order history.
          </p>
          <div className="receipt">
            <span>Order reference</span>
            <strong>{order.reference}</strong>
            <span>Deliver to</span>
            <strong>
              {order.address}, {order.city}
            </strong>
          </div>
          <Link className="button dark" href="/orders">
            View your orders ↗
          </Link>
        </>
      ) : (
        <>
          <p>
            Your order is awaiting payment confirmation. If you paid, check
            again shortly. Your order remains saved.
          </p>
          {error && (
            <p role="alert" className="error inline-error">
              {error}
            </p>
          )}
          <button className="button dark" onClick={verify}>
            Check payment again
          </button>
          <Link className="back-link" href="/orders">
            View your orders
          </Link>
        </>
      )}
    </div>
  );
}
