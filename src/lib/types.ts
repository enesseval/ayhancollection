// Tüm para tutarları kuruş cinsinden integer'dır (ör. 89900 = 899,00 TL).

export type Category = {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  sort: number;
  description?: string;
};

export type Media = {
  /** Depolama anahtarı, boyut eki olmadan. "seed/..." yerel, diğerleri MEDIA_BASE_URL altında. */
  key: string;
  width: number;
  height: number;
  /** base64 ThumbHash (~25-35 byte) */
  thumbhash: string | null;
  alt: string;
  /** Görsel belirli bir renk varyantına aitse renk adı */
  color?: string | null;
};

export type Variant = {
  id: string;
  productId: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string;
  stock: number;
  priceOverride: number | null;
};

export type ProductStatus = "draft" | "active" | "archived";

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  fabric: string;
  /** Ölçüler (Markdown; genelde tablo) — kumaştan ayrı */
  measurements: string;
  care: string;
  categoryId: string;
  basePrice: number;
  compareAtPrice: number | null;
  status: ProductStatus;
  isNew: boolean;
  isBestseller: boolean;
  vatRate: number;
  /** Yönetimden atanmış beden tablosu (yoksa ürün sayfasında buton görünmez) */
  sizeChartId: string | null;
  /** Ödenmiş siparişlerdeki toplam satış adedi (Çok Satanlar sıralaması) */
  soldCount: number;
  media: Media[];
  variants: Variant[];
  createdAt: string;
};

export type Address = {
  fullName: string;
  phone: string;
  city: string;
  district: string;
  line: string;
  postalCode?: string;
};

export type OrderStatus =
  | "pending_payment"
  | "awaiting_transfer"
  | "paid"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type PaymentMethod = "card" | "transfer";

export type OrderItem = {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  sku: string;
  size: string;
  color: string;
  unitPrice: number;
  qty: number;
  imageKey: string | null;
};

export type PaymentInfo = {
  provider: "iyzico" | "demo" | "transfer";
  paymentId: string | null;
  status: "init" | "success" | "failure";
  installment: number | null;
  cardLast4: string | null;
  paidAt: string | null;
};

export type Order = {
  id: string;
  orderNo: string;
  userId: string | null;
  email: string;
  phone: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  couponCode: string | null;
  shippingAddress: Address;
  note: string | null;
  items: OrderItem[];
  payment: PaymentInfo | null;
  carrier: string | null;
  trackingNo: string | null;
  consents: { contractVersion: string; acceptedAt: string; ip: string | null; marketing: boolean };
  utm: Record<string, string> | null;
  reservationExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Coupon = {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number; // percent: 1-100, fixed: kuruş
  minSubtotal: number;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  active: boolean;
};

export type BankAccount = { bank: string; holder: string; iban: string };

export type Settings = {
  shippingFee: number;
  freeShippingThreshold: number;
  bankAccounts: BankAccount[];
  whatsapp: string;
  instagram: string;
  announcement: string;
};

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: "customer" | "admin";
};

export type SizeChart = { id: string; name: string; content: string; productCount?: number };

export type ProductQuery = {
  categorySlug?: string;
  q?: string;
  size?: string;
  color?: string;
  sort?: "new" | "price_asc" | "price_desc" | "popular";
  onlyNew?: boolean;
  onlyBestseller?: boolean;
  onlyDiscounted?: boolean;
  limit?: number;
  includeInactive?: boolean;
};

export type CartLineInput = { variantId: string; qty: number };

export type PricedLine = {
  variant: Variant;
  product: Product;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

export type Totals = {
  lines: PricedLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  coupon: Coupon | null;
  couponError: string | null;
  freeShippingRemaining: number;
};

export type DashboardStats = {
  todayOrders: number;
  todayRevenue: number;
  monthRevenue: number;
  awaitingTransfer: number;
  toPrepare: number;
  lowStock: { productName: string; sku: string; size: string; color: string; stock: number }[];
};
