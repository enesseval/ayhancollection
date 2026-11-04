import type {
  Category,
  Coupon,
  DashboardStats,
  Media,
  Order,
  OrderItem,
  OrderStatus,
  PaymentInfo,
  PaymentMethod,
  Product,
  ProductQuery,
  Settings,
  Address,
  Variant,
} from "../types";

export type CreateOrderInput = {
  userId: string | null;
  email: string;
  phone: string;
  paymentMethod: PaymentMethod;
  shippingAddress: Address;
  note: string | null;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  couponCode: string | null;
  consents: Order["consents"];
  utm: Record<string, string> | null;
  reservationMinutes: number;
};

export type ProductInput = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  fabric: string;
  care: string;
  categoryId: string;
  basePrice: number;
  compareAtPrice: number | null;
  status: Product["status"];
  isNew: boolean;
  isBestseller: boolean;
  variants: Omit<Variant, "productId">[];
};

export class StockError extends Error {
  constructor(public variantId: string, public available: number) {
    super("Yetersiz stok");
  }
}

export interface Repo {
  readonly kind: "demo" | "supabase";
  // Katalog
  listCategories(): Promise<Category[]>;
  listProducts(q?: ProductQuery): Promise<Product[]>;
  getProductBySlug(slug: string, opts?: { includeInactive?: boolean }): Promise<Product | null>;
  getProductById(id: string): Promise<Product | null>;
  getVariantsWithProducts(variantIds: string[]): Promise<{ variant: Variant; product: Product }[]>;
  getSettings(): Promise<Settings>;
  findCoupon(code: string): Promise<Coupon | null>;

  // Sipariş
  createOrder(input: CreateOrderInput): Promise<Order>;
  setOrderPaymentInit(orderId: string, token: string): Promise<void>;
  markOrderPaid(orderId: string, payment: PaymentInfo): Promise<Order | null>;
  failOrder(orderId: string, reason: string): Promise<void>;
  getOrderById(id: string): Promise<Order | null>;
  getOrderByNo(orderNo: string): Promise<Order | null>;
  listOrdersForUser(userId: string, email: string): Promise<Order[]>;
  releaseExpiredReservations(): Promise<number>;

  // Admin
  listOrders(filter?: { status?: OrderStatus; q?: string; limit?: number }): Promise<Order[]>;
  updateOrderStatus(id: string, status: OrderStatus, actorId: string): Promise<Order | null>;
  setTracking(id: string, carrier: string, trackingNo: string, actorId: string): Promise<Order | null>;
  confirmTransfer(id: string, actorId: string): Promise<Order | null>;
  upsertProduct(input: ProductInput, actorId: string): Promise<Product>;
  archiveProduct(id: string, actorId: string): Promise<void>;
  addProductMedia(productId: string, media: Media, actorId: string): Promise<void>;
  removeProductMedia(productId: string, key: string, actorId: string): Promise<void>;
  reorderProductMedia(productId: string, keys: string[], actorId: string): Promise<void>;
  listCoupons(): Promise<Coupon[]>;
  upsertCoupon(c: Omit<Coupon, "id" | "usedCount"> & { id?: string }, actorId: string): Promise<Coupon>;
  updateSettings(s: Settings, actorId: string): Promise<void>;
  dashboardStats(): Promise<DashboardStats>;
  listAudit(limit?: number): Promise<{ at: string; actor: string; action: string; entity: string; entityId: string }[]>;
}
