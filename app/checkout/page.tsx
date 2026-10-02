"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient, User } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type Item = { id: number; name: string; price: number; emoji: string };

export default function Checkout() {
  const [cart, setCart] = useState<Item[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const total = cart.reduce((sum, item) => sum + item.price, 0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cart");
      if (saved) setCart(JSON.parse(saved));
    } catch {}
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) {
        setEmail(u.email ?? "");
        setName(u.user_metadata?.full_name ?? "");
      }
      setReady(true);
    });
  }, []);

  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/checkout" },
    });
  }

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
      user_id: user?.id ?? null,
    });
    if (error) {
      setSaving(false);
      setError("Could not save order: " + error.message);
      return;
    }
    await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, items: cart, total }),
    });
    localStorage.removeItem("cart");
    setSaving(false);
    setDone(true);
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-yellow-600 px-8 py-5 flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold text-yellow-500 tracking-widest">
          MY SHOP
        </Link>
        <Link href="/" className="text-yellow-500 text-sm">← Back to shop</Link>
      </header>

      <div className="max-w-2xl mx-auto p-8">
        <h2 className="text-3xl font-bold text-yellow-500 mb-6">Checkout</h2>

        {done ? (
          <div className="bg-zinc-900 border border-yellow-700 rounded-xl p-6">
            <p className="text-green-400 text-lg">
              ✅ Thanks {name}! Your order is placed. A confirmation was sent to {email}.
            </p>
            <Link href="/" className="inline-block mt-4 bg-yellow-500 text-black font-semibold rounded-lg px-4 py-2">
              Continue shopping
            </Link>
          </div>
        ) : !ready ? (
          <p className="text-gray-400">Loading...</p>
        ) : cart.length === 0 ? (
          <div className="bg-zinc-900 border border-yellow-700 rounded-xl p-6">
            <p className="text-gray-300">Your cart is empty.</p>
            <Link href="/" className="inline-block mt-4 bg-yellow-500 text-black font-semibold rounded-lg px-4 py-2">
              Back to shop
            </Link>
          </div>
        ) : !user ? (
          <div className="bg-zinc-900 border border-yellow-700 rounded-xl p-6">
            <p className="mb-4">Please sign in to complete your order.</p>
            <button onClick={signIn} className="bg-yellow-500 text-black font-semibold rounded-lg px-4 py-2">
              Sign in with Google
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            <section className="bg-zinc-900 border border-yellow-700 rounded-xl p-6">
              <h3 className="text-xl font-bold text-yellow-500 mb-4">Order summary</h3>
              {cart.map((item, i) => (
                <div key={i} className="flex justify-between py-1">
                  <span>{item.emoji} {item.name}</span>
                  <span className="text-yellow-400">${item.price}</span>
                </div>
              ))}
              <hr className="my-4 border-yellow-800" />
              <div className="flex justify-between font-bold text-lg text-yellow-500">
                <span>Total</span>
                <span>${total}</span>
              </div>
            </section>

            <section className="bg-zinc-900 border border-yellow-700 rounded-xl p-6 space-y-3">
              <h3 className="text-xl font-bold text-yellow-500">Your details</h3>
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
            </section>
          </div>
        )}
      </div>
    </main>
  );
}