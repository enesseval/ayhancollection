import "server-only";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import { capitalizeFirst } from "../format";
import { displayHex } from "../colors";
import { allowedFrom } from "../order-status";
import type { Category, Coupon, DashboardStats, Media, Order, OrderStatus, Product, Settings, Variant } from "../types";
import { StockError, type Repo } from "./repo";
import { filterProducts, newOrderNo } from "./shared";

// Supabase sürücüsü. Yalnız sunucuda, service role anahtarıyla çalışır (RLS'i baypas eder);
// bu yüzden her çağrı uygulama katmanında yetkilendirilir. İstemciye bu anahtar asla gitmez.

let _admin: SupabaseClient | null = null;
export function db(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(env.supabaseUrl, env.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const PRODUCT_SELECT =
  "id, slug, name, description, fabric, measurements, care, category_id, base_price, compare_at_price, status, is_new, is_bestseller, vat_rate, size_chart_id, created_at, product_media(storage_key, width, height, thumbhash, alt, color, sort), product_variants(id, product_id, sku, size, color, color_hex, stock, price_override)";

function mapVariant(v: any): Variant {
  return {
    id: v.id,
    productId: v.product_id,
    sku: v.sku,
    size: v.size,
    color: capitalizeFirst(v.color),
    colorHex: displayHex(v.color, v.color_hex),
    stock: v.stock,
    priceOverride: v.price_override,
  };
}

function mapProduct(r: any): Product {
  const media: Media[] = [...(r.product_media ?? [])]
    .sort((a: any, b: any) => a.sort - b.sort)
    .map((m: any) => ({ key: m.storage_key, width: m.width, height: m.height, thumbhash: m.thumbhash, alt: m.alt, color: m.color ? capitalizeFirst(m.color) : m.color }));
  return {
    id: r.id,
    slug: r.slug,
    name: capitalizeFirst(r.name),
    description: r.description,
    fabric: r.fabric,
    measurements: r.measurements ?? "",
    care: r.care,
    categoryId: r.category_id,
    basePrice: r.base_price,
    compareAtPrice: r.compare_at_price,
    status: r.status,
    isNew: r.is_new,
    isBestseller: r.is_bestseller,
    vatRate: r.vat_rate,
    sizeChartId: r.size_chart_id ?? null,
    soldCount: 0,
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
      productName: capitalizeFirst(i.product_name),
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

function mapCategory(c: any): Category {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    parentId: c.parent_id,
    sort: c.sort,
    description: c.description ?? undefined,
    isActive: c.is_active,
  };
}

async function allCategories(): Promise<Category[]> {
  const rows = check(await db().from("categories").select("*").eq("is_active", true).order("sort"));
  return (rows as any[]).map(mapCategory);
}

export const supabaseRepo: Repo = {
  kind: "supabase",

  listCategories: allCategories,

  async listProducts(q = {}) {
    let query = db().from("products").select(PRODUCT_SELECT);
    if (!q.includeArchived) query = q.includeInactive ? query.neq("status", "archived") : query.eq("status", "active");
    let catIds: string[] | null = null;
    if (q.categorySlug) {
      const cats = await allCategories();
      const cat = cats.find((c) => c.slug === q.categorySlug);
      catIds = cat ? [cat.id, ...cats.filter((c) => c.parentId === cat.id).map((c) => c.id)] : [];
      query = query.in("category_id", catIds.length ? catIds : ["00000000-0000-0000-0000-000000000000"]);
    }
    const rows = check(await query.limit(500));
    const products = (rows as any[]).map(mapProduct);
    // Satış adetleri (Çok Satanlar / popüler sıralama). Görünüm yoksa sessizce 0 kalır.
    const sales = await db().from("product_sales").select("product_id, sold");
    if (!sales.error) {
      const sold = new Map((sales.data as any[]).map((r) => [r.product_id as string, r.sold as number]));
      for (const p of products) p.soldCount = sold.get(p.id) ?? 0;
    }
    // Arama/filtre/sıralama küçük katalogda bellekte; büyüyünce Postgres full-text'e taşınabilir.
    return filterProducts(products, { ...q, categorySlug: undefined }, null);
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

  async getOrderByPaymentToken(token) {
    const row = check(await db().from("orders").select(ORDER_SELECT).eq("payment_token", token).maybeSingle());
    return row ? mapOrder(row) : null;
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

  async listOrdersForUser(userId) {
    const rows = check(
      await db()
        .from("orders")
        .select(ORDER_SELECT)
        // Yalnız hesaba bağlı siparişler. E-posta eşleşmesiyle misafir siparişleri GÖSTERİLMEZ:
        // e-posta doğrulaması kapalıyken başkasının adresiyle üye olup siparişlerini görmek mümkün olurdu.
        .eq("user_id", userId)
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
      // Tek SQL işleminde: bekleyen siparişte rezervasyon iadesi, ödenmiş/hazırlanan siparişte
      // satılan adetlerin stoğa ve kupon hakkının geri verilmesi (yalnız bir kez)
      const { error } = await db().rpc("admin_cancel_order", { p_order_id: id, p_reason: "Yönetici iptali" });
      if (error) {
        if (/INVALID_TRANSITION/.test(error.message)) return null;
        throw new Error(error.message);
      }
      const o = await this.getOrderById(id);
      if (o) await audit(actorId, "status:cancelled", "order", o.orderNo);
      return o;
    }
    // Koşullu güncelleme: yalnız izin verilen önceki durumlardan
    const updated = check(await db().from("orders").update({ status }).eq("id", id).in("status", allowedFrom(status)).select("id")) as any[];
    if (!updated.length) return null;
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
    // Adres (slug) çakışması: yeni üründe otomatik "-2", "-3" eklenir; düzenlemede kullanıcıya bildirilir
    let slug = input.slug;
    const taken = async (sl: string) =>
      ((check(await db().from("products").select("id").eq("slug", sl).limit(1)) as any[])[0]?.id as string | undefined);
    const owner = await taken(slug);
    if (owner && owner !== input.id) {
      if (input.id) throw new Error("Bu adres (URL) başka bir ürün tarafından kullanılıyor. Farklı bir adres yazın.");
      for (let i = 2; i < 50; i++) {
        const candidate = `${input.slug.slice(0, 76)}-${i}`;
        if (!(await taken(candidate))) {
          slug = candidate;
          break;
        }
      }
    }

    // SKU çakışması: başka bir ürünün SKU'su kullanılmışsa sonuna ek getirilerek benzersizleştirilir
    const wanted = input.variants.map((v) => v.sku);
    const clash = new Set(
      (check(await db().from("product_variants").select("sku, product_id").in("sku", wanted)) as any[])
        .filter((r) => r.product_id !== input.id)
        .map((r) => r.sku as string),
    );
    const variants = input.variants.map((v) =>
      clash.has(v.sku) ? { ...v, sku: `${v.sku.slice(0, 33)}-${randomBytes(2).toString("hex").toUpperCase()}` } : v,
    );

    const row = {
      ...(input.id ? { id: input.id } : {}),
      slug,
      name: input.name,
      description: input.description,
      fabric: input.fabric,
      measurements: input.measurements,
      care: input.care,
      category_id: input.categoryId,
      base_price: input.basePrice,
      compare_at_price: input.compareAtPrice,
      status: input.status,
      is_new: input.isNew,
      is_bestseller: input.isBestseller,
      size_chart_id: input.sizeChartId,
    };
    const saved = check(await db().from("products").upsert(row).select("id").single()) as any;
    const productId = saved.id as string;
    try {
      const existing = check(await db().from("product_variants").select("id").eq("product_id", productId)) as any[];
      const keepIds = variants.map((v) => v.id).filter(Boolean);
      const toDelete = existing.map((e) => e.id).filter((id) => !keepIds.includes(id));
      // Siparişte kullanılmış varyant silinemez (FK) -> stok 0'a çekilir
      for (const id of toDelete) {
        const del = await db().from("product_variants").delete().eq("id", id);
        if (del.error) check(await db().from("product_variants").update({ stock: 0 }).eq("id", id));
      }
      if (variants.length) {
        check(
          await db()
            .from("product_variants")
            .upsert(
              variants.map((v) => ({
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
    } catch (e) {
      // Yeni ürün yarım kalmasın: varyantlar kaydedilemediyse ürünü geri al
      if (!input.id) await db().from("products").delete().eq("id", productId);
      throw e;
    }
    await audit(actorId, input.id ? "update" : "create", "product", slug);
    return (await this.getProductById(productId))!;
  },

  async listAllCategories() {
    const rows = check(await db().from("categories").select("*").order("sort")) as any[];
    const prods = check(await db().from("products").select("category_id").neq("status", "archived")) as any[];
    return rows.map((c) => ({ ...mapCategory(c), productCount: prods.filter((p) => p.category_id === c.id).length }));
  },

  async upsertCategory(c, actorId) {
    // Yeni kategori aynı seviyenin sonuna eklenir
    let sort: number | undefined;
    if (!c.id) {
      const sib = check(
        await (c.parentId
          ? db().from("categories").select("sort").eq("parent_id", c.parentId)
          : db().from("categories").select("sort").is("parent_id", null)),
      ) as any[];
      sort = sib.reduce((m, r) => Math.max(m, r.sort ?? 0), 0) + 10;
    }
    const row = check(
      await db()
        .from("categories")
        .upsert({
          ...(c.id ? { id: c.id } : {}),
          name: c.name,
          slug: c.slug,
          parent_id: c.parentId,
          description: c.description || null,
          is_active: c.isActive,
          ...(sort !== undefined ? { sort } : {}),
        })
        .select("*")
        .single(),
    );
    await audit(actorId, c.id ? "update" : "create", "category", c.slug);
    return mapCategory(row);
  },

  async deleteCategory(id, actorId) {
    const used = check(await db().from("products").select("id").eq("category_id", id).limit(1)) as any[];
    if (used.length) throw new Error("Bu kategoride ürün var (arşivdekiler dahil). Önce ürünleri başka kategoriye taşıyın ya da kategoriyi gizleyin.");
    const kids = check(await db().from("categories").select("id").eq("parent_id", id).limit(1)) as any[];
    if (kids.length) throw new Error("Bu kategorinin alt kategorileri var. Önce onları silin ya da başka kategoriye taşıyın.");
    check(await db().from("categories").delete().eq("id", id));
    await audit(actorId, "delete", "category", id);
  },

  async reorderCategories(ids, actorId) {
    for (let i = 0; i < ids.length; i++) check(await db().from("categories").update({ sort: (i + 1) * 10 }).eq("id", ids[i]));
    await audit(actorId, "reorder", "category", ids.length + " kategori");
  },

  async listSizeCharts() {
    const charts = check(await db().from("size_charts").select("id, name, content").order("name")) as any[];
    const used = check(await db().from("products").select("size_chart_id").not("size_chart_id", "is", null).neq("status", "archived")) as any[];
    return charts.map((c) => ({ ...c, productCount: used.filter((u) => u.size_chart_id === c.id).length }));
  },

  async getSizeChart(id) {
    const row = check(await db().from("size_charts").select("id, name, content").eq("id", id).maybeSingle()) as any;
    return row ?? null;
  },

  async upsertSizeChart(c, actorId) {
    const row = check(
      await db()
        .from("size_charts")
        .upsert({ ...(c.id ? { id: c.id } : {}), name: c.name, content: c.content, updated_at: new Date().toISOString() })
        .select("id, name, content")
        .single(),
    ) as any;
    await audit(actorId, c.id ? "update" : "create", "size_chart", row.name);
    return row;
  },

  async deleteSizeChart(id, actorId) {
    // Bağlı ürünlerde size_chart_id otomatik boşalır (on delete set null)
    check(await db().from("size_charts").delete().eq("id", id));
    await audit(actorId, "delete", "size_chart", id);
  },

  async setProductStatus(id, status, actorId) {
    check(await db().from("products").update({ status }).eq("id", id));
    await audit(actorId, "status:" + status, "product", id);
  },

  async deleteProduct(id, actorId) {
    const ordered = check(await db().from("order_items").select("id").eq("product_id", id).limit(1)) as any[];
    if (ordered.length) throw new Error("Bu ürün siparişlerde geçtiği için silinemez; sipariş geçmişi korunmalı. Bunun yerine arşivleyin.");
    const media = check(await db().from("product_media").select("storage_key").eq("product_id", id)) as any[];
    const row = check(await db().from("products").select("slug").eq("id", id).maybeSingle()) as any;
    check(await db().from("products").delete().eq("id", id));
    await audit(actorId, "delete", "product", row?.slug ?? id);
    return media.map((m) => m.storage_key as string);
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
      // Yarım kalan (ödenmemiş) ve iptal edilen siparişler sayılmaz
      todayOrders: orders.filter((o) => istDay(o.created_at) === today && !["pending_payment", "cancelled"].includes(o.status)).length,
      todayRevenue: paid.filter((o) => istDay(o.created_at) === today).reduce((a, o) => a + o.total, 0),
      monthRevenue: paid.filter((o) => istDay(o.created_at).startsWith(today.slice(0, 7))).reduce((a, o) => a + o.total, 0),
      awaitingTransfer: (check(await db().from("orders").select("id").eq("status", "awaiting_transfer")) as any[]).length,
      toPrepare: (check(await db().from("orders").select("id").eq("status", "paid")) as any[]).length,
      lowStock: low.map((v) => ({ productName: capitalizeFirst(v.products.name), sku: v.sku, size: v.size, color: v.color, stock: v.stock })),
    };
  },

  async listAudit(limit = 100) {
    const rows = check(await db().from("audit_logs").select("*").order("created_at", { ascending: false }).limit(limit)) as any[];
    return rows.map((r) => ({ at: r.created_at, actor: r.actor_id, action: r.action, entity: r.entity, entityId: r.entity_id }));
  },
};
