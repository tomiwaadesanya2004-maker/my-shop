"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { browserDb } from "@/lib/supabase";
import type { CartItem, Product } from "@/lib/types";
type Shop = {
  user: User | null;
  ready: boolean;
  busy: boolean;
  products: Product[];
  cart: CartItem[];
  error: string;
  notice: string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  quantity: (id: string, quantity: number) => Promise<void>;
  reload: () => Promise<void>;
  api: (path: string, body: unknown) => Promise<Record<string, unknown>>;
};
const Context = createContext<Shop | null>(null);
const guestKey = "my-shop-guest-cart-v1";
function guestItems(): { product_id: string; quantity: number }[] {
  try {
    const value = JSON.parse(localStorage.getItem(guestKey) || "[]");
    return Array.isArray(value)
      ? value
          .slice(0, 50)
          .filter(
            (i) =>
              i &&
              typeof i.product_id === "string" &&
              Number.isInteger(i.quantity) &&
              i.quantity > 0 &&
              i.quantity <= 99,
          )
      : [];
  } catch {
    return [];
  }
}
export function ShopProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  const [products, setProducts] = useState<Product[]>([]),
    [cart, setCart] = useState<CartItem[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const userRef = useRef<User | null>(null),
    cartRef = useRef<CartItem[]>([]),
    catalog = useRef<Product[]>([]),
    working = useRef(false);
  const updateCart = useCallback((items: CartItem[]) => {
    cartRef.current = items;
    setCart(items);
  }, []);
  const loadCart = useCallback(
    async (current: User | null) => {
      if (!current) {
        const items: CartItem[] = [];
        for (const row of guestItems()) {
          const product = catalog.current.find((p) => p.id === row.product_id);
          if (product && !items.some((i) => i.product_id === product.id))
            items.push({ ...row, product });
        }
        updateCart(items);
        return;
      }
      const db = browserDb();
      const { data, error } = await db
        .from("shop_cart_items")
        .select("product_id,quantity")
        .eq("user_id", current.id);
      if (error) throw error;
      if (userRef.current?.id !== current.id) return;
      const unavailable = (data || []).filter(
        (row) => !catalog.current.some((p) => p.id === row.product_id),
      );
      if (unavailable.length) {
        const { error: removeError } = await db
          .from("shop_cart_items")
          .delete()
          .eq("user_id", current.id)
          .in(
            "product_id",
            unavailable.map((row) => row.product_id),
          );
        if (removeError) throw removeError;
        setNotice("An unavailable product was removed from your saved bag.");
      }
      const items = (data || [])
        .map((row) => ({
          ...row,
          product: catalog.current.find((p) => p.id === row.product_id),
        }))
        .filter((row) => row.product) as CartItem[];
      for (const row of guestItems()) {
        if (userRef.current?.id !== current.id) return;
        const product = catalog.current.find((p) => p.id === row.product_id);
        if (!product) continue;
        const existing = items.find((i) => i.product_id === product.id);
        const quantity = Math.max(row.quantity, existing?.quantity || 0);
        const { error } = await db.from("shop_cart_items").upsert({
          user_id: current.id,
          product_id: product.id,
          quantity,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        if (existing) existing.quantity = quantity;
        else items.push({ product_id: product.id, quantity, product });
      }
      if (userRef.current?.id !== current.id) return;
      localStorage.removeItem(guestKey);
      updateCart(items);
    },
    [updateCart],
  );
  useEffect(() => {
    let live = true;
    let unsubscribe = () => {};
    async function initialize() {
      try {
        const db = browserDb();
        const { data, error } = await db
          .from("shop_products")
          .select("*")
          .eq("active", true)
          .order("created_at");
        if (error) throw error;
        if (!live) return;
        catalog.current = data as Product[];
        setProducts(catalog.current);
        const { data: session, error: sessionError } =
          await db.auth.getSession();
        if (sessionError) throw sessionError;
        if (!live) return;
        userRef.current = session.session?.user || null;
        setUser(userRef.current);
        await loadCart(userRef.current);
        if (!live) return;
        const { data: listener } = db.auth.onAuthStateChange(
          (_event, session) => {
            const next = session?.user || null;
            if (next?.id === userRef.current?.id) return;
            userRef.current = next;
            setUser(next);
            updateCart([]);
            setReady(false);
            setTimeout(() => {
              if (live)
                void loadCart(next)
                  .catch(() =>
                    setError(
                      "Could not load your saved bag. Refresh to retry.",
                    ),
                  )
                  .finally(() => setReady(true));
            }, 0);
          },
        );
        unsubscribe = () => listener.subscription.unsubscribe();
      } catch {
        if (live)
          setError(
            "Cannot connect to the shop. Check Supabase configuration and run the database migration, then refresh.",
          );
      } finally {
        if (live) setReady(true);
      }
    }
    void initialize();
    return () => {
      live = false;
      unsubscribe();
    };
  }, [loadCart, updateCart]);
  async function quantity(id: string, count: number) {
    if (!ready || working.current) return;
    const product = catalog.current.find((p) => p.id === id);
    if (!product || !Number.isInteger(count) || count < 0 || count > 99) return;
    working.current = true;
    const accountId = userRef.current?.id;
    setBusy(true);
    setError("");
    try {
      if (userRef.current) {
        const db = browserDb();
        const result = count
          ? await db.from("shop_cart_items").upsert({
              user_id: accountId,
              product_id: id,
              quantity: count,
              updated_at: new Date().toISOString(),
            })
          : await db
              .from("shop_cart_items")
              .delete()
              .eq("user_id", accountId)
              .eq("product_id", id);
        if (result.error) throw result.error;
      }
      if (userRef.current?.id !== accountId) return;
      const next = cartRef.current.filter((i) => i.product_id !== id);
      if (count) next.push({ product_id: id, quantity: count, product });
      if (!userRef.current)
        localStorage.setItem(
          guestKey,
          JSON.stringify(
            next.map(({ product_id, quantity }) => ({ product_id, quantity })),
          ),
        );
      updateCart(next);
      setNotice(
        count ? "Your bag has been updated." : "Item removed from your bag.",
      );
      sessionStorage.removeItem("my-shop-checkout");
    } catch {
      setError("Could not save your bag. Please try again.");
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function signIn() {
    try {
      const { error } = await browserDb().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo:
            window.location.origin +
            window.location.pathname +
            window.location.search,
        },
      });
      if (error) throw error;
    } catch {
      setError(
        "Google sign-in is unavailable. Check the Google provider configuration.",
      );
    }
  }
  async function signOut() {
    try {
      const { error } = await browserDb().auth.signOut();
      if (error) throw error;
      sessionStorage.removeItem("my-shop-checkout");
    } catch {
      setError("Could not sign out. Please try again.");
    }
  }
  async function api(path: string, body: unknown) {
    const { data } = await browserDb().auth.getSession();
    if (!data.session) throw new Error("Please sign in to continue.");
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + data.session.access_token,
      },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Request failed. Please retry.");
    return result;
  }
  return (
    <Context.Provider
      value={{
        user,
        ready,
        busy,
        products,
        cart,
        error,
        notice,
        signIn,
        signOut,
        quantity,
        reload: () => loadCart(userRef.current),
        api,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useShop() {
  const shop = useContext(Context);
  if (!shop) throw new Error("ShopProvider is required");
  return shop;
}
