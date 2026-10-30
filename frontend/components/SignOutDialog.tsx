"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut } from "lucide-react";

type SignOutDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Mengakhiri sesi dan mengarahkan ulang; kembalikan `false` bila gagal. */
  onSignOut: () => Promise<boolean> | boolean;
  /** Menentukan kalimat pertanyaan di dialog. */
  audience?: "admin" | "user";
  /** Warna & aksen mengikuti area tempat dialog dipanggil. */
  tone?: "admin" | "storefront";
};

const copy = {
  admin: {
    title: "Keluar dari akun admin?",
    description:
      "Sesi admin akan diakhiri dan Anda kembali ke halaman masuk. Perubahan yang belum disimpan di halaman ini akan hilang.",
  },
  user: {
    title: "Keluar dari akun?",
    description:
      "Anda perlu masuk kembali untuk melanjutkan belanja, memakai poin, atau melihat pesanan.",
  },
} as const;

/**
 * Konfirmasi sebelum menutup sesi. Dipakai oleh dropdown pengguna di toko
 * maupun sidebar admin supaya keduanya tidak keluar sekali klik.
 *
 * Dialog menutup dirinya sendiri hanya bila sesi benar-benar berakhir;
 * bila gagal, dialog tetap terbuka agar pengguna bisa mencoba lagi.
 */
export default function SignOutDialog({
  open,
  onOpenChange,
  onSignOut,
  audience = "user",
  tone = "storefront",
}: SignOutDialogProps) {
  const [busy, setBusy] = useState(false);
  const { title, description } = copy[audience];

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const ok = await onSignOut();
      if (ok) onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent
        className={
          tone === "admin" ? "admin-theme border-zinc-200 bg-white sm:max-w-sm" : "sm:max-w-sm"
        }
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div
              className={
                tone === "admin"
                  ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600"
                  : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0052cc]/10 text-[#0052cc]"
              }
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="text-left">
              <DialogTitle className="text-base">{title}</DialogTitle>
              <DialogDescription className="mt-1 text-xs">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="mt-4 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="cursor-pointer"
            autoFocus
          >
            Tetap masuk
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={
              tone === "admin"
                ? "cursor-pointer bg-rose-600 text-white hover:bg-rose-700"
                : "cursor-pointer bg-[#0052cc] text-white hover:bg-[#0041a8]"
            }
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Keluar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
