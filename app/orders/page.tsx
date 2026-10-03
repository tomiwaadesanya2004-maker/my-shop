"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useShop } from "@/components/shop-provider";
import { browserDb } from "@/lib/supabase";
import { money, type Order, type OrderItem } from "@/lib/types";
type Receipt = Order & { shop_order_items: OrderItem[] };
export default function Orders() {
  const { user, ready, signIn } = useShop();
  const [orders, setOrders] = useState<Receipt[]>([]),
    [loadedUserId, setLoadedUserId] = useState<string | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    let live = true;
    browserDb()
      .from("shop_orders")
      .select("*,shop_order_items(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!live) return;
        if (error)
          setError("Could not load your orders. Please refresh to retry.");
        else {
          setOrders(data as Receipt[]);
          setError("");
        }
        setLoadedUserId(user.id);
      });
    return () => {
      live = false;
    };
  }, [user]);
  return (
    <div className="page-container">
      <p className="eyebrow">ALL YOUR GOOD THINGS</p>
      <h1>Your orders.</h1>
      <p className="page-intro">
        Your purchases and payment status, in one place.
      </p>
      {!ready ? (
        <p>Loading…</p>
      ) : !user ? (
        <div className="empty-state">
          <h2>Your orders are waiting here.</h2>
          <p>Sign in to see your order history.</p>
          <button className="button dark" onClick={signIn}>
            Continue with Google ↗
          </button>
        </div>
      ) : loadedUserId !== user.id ? (
        <p>Loading your orders…</p>
      ) : error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : !orders.length ? (
        <div className="empty-state">
          <h2>Your first favourite is out there.</h2>
          <p>Orders will appear here once you start checkout.</p>
          <Link className="button dark" href="/">
            Explore the shop ↗
          </Link>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((o) => (
            <article className="order-card" key={o.id}>
              <div className="order-top">
                <div>
                  <p className="eyebrow">
                    {new Date(o.created_at).toLocaleDateString("en-NG", {
                      dateStyle: "medium",
                      timeZone: "Africa/Lagos",
                    })}
                  </p>
                  <h2>{money(o.total_kobo)}</h2>
                </div>
                <span className={"status " + o.status}>
                  {o.status === "paid"
                    ? "Payment received"
                    : "Awaiting payment"}
                </span>
              </div>
              <p className="order-reference">{o.reference}</p>
              {o.shop_order_items.map((i) => (
                <div className="summary-row" key={i.product_id}>
                  <span>
                    {i.name} × {i.quantity}
                  </span>
                  <span>{money(i.unit_price_kobo * i.quantity)}</span>
                </div>
              ))}
              <div className="summary-row">
                <span>Delivery</span>
                <span>{money(o.shipping_kobo)}</span>
              </div>
              <p className="muted">
                Deliver to: {o.address}, {o.city}
              </p>
              {o.status !== "paid" && (
                <div className="order-actions">
                  <Link
                    className="button outline"
                    href={"/checkout/success?reference=" + o.reference}
                  >
                    Check payment status
                  </Link>
                  {o.authorization_url && (
                    <a className="button dark" href={o.authorization_url}>
                      Continue payment ↗
                    </a>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
