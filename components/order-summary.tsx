"use client";
import { useShop } from "./shop-provider";
import { money, shipping } from "@/lib/types";
export function OrderSummary({ children }: { children?: React.ReactNode }) {
  const { cart } = useShop();
  const subtotal = cart.reduce(
      (sum, i) => sum + i.product.price_kobo * i.quantity,
      0,
    ),
    delivery = shipping(subtotal);
  return (
    <aside className="summary">
      <p className="eyebrow">THE GOOD THINGS, ALL TOGETHER</p>
      <h2>Order summary</h2>
      <div className="summary-lines">
        {cart.map((i) => (
          <div key={i.product_id}>
            <span>
              {i.product.name} × {i.quantity}
            </span>
            <strong>{money(i.quantity * i.product.price_kobo)}</strong>
          </div>
        ))}
      </div>
      <div className="summary-row">
        <span>Subtotal</span>
        <span>{money(subtotal)}</span>
      </div>
      <div className="summary-row">
        <span>Delivery</span>
        <span>{delivery ? money(delivery) : "Free"}</span>
      </div>
      <div className="summary-row total">
        <span>Total</span>
        <strong>{money(subtotal + delivery)}</strong>
      </div>
      <p className="muted">
        Free delivery on orders ₦50,000 and above. Your final total is confirmed
        securely at checkout.
      </p>
      {children}
      <p className="secure-note">◇ Encrypted checkout · Powered by Paystack</p>
    </aside>
  );
}
