import type { Metadata } from "next";
import { CartPageClient } from "@/components/cart/cart-page";
import { repo } from "@/lib/data";

export const metadata: Metadata = { title: "Sepetim", robots: { index: false } };

export default async function CartPage() {
  const settings = await repo.getSettings();
  return (
    <div className="container-x py-10">
      <h1 className="mb-8 text-4xl">Sepetim</h1>
      <CartPageClient threshold={settings.freeShippingThreshold} />
    </div>
  );
}
