"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useShop } from "@/components/shop-provider";
import { OrderSummary } from "@/components/order-summary";
import { browserDb } from "@/lib/supabase";
export default function Checkout() {
  const shop = useShop();
  const [details, setDetails] = useState({
      name: "",
      address: "",
      city: "",
      phone: "",
    }),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!shop.user) return;
    let live = true;
    browserDb()
      .from("shop_profiles")
      .select("name,address,city,phone")
      .eq("user_id", shop.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (live)
          setDetails(
            data || {
              name: shop.user?.user_metadata.full_name || "",
              address: "",
              city: "",
              phone: "",
            },
          );
      });
    return () => {
      live = false;
    };
  }, [shop.user]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || shop.busy) return;
    setSaving(true);
    setError("");
    try {
      const fingerprint = JSON.stringify({
        user: shop.user?.id,
        cart: shop.cart.map((i) => [i.product_id, i.quantity]).sort(),
        details,
      });
      let checkoutKey: string = crypto.randomUUID();
      const previous = JSON.parse(
        sessionStorage.getItem("my-shop-checkout") || "null",
      );
      if (previous?.fingerprint === fingerprint) checkoutKey = previous.key;
      sessionStorage.setItem(
        "my-shop-checkout",
        JSON.stringify({ fingerprint, key: checkoutKey }),
      );
      const result = await shop.api("/api/checkout", {
        ...details,
        checkoutKey,
      });
      if (typeof result.url !== "string")
        throw new Error("Payment link is unavailable.");
      window.location.assign(result.url);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Checkout failed. Please retry.",
      );
      setSaving(false);
    }
  }
  return (
    <div className="page-container">
      <Link className="back-link" href="/cart">
        ← Back to your bag
      </Link>
      <p className="eyebrow">ONE MORE STEP TO SOMETHING GOOD</p>
      <h1>Checkout.</h1>
      <p className="page-intro">
        Your details. Your delivery. A secure payment.
      </p>
      {!shop.ready ? (
        <p>Loading checkout…</p>
      ) : !shop.cart.length ? (
        <div className="empty-state">
          <h2>Your bag is empty.</h2>
          <Link href="/" className="button dark">
            Explore the shop ↗
          </Link>
        </div>
      ) : (
        <div className="two-column">
          <section>
            {!shop.user ? (
              <div className="form-card">
                <span className="step-number">01</span>
                <h2>Make yourself at home.</h2>
                <p>
                  Sign in with Google to save your bag, track orders and check
                  out.
                </p>
                <button className="button dark" onClick={shop.signIn}>
                  Continue with Google ↗
                </button>
              </div>
            ) : (
              <form className="form-card" onSubmit={submit}>
                <span className="step-number">01</span>
                <h2>Where should we deliver?</h2>
                <p className="muted">
                  Your payment receipt will go to {shop.user.email}.
                </p>
                {(
                  [
                    ["name", "Full name", "text", 100],
                    ["phone", "Phone number", "tel", 30],
                    ["address", "Delivery address", "text", 300],
                    ["city", "City / State", "text", 100],
                  ] as const
                ).map(([key, label, type, max]) => (
                  <label className="field" key={key}>
                    <span>{label}</span>
                    <input
                      required
                      minLength={
                        key === "name" || key === "city"
                          ? 2
                          : key === "phone"
                            ? 7
                            : 5
                      }
                      maxLength={max}
                      autoComplete={
                        key === "name"
                          ? "name"
                          : key === "phone"
                            ? "tel"
                            : key === "address"
                              ? "street-address"
                              : "address-level2"
                      }
                      type={type}
                      value={details[key]}
                      onChange={(e) =>
                        setDetails({ ...details, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <div className="payment-info">
                  <span className="step-number">02</span>
                  <h2>Pay securely with Paystack.</h2>
                  <p>
                    Choose from the payment methods available on Paystack’s
                    secure checkout. We’ll confirm your order after payment is
                    verified.
                  </p>
                </div>
                {error && (
                  <p className="error inline-error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="button dark full"
                  disabled={saving || shop.busy}
                  type="submit"
                >
                  {saving
                    ? "Opening secure checkout…"
                    : "Continue to payment ↗"}
                </button>
              </form>
            )}
          </section>
          <OrderSummary />
        </div>
      )}
    </div>
  );
}
