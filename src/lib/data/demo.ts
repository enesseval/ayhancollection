import "server-only";
import { randomUUID } from "node:crypto";
import {
  seedCategories,
  seedCoupons,
  seedProducts,
  seedSettings,
  seedUuid,
} from "../seed/catalog";
import type { Category, Coupon, DashboardStats, Order, OrderStatus, Product, Settings, SizeChart } from "../types";
import { StockError, type CreateOrderInput, type ProductInput, type Repo } from "./repo";
import { filterProducts, newOrderNo } from "./shared";

// Bellek içi demo veri deposu. Sunucu örneği yeniden başladığında seed haline döner.
// Supabase ortam değişkenleri girildiğinde bu sürücü devre dışı kalır.

type Store = {
  products: Product[];
  coupons: Coupon[];
  settings: Settings;
  orders: Order[];
  reservations: { orderId: string; variantId: string; qty: number; expiresAt: number }[];
  audit: { at: string; actor: string; action: string; entity: string; entityId: string }[];
  paymentTokens: Map<string, string>;
  sizeCharts: SizeChart[];
  categories: Category[];
};

const g = globalThis as unknown as { __aacStore?: Store };

function clone<T>(v: T): T {
  return structuredClone(v);
}

function sampleOrders(products: Product[]): Order[] {
  const mk = (i: number, status: OrderStatus, method: "card" | "transfer", daysAgo: number): Order => {
    const p = products[i % products.length];
    const v = p.variants.find((x) => x.stock > 0) ?? p.variants[0];
    const qty = 1 + (i % 2);
    const subtotal = p.basePrice * qty;
    const shipping = subtotal >= seedSettings.freeShippingThreshold ? 0 : seedSettings.shippingFee;
    const created = new Date(Date.now() - daysAgo * 86400000 - i * 3600000).toISOString();
    return {
      id: seedUuid("order:" + i),
      orderNo: `AA-2611-DEMO${i}`,
      userId: null,
      email: `musteri${i}@example.com`,
      phone: "05xx xxx xx " + String(10 + i),
      status,
      paymentMethod: method,
      subtotal,
      discount: 0,
      shipping,
      total: subtotal + shipping,
      couponCode: null,
      shippingAddress: {
        fullName: ["Elif Yılmaz", "Zeynep Kaya", "Fatma Demir", "Merve Şahin", "Hatice Çelik"][i % 5],
        phone: "05xx xxx xx " + String(10 + i),
        city: ["İstanbul", "Ankara", "Eskişehir", "İzmir", "Bursa"][i % 5],
        district: ["Üsküdar", "Çankaya", "Odunpazarı", "Bornova", "Nilüfer"][i % 5],
        line: "Örnek Mah. Demo Sok. No: " + (i + 3),
      },
      note: null,
      items: [
        {
          variantId: v.id,
          productId: p.id,
          productName: p.name,
          productSlug: p.slug,
          sku: v.sku,
          size: v.size,
          color: v.color,
          unitPrice: p.basePrice,
          qty,
          imageKey: p.media[0]?.key ?? null,
        },
      ],
      payment:
        method === "card"
          ? { provider: "demo", paymentId: "demo-" + i, status: "success", installment: 1, cardLast4: "0008", paidAt: created }
          : null,
      carrier: status === "shipped" || status === "delivered" ? "Yurtiçi Kargo" : null,
      trackingNo: status === "shipped" || status === "delivered" ? "DEMO" + (100000 + i) : null,
      consents: { contractVersion: "2026-11-04", acceptedAt: created, ip: null, marketing: false },
      utm: i % 2 ? { utm_source: "instagram", utm_medium: "reels" } : null,
      reservationExpiresAt: null,
      createdAt: created,
      updatedAt: created,
    };
  };
  return [
    mk(0, "paid", "card", 0),
    mk(3, "awaiting_transfer", "transfer", 0),
    mk(5, "preparing", "card", 1),
    mk(8, "shipped", "card", 2),
    mk(9, "delivered", "card", 6),
    mk(13, "delivered", "card", 9),
  ];
}

function store(): Store {
  if (!g.__aacStore) {
    const products = clone(seedProducts);
    g.__aacStore = {
      products,
      coupons: clone(seedCoupons),
      settings: clone(seedSettings),
      sizeCharts: [],
      categories: clone(seedCategories).map((c) => ({ ...c, isActive: true })),
      orders: sampleOrders(products),
      reservations: [],
      audit: [],
      paymentTokens: new Map(),
    };
  }
  return g.__aacStore;
}

function audit(actor: string, action: string, entity: string, entityId: string) {
  const s = store();
  s.audit.unshift({ at: new Date().toISOString(), actor, action, entity, entityId });
  s.audit.length = Math.min(s.audit.length, 500);
}

function categoryIdsFor(slug: string): string[] | null {
  const cats = store().categories.filter((c) => c.isActive !== false);
  const cat = cats.find((c) => c.slug === slug);
  if (!cat) return [];
  return [cat.id, ...cats.filter((c) => c.parentId === cat.id).map((c) => c.id)];
}

function restock(order: Order) {
  const s = store();
  if (order.couponCode) {
    const c = s.coupons.find((x) => x.code === order.couponCode);
    if (c) c.usedCount = Math.max(0, c.usedCount - 1);
  }
  for (const r of s.reservations.filter((x) => x.orderId === order.id)) {
    const p = s.products.find((pp) => pp.variants.some((v) => v.id === r.variantId));
    const v = p?.variants.find((vv) => vv.id === r.variantId);
    if (v) v.stock += r.qty;
  }
  s.reservations = s.reservations.filter((x) => x.orderId !== order.id);
}

export const demoRepo: Repo = {
  kind: "demo",

  async listCategories() {
    return clone(store().categories.filter((c) => c.isActive !== false)).sort((a, b) => a.sort - b.sort);
  },

  async listAllCategories() {
    const s = store();
    return clone(s.categories)
      .sort((a, b) => a.sort - b.sort)
      .map((c) => ({ ...c, productCount: s.products.filter((p) => p.categoryId === c.id && p.status !== "archived").length }));
  },

  async upsertCategory(c, actorId) {
    const s = store();
    if (s.categories.some((x) => x.slug === c.slug && x.id !== c.id)) throw new Error("Bu adres başka bir kategoride kullanılıyor.");
    const existing = c.id ? s.categories.find((x) => x.id === c.id) : undefined;
    if (existing) {
      Object.assign(existing, { name: c.name, slug: c.slug, parentId: c.parentId, description: c.description || undefined, isActive: c.isActive });
      audit(actorId, "update", "category", c.slug);
      return clone(existing);
    }
    const sort = s.categories.filter((x) => x.parentId === c.parentId).reduce((m, x) => Math.max(m, x.sort), 0) + 10;
    const cat: Category = { id: randomUUID(), name: c.name, slug: c.slug, parentId: c.parentId, description: c.description || undefined, isActive: c.isActive, sort };
    s.categories.push(cat);
    audit(actorId, "create", "category", c.slug);
    return clone(cat);
  },

  async deleteCategory(id, actorId) {
    const s = store();
    if (s.products.some((p) => p.categoryId === id)) throw new Error("Bu kategoride ürün var (arşivdekiler dahil). Önce ürünleri başka kategoriye taşıyın ya da kategoriyi gizleyin.");
    if (s.categories.some((c) => c.parentId === id)) throw new Error("Bu kategorinin alt kategorileri var. Önce onları silin ya da başka kategoriye taşıyın.");
    s.categories = s.categories.filter((c) => c.id !== id);
    audit(actorId, "delete", "category", id);
  },

  async reorderCategories(ids, actorId) {
    const s = store();
    ids.forEach((id, i) => {
      const c = s.categories.find((x) => x.id === id);
      if (c) c.sort = (i + 1) * 10;
    });
    audit(actorId, "reorder", "category", ids.length + " kategori");
  },

  async listProducts(q = {}) {
    const ids = q.categorySlug ? categoryIdsFor(q.categorySlug) : null;
    const s = store();
    const paidLike: OrderStatus[] = ["paid", "preparing", "shipped", "delivered"];
    const sold = new Map<string, number>();
    for (const o of s.orders) if (paidLike.includes(o.status)) for (const i of o.items) sold.set(i.productId, (sold.get(i.productId) ?? 0) + i.qty);
    const withSales = s.products.map((p) => ({ ...p, soldCount: sold.get(p.id) ?? 0 }));
    return clone(filterProducts(withSales, q, ids));
  },

  async getProductBySlug(slug, opts) {
    const p = store().products.find((x) => x.slug === slug);
    if (!p) return null;
    if (!opts?.includeInactive && p.status !== "active") return null;
    return clone(p);
  },

  async getProductById(id) {
    const p = store().products.find((x) => x.id === id);
    return p ? clone(p) : null;
  },

  async getVariantsWithProducts(variantIds) {
    const out: { variant: Product["variants"][number]; product: Product }[] = [];
    for (const p of store().products) {
      for (const v of p.variants) if (variantIds.includes(v.id)) out.push({ variant: clone(v), product: clone(p) });
    }
    return out;
  },

  async getSettings() {
    return clone(store().settings);
  },

  async findCoupon(code) {
    const c = store().coupons.find((x) => x.code === code.trim().toUpperCase());
    return c ? clone(c) : null;
  },

  async createOrder(input: CreateOrderInput) {
    const s = store();
    await this.releaseExpiredReservations();
    // Önce tüm stokları kontrol et (atomik: JS tek iş parçacıklı, arada await yok)
    for (const it of input.items) {
      const p = s.products.find((pp) => pp.id === it.productId);
      const v = p?.variants.find((vv) => vv.id === it.variantId);
      if (!p || !v || p.status !== "active") throw new StockError(it.variantId, 0);
      if (v.stock < it.qty) throw new StockError(it.variantId, v.stock);
    }
    const now = new Date();
    const id = randomUUID();
    const expires = now.getTime() + input.reservationMinutes * 60000;
    for (const it of input.items) {
      const v = s.products.find((pp) => pp.id === it.productId)!.variants.find((vv) => vv.id === it.variantId)!;
      v.stock -= it.qty;
      s.reservations.push({ orderId: id, variantId: v.id, qty: it.qty, expiresAt: expires });
    }
    if (input.couponCode) {
      const c = s.coupons.find((x) => x.code === input.couponCode);
      if (c) c.usedCount += 1;
    }
    const order: Order = {
      id,
      orderNo: newOrderNo(now),
      userId: input.userId,
      email: input.email,
      phone: input.phone,
      status: input.paymentMethod === "transfer" ? "awaiting_transfer" : "pending_payment",
      paymentMethod: input.paymentMethod,
      subtotal: input.subtotal,
      discount: input.discount,
      shipping: input.shipping,
      total: input.total,
      couponCode: input.couponCode,
      shippingAddress: input.shippingAddress,
      note: input.note,
      items: input.items,
      payment: null,
      carrier: null,
      trackingNo: null,
      consents: input.consents,
      utm: input.utm,
      reservationExpiresAt: new Date(expires).toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    s.orders.unshift(order);
    return clone(order);
  },

  async setOrderPaymentInit(orderId, token) {
    store().paymentTokens.set(token, orderId);
  },

  async getOrderByPaymentToken(token) {
    const id = store().paymentTokens.get(token);
    const o = id ? store().orders.find((x) => x.id === id) : undefined;
    return o ? clone(o) : null;
  },

  async markOrderPaid(orderId, payment) {
    const s = store();
    const o = s.orders.find((x) => x.id === orderId);
    if (!o) return null;
    if (o.status === "paid" || o.status === "preparing" || o.status === "shipped" || o.status === "delivered") {
      return clone(o); // idempotent
    }
    if (o.status !== "pending_payment" && o.status !== "awaiting_transfer") return null;
    o.status = "paid";
    o.payment = payment;
    o.reservationExpiresAt = null;
    o.updatedAt = new Date().toISOString();
    s.reservations = s.reservations.filter((r) => r.orderId !== o.id); // rezerv kesinleşti
    return clone(o);
  },

  async failOrder(orderId, reason) {
    const s = store();
    const o = s.orders.find((x) => x.id === orderId);
    if (!o || (o.status !== "pending_payment" && o.status !== "awaiting_transfer")) return;
    restock(o);
    o.status = "cancelled";
    o.note = [o.note, `Sistem: ${reason}`].filter(Boolean).join(" | ");
    o.updatedAt = new Date().toISOString();
  },

  async getOrderById(id) {
    const o = store().orders.find((x) => x.id === id);
    return o ? clone(o) : null;
  },

  async getOrderByNo(orderNo) {
    const o = store().orders.find((x) => x.orderNo === orderNo.trim().toUpperCase());
    return o ? clone(o) : null;
  },

  async listOrdersForUser(userId) {
    // Yalnız hesaba bağlı siparişler (bkz. supabase sürücüsü)
    return clone(store().orders.filter((o) => o.userId === userId));
  },

  async releaseExpiredReservations() {
    const s = store();
    const now = Date.now();
    const expiredOrderIds = [...new Set(s.reservations.filter((r) => r.expiresAt < now).map((r) => r.orderId))];
    for (const id of expiredOrderIds) await this.failOrder(id, "Ödeme süresi doldu");
    return expiredOrderIds.length;
  },

  async listOrders(filter = {}) {
    let list = store().orders;
    if (filter.status) list = list.filter((o) => o.status === filter.status);
    if (filter.q) {
      const q = filter.q.toLowerCase();
      list = list.filter(
        (o) =>
          o.orderNo.toLowerCase().includes(q) ||
          o.email.includes(q) ||
          o.shippingAddress.fullName.toLowerCase().includes(q),
      );
    }
    return clone(list.slice(0, filter.limit ?? 200));
  },

  async updateOrderStatus(id, status, actorId) {
    const o = store().orders.find((x) => x.id === id);
    if (!o) return null;
    if (status === "cancelled" && (o.status === "pending_payment" || o.status === "awaiting_transfer")) restock(o);
    o.status = status;
    o.updatedAt = new Date().toISOString();
    audit(actorId, `status:${status}`, "order", o.orderNo);
    return clone(o);
  },

  async setTracking(id, carrier, trackingNo, actorId) {
    const o = store().orders.find((x) => x.id === id);
    if (!o) return null;
    o.carrier = carrier;
    o.trackingNo = trackingNo;
    o.status = "shipped";
    o.updatedAt = new Date().toISOString();
    audit(actorId, "tracking", "order", o.orderNo);
    return clone(o);
  },

  async confirmTransfer(id, actorId) {
    const o = await this.markOrderPaid(id, {
      provider: "transfer",
      paymentId: null,
      status: "success",
      installment: null,
      cardLast4: null,
      paidAt: new Date().toISOString(),
    });
    if (o) audit(actorId, "transfer_confirmed", "order", o.orderNo);
    return o;
  },

  async upsertProduct(input: ProductInput, actorId) {
    const s = store();
    const slugTaken = s.products.find((p) => p.slug === input.slug && p.id !== input.id);
    if (slugTaken) throw new Error("Bu adres (slug) başka bir ürün tarafından kullanılıyor");
    const existing = input.id ? s.products.find((p) => p.id === input.id) : undefined;
    const id = existing?.id ?? randomUUID();
    const variants = input.variants.map((v) => ({ ...v, id: v.id || randomUUID(), productId: id }));
    if (existing) {
      Object.assign(existing, { ...input, id, variants });
      audit(actorId, "update", "product", existing.slug);
      return clone(existing);
    }
    const p: Product = {
      ...input,
      id,
      vatRate: 10,
      soldCount: 0,
      media: [],
      variants,
      createdAt: new Date().toISOString(),
    };
    s.products.unshift(p);
    audit(actorId, "create", "product", p.slug);
    return clone(p);
  },

  async listSizeCharts() {
    const s = store();
    return clone(s.sizeCharts).map((c) => ({ ...c, productCount: s.products.filter((p) => p.sizeChartId === c.id && p.status !== "archived").length }));
  },

  async getSizeChart(id) {
    const c = store().sizeCharts.find((x) => x.id === id);
    return c ? clone(c) : null;
  },

  async upsertSizeChart(c, actorId) {
    const s = store();
    const existing = c.id ? s.sizeCharts.find((x) => x.id === c.id) : undefined;
    if (existing) Object.assign(existing, { name: c.name, content: c.content });
    const saved = existing ?? { id: randomUUID(), name: c.name, content: c.content };
    if (!existing) s.sizeCharts.push(saved);
    audit(actorId, c.id ? "update" : "create", "size_chart", saved.name);
    return clone(saved);
  },

  async deleteSizeChart(id, actorId) {
    const s = store();
    s.sizeCharts = s.sizeCharts.filter((x) => x.id !== id);
    for (const p of s.products) if (p.sizeChartId === id) p.sizeChartId = null;
    audit(actorId, "delete", "size_chart", id);
  },

  async setProductStatus(id, status, actorId) {
    const p = store().products.find((x) => x.id === id);
    if (p) {
      p.status = status;
      audit(actorId, "status:" + status, "product", p.slug);
    }
  },

  async deleteProduct(id, actorId) {
    const s = store();
    if (s.orders.some((o) => o.items.some((i) => i.productId === id)))
      throw new Error("Bu ürün siparişlerde geçtiği için silinemez; sipariş geçmişi korunmalı. Bunun yerine arşivleyin.");
    const p = s.products.find((x) => x.id === id);
    s.products = s.products.filter((x) => x.id !== id);
    if (p) audit(actorId, "delete", "product", p.slug);
    return p?.media.map((m) => m.key) ?? [];
  },

  async archiveProduct(id, actorId) {
    const p = store().products.find((x) => x.id === id);
    if (p) {
      p.status = "archived";
      audit(actorId, "archive", "product", p.slug);
    }
  },

  async addProductMedia(productId, media, actorId) {
    const p = store().products.find((x) => x.id === productId);
    if (!p) throw new Error("Ürün bulunamadı");
    p.media.push(media);
    audit(actorId, "media_add", "product", p.slug);
  },

  async removeProductMedia(productId, key, actorId) {
    const p = store().products.find((x) => x.id === productId);
    if (!p) return;
    p.media = p.media.filter((m) => m.key !== key);
    audit(actorId, "media_remove", "product", p.slug);
  },

  async reorderProductMedia(productId, keys, actorId) {
    const p = store().products.find((x) => x.id === productId);
    if (!p) return;
    p.media = keys.map((k) => p.media.find((m) => m.key === k)).filter(Boolean) as typeof p.media;
    audit(actorId, "media_reorder", "product", p.slug);
  },

  async listCoupons() {
    return clone(store().coupons);
  },

  async upsertCoupon(c, actorId) {
    const s = store();
    const code = c.code.trim().toUpperCase();
    const existing = s.coupons.find((x) => (c.id ? x.id === c.id : x.code === code));
    if (existing) {
      Object.assign(existing, { ...c, code });
      audit(actorId, "update", "coupon", code);
      return clone(existing);
    }
    const nc: Coupon = { ...c, code, id: randomUUID(), usedCount: 0 };
    s.coupons.unshift(nc);
    audit(actorId, "create", "coupon", code);
    return clone(nc);
  },

  async updateSettings(next, actorId) {
    store().settings = clone(next);
    audit(actorId, "update", "settings", "store");
  },

  async dashboardStats(): Promise<DashboardStats> {
    const s = store();
    const istDay = (d: Date) => new Date(d.getTime() + 3 * 3600000).toISOString().slice(0, 10);
    const today = istDay(new Date());
    const month = today.slice(0, 7);
    const paidLike: OrderStatus[] = ["paid", "preparing", "shipped", "delivered"];
    const paid = s.orders.filter((o) => paidLike.includes(o.status));
    const lowStock = s.products
      .filter((p) => p.status === "active")
      .flatMap((p) =>
        p.variants
          .filter((v) => v.stock <= 2)
          .map((v) => ({ productName: p.name, sku: v.sku, size: v.size, color: v.color, stock: v.stock })),
      )
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 12);
    return {
      todayOrders: s.orders.filter((o) => istDay(new Date(o.createdAt)) === today && o.status !== "pending_payment" && o.status !== "cancelled").length,
      todayRevenue: paid.filter((o) => istDay(new Date(o.createdAt)) === today).reduce((a, o) => a + o.total, 0),
      monthRevenue: paid.filter((o) => istDay(new Date(o.createdAt)).startsWith(month)).reduce((a, o) => a + o.total, 0),
      awaitingTransfer: s.orders.filter((o) => o.status === "awaiting_transfer").length,
      toPrepare: s.orders.filter((o) => o.status === "paid").length,
      lowStock,
    };
  },

  async listAudit(limit = 100) {
    return clone(store().audit.slice(0, limit));
  },
};

/** Demo: başka bir sunucu örneğinde oluşturulmuş siparişi (imzalı çerezden) belleğe al. */
export function demoAdopt(order: Order) {
  const s = store();
  if (!s.orders.some((o) => o.id === order.id)) s.orders.unshift(structuredClone(order));
}
