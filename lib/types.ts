export type Product = {
  id: string;
  name: string;
  category: string;
  description: string;
  price_kobo: number;
  image_url: string;
  active: boolean;
};
export type CartItem = {
  product_id: string;
  quantity: number;
  product: Product;
};
export type Order = {
  id: string;
  reference: string;
  name: string;
  email: string;
  address: string;
  city: string;
  phone: string;
  total_kobo: number;
  shipping_kobo: number;
  currency: string;
  status: string;
  created_at: string;
  user_id: string;
  authorization_url: string | null;
};
export type OrderItem = {
  product_id: string;
  name: string;
  quantity: number;
  unit_price_kobo: number;
};
export function money(kobo: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);
}
export function shipping(subtotal: number) {
  return subtotal >= 5000000 || subtotal === 0 ? 0 : 250000;
}
