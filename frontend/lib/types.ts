export type Book = {
  id: string;
  title: string;
  author: string;
  isbn: string;
  description: string | null;
  price: string | number;
  stock: number;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
};

export type BookPage = {
  items: Book[];
  total: number;
  page: number;
  page_size: number;
};

export type CurrentUser = {
  id: string;
  email: string | null;
  role: string;
};

export type BookInput = {
  title: string;
  author: string;
  isbn: string;
  description?: string | null;
  price: number;
  stock: number;
  cover_url?: string | null;
};

export type BookUpdate = Partial<BookInput>;

// Nilai mengikuti CHECK constraint database live, bukan pilihan bebas:
//   orders_status_check   -> pending, paid, processing, shipped, completed, cancelled, expired
//   payments_status_check -> pending, success, failed, expired, refunded
export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "completed"
  | "cancelled"
  | "expired";

export type PaymentStatus = "pending" | "success" | "failed" | "expired" | "refunded";

export type OrderItemInput = {
  book_id: string;
  quantity: number;
};

export type OrderItem = {
  id: string;
  order_id: string;
  book_id: string;
  title: string | null;
  author: string | null;
  cover_url: string | null;
  unit_price: number;
  quantity: number;
  total_price: number;
};

export type Order = {
  id: string;
  order_number: string;
  user_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  shipping_address: string;
  courier: string | null;
  courier_service: string | null;
  tracking_number: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string | null;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number;
  total_amount: number;
  promo_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
};

export type OrderInput = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: string;
  /** Backend menentukan kurir, layanan, dan tarif dari id ini. */
  shipping_option_id: string;
  payment_method: string;
  notes?: string | null;
  items: OrderItemInput[];
};

export type OrderPageMeta = {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

export type OrderPage = {
  sukses: boolean;
  pesan: string;
  data: Order[];
  meta: OrderPageMeta;
};

// --- Keranjang (server) ---
// `unit_price` dan `stock` selalu berasal dari tabel `books` di server, bukan
// dari client: POST/PATCH hanya mengirim `book_id` + `quantity`.
export type CartItem = {
  id: string;
  book_id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  unit_price: number;
  stock: number;
  quantity: number;
  subtotal: number;
  /** `false` bila stok tidak lagi mencukupi atau bukunya sudah hilang. */
  available: boolean;
};

export type CartPayload = {
  cart_id: string;
  items: CartItem[];
  total_items: number;
  total_price: number;
};

export type CartItemAddInput = {
  book_id: string;
  quantity: number;
};

export type CartMergeInput = {
  items: CartItemAddInput[];
};

/** Jenis diskon; nilainya harus cocok dengan CHECK `ck_promos_discount_type` di DB. */
export type PromoDiscountType = "Persentase" | "Potongan Tetap" | "Gratis Ongkir";

/** Dihitung server dari `is_active` + rentang tanggal, bukan kolom tersimpan. */
export type PromoStatus = "Aktif" | "Jadwal" | "Kadaluarsa" | "Nonaktif";

export type Promo = {
  id: string;
  code: string;
  name: string;
  discount_type: PromoDiscountType;
  discount_value: number;
  min_purchase: number;
  max_discount?: number | null;
  quota: number;
  used_count: number;
  is_active: boolean;
  status: PromoStatus;
  /** ISO date (YYYY-MM-DD); DB memakai DATE, bukan timestamp. */
  start_date: string;
  end_date: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PromoInput = {
  code: string;
  name: string;
  discount_type: PromoDiscountType;
  discount_value: number;
  min_purchase: number;
  max_discount?: number | null;
  quota: number;
  is_active: boolean;
  start_date: string;
  end_date: string;
};

export type PromoUpdate = Partial<Omit<PromoInput, "code">>;

export type SpoilerLevel = "no_spoiler" | "low" | "medium" | "heavy";
export type AIReviewRequest = {
  spoiler_level: SpoilerLevel;
};

export type AIReviewResponse = {
  book_id: string;
  title: string;
  author: string;
  spoiler_level: SpoilerLevel;
  overview: string;
  writing_style: string;
  characters: string;
  strengths: string[];
  weaknesses: string[];
  who_should_read: string;
  verdict: string;
  plot_analysis?: string | null;
  character_development?: string | null;
  ending_analysis?: string | null;
  cached?: boolean;
};
