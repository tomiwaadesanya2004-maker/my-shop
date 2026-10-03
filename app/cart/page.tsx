"use client";
import Link from "next/link";
import Image from "next/image";
import { useShop } from "@/components/shop-provider";
import { OrderSummary } from "@/components/order-summary";
import { money } from "@/lib/types";
export default function CartPage() {
  const shop = useShop();
  return (
    <div className="page-container">
      <p className="eyebrow">YOUR EVERYDAY, IN THE MAKING</p>
      <h1>
        Your bag
        <span className="heading-count">
          {shop.cart.reduce((s, i) => s + i.quantity, 0)}
        </span>
      </h1>
      <p className="page-intro">A few good things, ready to go.</p>
      {!shop.ready ? (
        <p>Loading your bag…</p>
      ) : !shop.cart.length ? (
        <div className="empty-state">
          <h2>Your bag is waiting for something good.</h2>
          <p>Explore the collection and find your next everyday favourite.</p>
          <Link className="button dark" href="/">
            Explore the shop ↗
          </Link>
        </div>
      ) : (
        <div className="two-column">
          <section>
            {shop.cart.map((i) => (
              <article className="cart-line" key={i.product_id}>
                <div className="cart-image">
                  <Image
                    unoptimized
                    src={i.product.image_url}
                    alt={i.product.name}
                    width={160}
                    height={140}
                  />
                </div>
                <div className="cart-details">
                  <span className="eyebrow">{i.product.category}</span>
                  <h2>{i.product.name}</h2>
                  <p>{money(i.product.price_kobo)} each</p>
                  <div className="quantity">
                    <button
                      aria-label={"Decrease " + i.product.name + " quantity"}
                      disabled={shop.busy}
                      onClick={() =>
                        shop.quantity(i.product_id, i.quantity - 1)
                      }
                    >
                      −
                    </button>
                    <span>{i.quantity}</span>
                    <button
                      aria-label={"Increase " + i.product.name + " quantity"}
                      disabled={shop.busy || i.quantity >= 99}
                      onClick={() =>
                        shop.quantity(i.product_id, i.quantity + 1)
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="cart-price">
                  <strong>{money(i.product.price_kobo * i.quantity)}</strong>
                  <button
                    disabled={shop.busy}
                    className="text-button"
                    onClick={() => shop.quantity(i.product_id, 0)}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
            <Link className="back-link" href="/">
              ← Continue shopping
            </Link>
            <p className="muted">
              {shop.user
                ? "Your bag is saved to your account."
                : "Sign in at checkout to save this bag to your account."}
            </p>
          </section>
          <OrderSummary>
            <Link className="button dark full" href="/checkout">
              Continue to checkout ↗
            </Link>
          </OrderSummary>
        </div>
      )}
    </div>
  );
}
