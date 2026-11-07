import Link from "next/link";
import { Search, User } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { CartButton } from "@/components/cart/cart-button";
import { MobileNav } from "./mobile-nav";
import type { Category } from "@/lib/types";

export function Header({ categories, announcement }: { categories: Category[]; announcement: string }) {
  const top = categories.filter((c) => !c.parentId);
  const navItems = [
    ...top.map((c) => ({
      href: `/kategori/${c.slug}`,
      label: c.name,
      children: categories.filter((x) => x.parentId === c.id).map((x) => ({ href: `/kategori/${x.slug}`, label: x.name })),
    })),
    { href: "/kategori/indirim", label: "İndirim", children: [] },
  ];
  return (
    <>
      <div role="region" aria-label="Duyuru" className="bg-ink px-4 py-2 text-center text-[12px] tracking-wide text-white">{announcement}</div>
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/85">
        <div className="container-x flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-2 lg:hidden">
            <MobileNav items={navItems} />
          </div>
          <Logo />
          <nav aria-label="Ana menü" className="hidden lg:block">
            <ul className="flex items-center gap-7 text-[13px] font-medium tracking-wide">
              <li>
                <Link href="/kategori/yeni" className="hover:text-rose">
                  Yeni Gelenler
                </Link>
              </li>
              {navItems.map((n) => (
                <li key={n.href} className="group relative">
                  <Link href={n.href} className="py-5 hover:text-rose">
                    {n.label}
                  </Link>
                  {n.children.length > 0 && (
                    <div className="invisible absolute left-1/2 top-full z-50 min-w-48 -translate-x-1/2 border border-line bg-white p-2 opacity-0 shadow-sm transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                      {n.children.map((c) => (
                        <Link key={c.href} href={c.href} className="block px-3 py-2 text-sm font-normal hover:bg-canvas">
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center gap-1">
            <Link href="/arama" className="btn-ghost !px-2.5" aria-label="Ara">
              <Search className="h-5 w-5" strokeWidth={1.5} />
            </Link>
            <Link href="/hesabim" className="btn-ghost !px-2.5 max-sm:hidden" aria-label="Hesabım">
              <User className="h-5 w-5" strokeWidth={1.5} />
            </Link>
            <CartButton />
          </div>
        </div>
      </header>
    </>
  );
}
