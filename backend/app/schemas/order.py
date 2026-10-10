from typing import Optional, Literal, List
from pydantic import BaseModel, Field
from datetime import datetime

# `orders.status` dan `payments.status` punya CHECK constraint di database live,
# jadi nilai-nilai ini adalah kosakata nyata — bukan sekadar konvensi aplikasi:
#
#   orders_status_check   -> pending, paid, processing, shipped, completed, cancelled, expired
#   payments_status_check -> pending, success, failed, expired, refunded
#
# Menulis nilai di luar daftar ini ditolak database (23514).
OrderStatus = Literal["pending", "paid", "processing", "shipped", "completed", "cancelled", "expired"]

PaymentStatus = Literal["pending", "success", "failed", "expired", "refunded"]


class OrderCustomer(BaseModel):
    """Kontak penerima. Disimpan di dalam kolom JSONB `orders.shipping_address`."""

    name: str = Field(..., min_length=2)
    email: str
    phone: str


class OrderAddress(BaseModel):
    """Alamat pengiriman. Disimpan di dalam kolom JSONB `orders.shipping_address`."""

    recipient_name: str = Field(..., min_length=2)
    phone: str = Field(..., min_length=9)
    full_address: str = Field(..., min_length=5)
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None


class OrderItemBase(BaseModel):
    """Item pesanan. `book_id` wajib: skema live tidak menyimpan judul/harga bebas."""

    book_id: str
    quantity: int = Field(..., gt=0, le=99)
    # Dikirim client demi kelengkapan kontrak lama, tetapi TIDAK dipercaya:
    # `OrderService.create` selalu menimpa nya dari tabel `books`.
    title: Optional[str] = None
    unit_price: Optional[float] = Field(default=None, ge=0)


class OrderItemResponse(BaseModel):
    id: str
    order_id: str
    book_id: str
    title: Optional[str] = None
    author: Optional[str] = None
    cover_url: Optional[str] = None
    unit_price: float
    quantity: int
    total_price: float


class OrderCreate(BaseModel):
    # Objek lama (masih dipakai UI saat ini). Nomor telepon/alamat dipakai untuk
    # mengisi `shipping_address` JSONB.
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    shipping_address: Optional[str] = None
    # Bentuk kanonik sesuai skema live.
    customer: Optional[OrderCustomer] = None
    address: Optional[OrderAddress] = None

    # Kurir, layanan, dan ongkir ditentukan backend dari `app.core.shipping`;
    # client hanya memilih id layanan.
    shipping_option_id: str
    payment_method: str
    notes: Optional[str] = None
    items: List[OrderItemBase] = Field(..., min_length=1)

    # Dikirim client lama demi kompatibilitas kontrak, tetapi TIDAK dipercaya:
    # `OrderService.create` menolak nilai yang tidak nol/ kosong. Tidak ada tabel
    # `promos` di database live, jadi belum ada diskon yang bisa divalidasi.
    shipping_fee: float = Field(default=0, ge=0)
    discount_amount: float = Field(default=0, ge=0)
    promo_code: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    tracking_number: Optional[str] = None
    notes: Optional[str] = None


class PaymentStatusUpdate(BaseModel):
    status: PaymentStatus


class OrderResponse(BaseModel):
    id: str
    order_number: str
    user_id: Optional[str] = None

    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    shipping_address: str
    address: Optional[OrderAddress] = None

    courier: Optional[str] = None
    courier_service: Optional[str] = None
    tracking_number: Optional[str] = None

    status: str
    payment_status: str
    payment_method: Optional[str] = None

    subtotal: float
    shipping_fee: float
    discount_amount: float
    total_amount: float

    promo_code: Optional[str] = None
    notes: Optional[str] = None
    created_at: str | datetime
    updated_at: str | datetime
    items: Optional[List[OrderItemResponse]] = []
