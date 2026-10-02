"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient, User } from "@supabase/supabase-js";

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
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const total = cart.reduce((sum, item) => sum + item.price, 0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cart");
      if (saved) setCart(JSON.parse(saved));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart, loaded]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-yellow-600 px-8 py-5 flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-yellow-500 tracking-widest">MY SHOP</h1>
        <div className="flex items-center gap-4 text-yellow-500 text-sm">
          <span>🛒 {cart.length} items</span>
          {user ? (
            <>
              <span className="hidden sm:inline">{user.email}</span>
              <button
                onClick={() => supabase.auth.signOut()}
                className="border border-yellow-600 rounded px-3 py-1"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={signIn}
              className="bg-yellow-500 text-black font-semibold rounded px-3 py-1"
            >
              Sign in with Google
            </button>
          )}
        </div>
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

          {cart.length === 0 ? (
            <button
              disabled
              className="mt-4 w-full bg-yellow-500 text-black font-semibold rounded-lg py-2 opacity-40"
            >
              Checkout
            </button>
          ) : (
            <Link
              href="/checkout"
              className="mt-4 block text-center w-full bg-yellow-500 text-black font-semibold rounded-lg py-2"
            >
              Go to checkout
            </Link>
          )}
        </aside>
      </div>
    </main>
  );
}