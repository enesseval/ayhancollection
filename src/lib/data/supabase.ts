import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import type { Category, Coupon, DashboardStats, Media, Order, OrderStatus, Product, Settings, Variant } from "../types";
import { StockError, type Repo } from "./repo";
import { filterProducts, newOrderNo } from "./shared";

// Supabase sürücüsü. Yalnız sunucuda, service role anahtarıyla çalışır (RLS'i baypas eder);
// bu yüzden her çağrı uygulama katmanında yetkilendirilir. İstemciye bu anahtar asla gitmez.

let _admin: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(env.supabaseUrl, env.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const PRODUCT_SELECT =
  "id, slug, name, description, fabric, care, category_id, base_price, compare_at_price, status, is_new, is_bestseller, vat_rate, created_at, product_media(storage_key, width, height, thumbhash, alt, color, sort), product_variants(id, product_id, sku, size, color, color_hex, stock, price_override)";

function mapVariant(v: any): Variant {
  return {
    id: v.id,
    productId: v.product_id,
    sku: v.sku,
    size: v.size,
    color: v.color,
    colorHex: v.color_hex,
    stock: v.stock,
    priceOverride: v.price_override,
  };
}

function mapProduct(r: any): Product {
  const media: Media[] = [...(r.product_media ?? [])]
    .sort((a: any, b: any) => a.sort - b.sort)
    .map((m: any) => ({ key: m.storage_key, width: m.width, height: m.height, thumbhash: m.thumbhash, alt: m.alt, color: m.color }));
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    fabric: r.fabric,
    care: r.care,
    categoryId: r.category_id,
    basePrice: r.base_price,
    compareAtPrice: r.compare_at_price,
    status: r.status,
    isNew: r.is_new,
    isBestseller: r.is_bestseller,
    vatRate: r.vat_rate,
    media,
    variants: (r.product_variants ?? []).map(mapVariant).sort((a: Variant, b: Variant) => a.sku.localeCompare(b.sku)),
    createdAt: r.created_at,
  };
}

function mapOrder(r: any): Order {
  const pay = (r.payments ?? []).find((p: any) => p.status === "success") ?? null;
  return {
    id: r.id,
    orderNo: r.order_no,
    userId: r.user_id,
    email: r.email,
    phone: r.phone,
    status: r.status,
    paymentMethod: r.payment_method,
    subtotal: r.subtotal,
    discount: r.discount,
    shipping: r.shipping,
    total: r.total,
    couponCode: r.coupon_code,
    shippingAddress: r.shipping_address,
    note: r.note,
    items: (r.order_items ?? []).map((i: any) => ({
      variantId: i.variant_id,
      productId: i.product_id,
      productName: i.product_name,
      productSlug: i.product_slug,
      sku: i.sku,
      size: i.size,
      color: i.color,
      unitPrice: i.unit_price,
      qty: i.qty,
      imageKey: i.image_key,
    })),
    payment: pay
      ? {
          provider: pay.provider,
          paymentId: pay.payment_id,
          status: pay.status,
          installment: pay.installment,
          cardLast4: pay.card_last4,
          paidAt: pay.paid_at,
        }
      : null,
    carrier: r.carrier,
    trackingNo: r.tracking_no,
    consents: r.consents,
    utm: r.utm,
    reservationExpiresAt: r.reservation_expires_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const ORDER_SELECT = "*, order_items(*), payments(provider, payment_id, status, installment, card_last4, paid_at)";

function check<T>(res: { data: T; error: any }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

async function audit(actor: string, action: string, entity: string, entityId: string, diff?: unknown) {
  await db().from("audit_logs").insert({ actor_id: actor, action, entity, entity_id: entityId, diff: diff ?? null });
}

async function allCategories(): Promise<Category[]> {
  const rows = check(await db().from("categories").select("*").eq("is_active", true).order("sort"));
  return (rows as any[]).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    parentId: c.parent_id,
    sort: c.sort,
    description: c.description ?? undefined,
  }));
}

export const supabaseRepo: Repo = {
  kind: "supabase",

  listCategories: allCategories,

  async listProducts(q = {}) {
    let query = db().from("products").select(PRODUCT_SELECT);
    query = q.includeInactive ? query.neq("status", "archived") : query.eq("status", "active");
    let catIds: string[] | null = null;
    if (q.categorySlug) {
      const cats = await allCategories();
      const cat = cats.find((c) => c.slug === q.categorySlug);
      catIds = cat ? [cat.id, ...cats.filter((c) => c.parentId === cat.id).map((c) => c.id)] : [];
      query = query.in("category_id", catIds.length ? catIds : ["00000000-0000-0000-0000-000000000000"]);
    }
    const rows = check(await query.limit(500));
    // Arama/filtre/sıralama küçük katalogda bellekte; büyüyünce Postgres full-text'e taşınabilir.
    return filterProducts((rows as any[]).map(mapProduct), { ...q, categorySlug: undefined }, null);
  },

  async getProductBySlug(slug, opts) {
    let query = db().from("products").select(PRODUCT_SELECT).eq("slug", slug);
    if (!opts?.includeInactive) query = query.eq("status", "active");
    const row = check(await query.maybeSingle());
    return row ? mapProduct(row) : null;
  },

  async getProductById(id) {
    const row = check(await db().from("products").select(PRODUCT_SELECT).eq("id", id).maybeSingle());
    return row ? mapProduct(row) : null;
  },

  async getVariantsWithProducts(variantIds) {
    if (!variantIds.length) return [];
    const rows = check(await db().from("product_variants").select("product_id").in("id", variantIds)) as any[];
    const productIds = [...new Set(rows.map((r) => r.product_id))];
    const prows = check(await db().from("products").select(PRODUCT_SELECT).in("id", productIds)) as any[];
    const products = prows.map(mapProduct);
    return products.flatMap((p) => p.variants.filter((v) => variantIds.includes(v.id)).map((v) => ({ variant: v, product: p })));
  },

  async getSettings() {
    const row = check(await db().from("settings").select("data").eq("id", 1).maybeSingle()) as any;
    if (!row) throw new Error("Mağaza ayarları bulunamadı (seed.sql çalıştırıldı mı?)");
    return row.data as Settings;
  },

  async findCoupon(code) {
    const row = check(await db().from("coupons").select("*").eq("code", code.trim().toUpperCase()).maybeSingle()) as any;
    if (!row) return null;
    return {
      id: row.id,
      code: row.code,
      type: row.type,
      value: row.value,
      minSubtotal: row.min_subtotal,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      usageLimit: row.usage_limit,
      usedCount: row.used_count,
      active: row.active,
    };
  },

  async createOrder(input) {
    const orderNo = newOrderNo();
    const payload = {
      order_no: orderNo,
      user_id: input.userId ?? "",
      email: input.email,
      phone: input.phone,
      payment_method: input.paymentMethod,
      subtotal: input.subtotal,
      discount: input.discount,
      shipping: input.shipping,
      total: input.total,
      coupon_code: input.couponCode ?? "",
      shipping_address: input.shippingAddress,
      note: input.note ?? "",
      consents: input.consents,
      utm: input.utm,
      reservation_minutes: input.reservationMinutes,
      items: input.items.map((i) => ({
        variant_id: i.variantId,
        product_id: i.productId,
        product_name: i.productName,
        product_slug: i.productSlug,
        sku: i.sku,
        size: i.size,
        color: i.color,
        unit_price: i.unitPrice,
        qty: i.qty,
        image_key: i.imageKey,
      })),
    };
    const res = await db().rpc("create_order", { p: payload });
    if (res.error) {
      const m = res.error.message;
      const stock = m.match(/OUT_OF_STOCK:([0-9a-f-]+)/);
      if (stock) throw new StockError(stock[1], 0);
      if (m.includes("PRICE_CHANGED") || m.includes("TOTAL_MISMATCH")) throw new Error("PRICE_CHANGED");
      if (m.includes("COUPON_INVALID")) throw new Error("COUPON_INVALID");
      throw new Error(m);
    }
    const id = (res.data as any[])[0].order_id as string;
    const order = await this.getOrderById(id);
    if (!order) throw new Error("Sipariş oluşturulamadı");
    return order;
  },

  async setOrderPaymentInit(orderId, token) {
    check(await db().from("orders").update({ payment_token: token }).eq("id", orderId));
  },

  async markOrderPaid(orderId, payment) {
    const order = await this.getOrderById(orderId);
    if (!order) return null;
    const res = await db().rpc("confirm_payment", {
      p_order_id: orderId,
      p_payment: {
        provider: payment.provider,
        payment_id: payment.paymentId ?? "",
        installment: payment.installment ?? "",
        card_last4: payment.cardLast4 ?? "",
        amount: order.total,
      },
    });
    if (res.error) throw new Error(res.error.message);
    if (!res.data) return null;
    return this.getOrderById(orderId);
  },

  async failOrder(orderId, reason) {
    const res = await db().rpc("fail_order", { p_order_id: orderId, p_reason: reason });
    if (res.error) throw new Error(res.error.message);
  },

  async getOrderById(id) {
    const row = check(await db().from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle());
    return row ? mapOrder(row) : null;
  },

  async getOrderByNo(orderNo) {
    const row = check(
      await db().from("orders").select(ORDER_SELECT).eq("order_no", orderNo.trim().toUpperCase()).maybeSingle(),
    );
    return row ? mapOrder(row) : null;
  },

  async listOrdersForUser(userId, email) {
    const rows = check(
      await db()
        .from("orders")
        .select(ORDER_SELECT)
        .or(`user_id.eq.${userId},email.eq."${email.toLowerCase().replace(/[",()\\]/g, "")}"`)
        .order("created_at", { ascending: false })
        .limit(50),
    ) as any[];
    return rows.map(mapOrder);
  },

  async releaseExpiredReservations() {
    const res = await db().rpc("release_expired_reservations");
    if (res.error) throw new Error(res.error.message);
    return res.data as number;
  },

  async listOrders(filter = {}) {
    let query = db().from("orders").select(ORDER_SELECT).order("created_at", { ascending: false }).limit(filter.limit ?? 200);
    if (filter.status) query = query.eq("status", filter.status);
    if (filter.q) {
      const s = filter.q.replace(/[^\p{L}\p{N}@._-]/gu, "").trim();
      if (s) query = query.or(`order_no.ilike.*${s}*,email.ilike.*${s}*`);
    }
    return (check(await query) as any[]).map(mapOrder);
  },

  async updateOrderStatus(id, status: OrderStatus, actorId) {
    if (status === "cancelled") {
      const o = await this.getOrderById(id);
      if (o && (o.status === "pending_payment" || o.status === "awaiting_transfer")) {
        await this.failOrder(id, "Yönetici iptali");
        await audit(actorId, "status:cancelled", "order", o.orderNo);
        return this.getOrderById(id);
      }
    }
    check(await db().from("orders").update({ status }).eq("id", id));
    const o = await this.getOrderById(id);
    if (o) await audit(actorId, `status:${status}`, "order", o.orderNo);
    return o;
  },

  async setTracking(id, carrier, trackingNo, actorId) {
    check(await db().from("orders").update({ carrier, tracking_no: trackingNo, status: "shipped" }).eq("id", id));
    const o = await this.getOrderById(id);
    if (o) await audit(actorId, "tracking", "order", o.orderNo);
    return o;
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
    if (o) await audit(actorId, "transfer_confirmed", "order", o.orderNo);
    return o;
  },

  async upsertProduct(input, actorId) {
    const row = {
      ...(input.id ? { id: input.id } : {}),
      slug: input.slug,
      name: input.name,
      description: input.description,
      fabric: input.fabric,
      care: input.care,
      category_id: input.categoryId,
      base_price: input.basePrice,
      compare_at_price: input.compareAtPrice,
      status: input.status,
      is_new: input.isNew,
      is_bestseller: input.isBestseller,
    };
    const saved = check(await db().from("products").upsert(row).select("id").single()) as any;
    const productId = saved.id as string;
    const existing = check(await db().from("product_variants").select("id").eq("product_id", productId)) as any[];
    const keepIds = input.variants.map((v) => v.id).filter(Boolean);
    const toDelete = existing.map((e) => e.id).filter((id) => !keepIds.includes(id));
    if (toDelete.length) check(await db().from("product_variants").delete().in("id", toDelete));
    if (input.variants.length) {
      check(
        await db()
          .from("product_variants")
          .upsert(
            input.variants.map((v) => ({
              ...(v.id ? { id: v.id } : {}),
              product_id: productId,
              sku: v.sku,
              size: v.size,
              color: v.color,
              color_hex: v.colorHex,
              stock: v.stock,
              price_override: v.priceOverride,
            })),
          ),
      );
    }
    await audit(actorId, input.id ? "update" : "create", "product", input.slug);
    return (await this.getProductById(productId))!;
  },

  async archiveProduct(id, actorId) {
    check(await db().from("products").update({ status: "archived" }).eq("id", id));
    await audit(actorId, "archive", "product", id);
  },

  async addProductMedia(productId, media, actorId) {
    const count = check(await db().from("product_media").select("id").eq("product_id", productId)) as any[];
    check(
      await db().from("product_media").insert({
        product_id: productId,
        storage_key: media.key,
        width: media.width,
        height: media.height,
        thumbhash: media.thumbhash,
        alt: media.alt,
        color: media.color ?? null,
        sort: count.length,
      }),
    );
    await audit(actorId, "media_add", "product", productId);
  },

  async removeProductMedia(productId, key, actorId) {
    check(await db().from("product_media").delete().eq("product_id", productId).eq("storage_key", key));
    await audit(actorId, "media_remove", "product", productId);
  },

  async reorderProductMedia(productId, keys, actorId) {
    await Promise.all(
      keys.map((k, i) => db().from("product_media").update({ sort: i }).eq("product_id", productId).eq("storage_key", k)),
    );
    await audit(actorId, "media_reorder", "product", productId);
  },

  async listCoupons() {
    const rows = check(await db().from("coupons").select("*").order("code")) as any[];
    return rows.map(
      (row): Coupon => ({
        id: row.id,
        code: row.code,
        type: row.type,
        value: row.value,
        minSubtotal: row.min_subtotal,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        usageLimit: row.usage_limit,
        usedCount: row.used_count,
        active: row.active,
      }),
    );
  },

  async upsertCoupon(c, actorId) {
    const row = {
      ...(c.id ? { id: c.id } : {}),
      code: c.code.trim().toUpperCase(),
      type: c.type,
      value: c.value,
      min_subtotal: c.minSubtotal,
      starts_at: c.startsAt,
      ends_at: c.endsAt,
      usage_limit: c.usageLimit,
      active: c.active,
    };
    check(await db().from("coupons").upsert(row, { onConflict: "code" }));
    await audit(actorId, c.id ? "update" : "create", "coupon", row.code);
    return (await this.findCoupon(row.code))!;
  },

  async updateSettings(s: Settings, actorId) {
    check(await db().from("settings").upsert({ id: 1, data: s }));
    await audit(actorId, "update", "settings", "store");
  },

  async dashboardStats(): Promise<DashboardStats> {
    const since = new Date(Date.now() - 40 * 86400000).toISOString();
    const orders = (check(
      await db().from("orders").select("status, total, created_at").gte("created_at", since).limit(5000),
    ) as any[]);
    const istDay = (d: string) => new Date(new Date(d).getTime() + 3 * 3600000).toISOString().slice(0, 10);
    const today = istDay(new Date().toISOString());
    const paidLike = ["paid", "preparing", "shipped", "delivered"];
    const paid = orders.filter((o) => paidLike.includes(o.status));
    const low = (check(
      await db()
        .from("product_variants")
        .select("sku, size, color, stock, products!inner(name, status)")
        .lte("stock", 2)
        .eq("products.status", "active")
        .order("stock")
        .limit(12),
    ) as any[]);
    return {
      todayOrders: orders.filter((o) => istDay(o.created_at) === today).length,
      todayRevenue: paid.filter((o) => istDay(o.created_at) === today).reduce((a, o) => a + o.total, 0),
      monthRevenue: paid.filter((o) => istDay(o.created_at).startsWith(today.slice(0, 7))).reduce((a, o) => a + o.total, 0),
      awaitingTransfer: (check(await db().from("orders").select("id").eq("status", "awaiting_transfer")) as any[]).length,
      toPrepare: (check(await db().from("orders").select("id").eq("status", "paid")) as any[]).length,
      lowStock: low.map((v) => ({ productName: v.products.name, sku: v.sku, size: v.size, color: v.color, stock: v.stock })),
    };
  },

  async listAudit(limit = 100) {
    const rows = check(await db().from("audit_logs").select("*").order("created_at", { ascending: false }).limit(limit)) as any[];
    return rows.map((r) => ({ at: r.created_at, actor: r.actor_id, action: r.action, entity: r.entity, entityId: r.entity_id }));
  },
};
