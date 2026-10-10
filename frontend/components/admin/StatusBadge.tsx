import React from "react"
import { OrderStatus, ProductStatus } from "@/types"
import type { PromoStatus } from "@/lib/types"

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  switch (status) {
    case "Menunggu Pembayaran":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
          Menunggu Pembayaran
        </span>
      )
    case "Dibayar":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800 border border-sky-200">
          Dibayar
        </span>
      )
    case "Diproses":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
          Diproses
        </span>
      )
    case "Dikirim":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
          Dikirim
        </span>
      )
    case "Selesai":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
          Selesai
        </span>
      )
    case "Batal":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200">
          Batal
        </span>
      )
    case "Kedaluwarsa":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
          Kedaluwarsa
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
          {status}
        </span>
      )
  }
}

export function ProductStatusBadge({ status, stock }: { status: ProductStatus; stock?: number }) {
  if (stock !== undefined && stock <= 0) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200">
        Habis
      </span>
    )
  }
  if (stock !== undefined && stock <= 5) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
        Kritis ({stock})
      </span>
    )
  }

  switch (status) {
    case "Aktif":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
          Aktif
        </span>
      )
    case "Draft":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
          Draft
        </span>
      )
    case "Habis":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200">
          Habis
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
          {status}
        </span>
      )
  }
}

export function PromoStatusBadge({ status }: { status: PromoStatus }) {
  switch (status) {
    case "Aktif":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
          Aktif
        </span>
      )
    case "Jadwal":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
          Jadwal
        </span>
      )
    case "Kadaluarsa":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
          Kadaluarsa
        </span>
      )
    case "Nonaktif":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
          Nonaktif
        </span>
      )
  }
}

