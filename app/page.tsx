"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

const products = [
  { id: 1, name: "T-Shirt", price: 15, emoji: "👕" },
  { id: 2, name: "Sneakers", price: 60, emoji: "👟" },
  { id: 3, name: "Cap", price: 10, emoji: "🧢" },
];

export default function Home() {
  const [cart, setCart] = useState<typeof products>([]);
  const total = cart.reduce((sum, item) => sum + item.price, 0);
  const [checkout, setCheckout] = useState(false);
  const [done, setDone] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function placeOrder() {
    if (!name || !email) {
      setError("Please enter your name and email.");
      return;
    }
    setSaving(true);
    setError("");
    const { error } = await supabase.from("orders").insert({
      name,
      email,
      items: cart,
      total,
    });
    setSaving(false);
    if (error) {
      setError("Could not save order: " + error.message);
    } else {
      await fetch("/api/send-email", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name, email, items: cart, total }),
});
setDone(true);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-yellow-600 px-8 py-5 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-yellow-500 tracking-widest">
          MY SHOP
        </h1>
        <span className="text-yellow-500">🛒 {cart.length} items</span>
      </header>

      <div className="max-w-5xl mx-auto p-8 grid md:grid-cols-3 gap-6">
        <section className="md:col-span-2 grid sm:grid-cols-2 gap-6">
          {products.map((p) => (
            <div
              key={p.id}
              className="bg-zinc-900 border border-yellow-700 rounded-xl p-6 text-center hover:border-yellow-400"
            >
              <div className="text-7xl mb-4">{p.emoji}</div>
              <h2 className="text-lg font-semibold text-yellow-400">{p.name}</h2>
              <p className="text-gray-300 mb-4">${p.price}</p>
              <button
                onClick={() => setCart([...cart, p])}
                className="w-full bg-yellow-500 text-black font-semibold rounded-lg py-2 hover:bg-yellow-400"
              >
                Add to cart
              </button>
            </div>
          ))}
        </section>

        <aside className="bg-zinc-900 border border-yellow-700 rounded-xl p-6 h-fit">
          <h2 className="text-xl font-bold text-yellow-500 mb-4">Your Cart</h2>
          {cart.length === 0 && <p className="text-gray-500">Cart is empty</p>}
          {cart.map((item, i) => (
            <div key={i} className="flex justify-between py-1">
              <span>{item.name}</span>
              <span className="text-yellow-400">${item.price}</span>
            </div>
          ))}
          <hr className="my-4 border-yellow-800" />
          <div className="flex justify-between font-bold text-lg text-yellow-500">
            <span>Total</span>
            <span>${total}</span>
          </div>

          {done ? (
            <p className="mt-4 text-green-400">
              ✅ Thanks {name}! Order saved. A confirmation will be sent to {email}.
            </p>
          ) : checkout ? (
            <div className="mt-4 space-y-3">
              <input
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 rounded bg-black border border-yellow-700"
              />
              <input
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 rounded bg-black border border-yellow-700"
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                onClick={placeOrder}
                disabled={saving}
                className="w-full bg-yellow-500 text-black font-semibold rounded-lg py-2 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Place order"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCheckout(true)}
              disabled={cart.length === 0}
              className="mt-4 w-full bg-yellow-500 text-black font-semibold rounded-lg py-2 disabled:opacity-40"
            >
              Checkout
            </button>
          )}
        </aside>
      </div>
    </main>
  );
}