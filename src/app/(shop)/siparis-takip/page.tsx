import type { Metadata } from "next";
import { OrderLookupForm } from "@/components/account/forms";

export const metadata: Metadata = { title: "Sipariş Takibi", robots: { index: false } };

export default async function OrderLookupPage({ searchParams }: { searchParams: Promise<{ no?: string }> }) {
  const { no = "" } = await searchParams;
  return (
    <div className="container-x py-12">
      <h1 className="mb-2 text-center text-4xl">Sipariş Takibi</h1>
      <p className="mb-8 text-center text-ink-soft">Sipariş numaranızı ve e-posta adresinizi girin.</p>
      <OrderLookupForm defaultNo={no.slice(0, 20)} />
    </div>
  );
}
