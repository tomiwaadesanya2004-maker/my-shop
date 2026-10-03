"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useShop } from "./shop-provider";
export function ShopShell({ children }: { children: React.ReactNode }) {
  const shop = useShop(),
    path = usePathname();
  const count = shop.cart.reduce((sum, i) => sum + i.quantity, 0);
  return (
    <>
      <div className="announcement">
        A little everyday, a little extraordinary.{" "}
        <span>Free delivery on orders ₦50,000+</span>
      </div>
      <header className="site-header">
        <Link className="brand" href="/">
          MY SHOP<span className="brand-dot">.</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link aria-current={path === "/" ? "page" : undefined} href="/">
            Shop
          </Link>
          <Link
            aria-current={path === "/orders" ? "page" : undefined}
            href="/orders"
          >
            Orders
          </Link>
        </nav>
        <div className="header-actions">
          {shop.user ? (
            <button className="text-button account" onClick={shop.signOut}>
              Sign out
            </button>
          ) : (
            <button className="text-button account" onClick={shop.signIn}>
              Sign in with Google
            </button>
          )}
          <Link href="/cart" className="bag-link">
            Bag <span>{count}</span>
          </Link>
        </div>
      </header>
      {shop.error && (
        <div role="alert" className="banner error">
          {shop.error}
        </div>
      )}
      <p className="sr-only" role="status">
        {shop.notice}
      </p>
      <main>{children}</main>
      <footer className="site-footer">
        <div>
          <Link className="brand" href="/">
            MY SHOP.
          </Link>
          <p>Good things for your everyday.</p>
        </div>
        <p>
          Secure payments with Paystack
          <br />
          Made for everyday living · Nigeria
        </p>
        <Link href="/orders">Track your orders ↗</Link>
      </footer>
    </>
  );
}
