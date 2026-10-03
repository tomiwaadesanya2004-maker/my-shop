"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useShop } from "@/components/shop-provider";
import { money } from "@/lib/types";
export default function Home() {
  const shop = useShop();
  const [category, setCategory] = useState("All"),
    [search, setSearch] = useState("");
  const products = shop.products.filter(
    (p) =>
      (category === "All" || p.category === category) &&
      (p.name + " " + p.description)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">THE EVERYDAY COLLECTION / 01</p>
          <h1>
            Your everyday.
            <br />
            <em>Elevated.</em>
          </h1>
          <p>
            Easy layers. Fresh steps. Little essentials.
            <br />
            Good things you’ll reach for, again and again.
          </p>
          <a className="button dark" href="#collection">
            Explore the collection <span>↗</span>
          </a>
          <div className="hero-caption">
            <span>Thoughtfully chosen</span>
            <span>Made to go everywhere</span>
          </div>
        </div>
        <div className="hero-art">
          <div className="hero-circle" />
          <Image
            unoptimized
            src="/products/sneakers.svg"
            alt="Court sneakers from the everyday collection"
            width={600}
            height={480}
          />
          <span className="hero-label">
            THE COURT SNEAKER
            <br />
            <strong>Every step, a fresh start.</strong>
          </span>
          <span className="edition">EVERYDAY ESSENTIALS</span>
        </div>
      </section>
      <div className="benefits">
        <span>
          ↗ <strong>Everyday quality</strong> · Carefully selected
        </span>
        <span>
          ◇ <strong>Secure checkout</strong> · Powered by Paystack
        </span>
        <span>
          ⊞ <strong>Delivered to you</strong> · Across Nigeria
        </span>
      </div>
      <section id="collection" className="collection">
        <div className="section-heading">
          <div>
            <p className="eyebrow">LESS SEARCHING. MORE LIVING.</p>
            <h2>Find your next favourite.</h2>
          </div>
          <label className="search">
            <span className="sr-only">Search products</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search the collection"
              type="search"
            />
          </label>
        </div>
        <div className="collection-tools">
          <div className="filters" aria-label="Product categories">
            {["All", "Clothing", "Footwear", "Accessories"].map((c) => (
              <button
                key={c}
                aria-pressed={category === c}
                className={category === c ? "active" : ""}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <span>{products.length} essentials</span>
        </div>
        {!shop.ready ? (
          <div className="product-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <h3>No products found.</h3>
            <p>
              {shop.error
                ? "The collection will appear when your database is configured."
                : "Try another search or category."}
            </p>
          </div>
        ) : (
          <div className="product-grid">
            {products.map((p, index) => (
              <article className="product-card" key={p.id}>
                <div className={"product-image tone-" + (index % 3)}>
                  <span className="product-tag">{p.category}</span>
                  <Image
                    unoptimized
                    src={p.image_url}
                    alt={p.name}
                    width={480}
                    height={400}
                  />
                </div>
                <div className="product-title">
                  <h3>{p.name}</h3>
                  <span>{money(p.price_kobo)}</span>
                </div>
                <p>{p.description}</p>
                <button
                  className={
                    shop.cart.some((i) => i.product_id === p.id)
                      ? "add-button added"
                      : "add-button"
                  }
                  disabled={
                    shop.busy ||
                    (shop.cart.find((i) => i.product_id === p.id)?.quantity ||
                      0) >= 99
                  }
                  onClick={() =>
                    shop.quantity(
                      p.id,
                      (shop.cart.find((i) => i.product_id === p.id)?.quantity ||
                        0) + 1,
                    )
                  }
                >
                  {shop.cart.some((i) => i.product_id === p.id)
                    ? "Added to cart (" +
                      shop.cart.find((i) => i.product_id === p.id)!.quantity +
                      ")"
                    : "Add to cart"}
                  <span aria-hidden="true">
                    {shop.cart.some((i) => i.product_id === p.id) ? "✓" : "+"}
                  </span>
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="closing-card">
        <p className="eyebrow">A GOOD DAY STARTS WITH THE LITTLE THINGS.</p>
        <h2>
          Keep it simple.
          <br />
          Make it yours.
        </h2>
        <Link href="/cart" className="button dark">
          See what’s in your bag ↗
        </Link>
      </section>
    </>
  );
}
