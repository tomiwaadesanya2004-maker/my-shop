import type { Metadata } from "next";
import { ShopProvider } from "@/components/shop-provider";
import { ShopShell } from "@/components/shop-shell";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "My Shop — Good things for your everyday",
    template: "%s | My Shop",
  },
  description:
    "Thoughtfully chosen clothing, footwear and accessories. Secure Paystack checkout.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ShopProvider>
          <ShopShell>{children}</ShopShell>
        </ShopProvider>
      </body>
    </html>
  );
}
