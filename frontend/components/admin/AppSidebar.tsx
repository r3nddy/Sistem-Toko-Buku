"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ShoppingCart,
  BookOpen,
  Boxes,
  Users,
  Tag,
  Image as ImageIcon,
  MessageSquare,
  BarChart3,
  TrendingUp,
  Settings,
  HelpCircle,
  ChevronDown,
  LogOut,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  Library,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { siteConfig } from "@/config/site"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface AppSidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string | number
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: "Utama",
    items: [
      { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
      { title: "Pesanan", href: "/admin/pesanan", icon: ShoppingCart, badge: 5 },
      { title: "Produk", href: "/admin/produk", icon: BookOpen },
      { title: "Inventori / Stok", href: "/admin/inventori", icon: Boxes, badge: "3 Kritis" },
      { title: "Pelanggan", href: "/admin/pelanggan", icon: Users },
    ],
  },
  {
    label: "Pemasaran",
    items: [
      { title: "Promo & Voucher", href: "/admin/promo", icon: Tag },
      { title: "Banner Toko", href: "/admin/promo#banner", icon: ImageIcon },
      { title: "Ulasan Produk", href: "/admin/produk#ulasan", icon: MessageSquare },
    ],
  },
  {
    label: "Laporan",
    items: [
      { title: "Laporan Penjualan", href: "/admin/laporan", icon: BarChart3 },
      { title: "Produk Terlaris", href: "/admin/laporan#terlaris", icon: TrendingUp },
    ],
  },
  {
    label: "Sistem",
    items: [
      { title: "Pengaturan", href: "/admin/pengaturan", icon: Settings },
      { title: "Bantuan & CS", href: "/admin/pengaturan#bantuan", icon: HelpCircle },
    ],
  },
]

export function AppSidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: AppSidebarProps) {
  const pathname = usePathname()

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between overflow-hidden">
      {/* Header Logo */}
      <div>
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-200">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-2 shrink-0 font-bold text-slate-900"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-extrabold text-xl shadow-xs">
              G
            </div>
            {!collapsed && (
              <div className="flex flex-col leading-tight">
                <span className="text-lg font-extrabold tracking-tight text-blue-600">
                  {siteConfig.brandName}
                </span>
                <span className="text-[10px] text-slate-500 font-medium tracking-wider uppercase">
                  Admin Dashboard
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
            title={collapsed ? "Buka Sidebar" : "Ciutkan Sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* Nav Items */}
        <div className="space-y-6 px-3 py-4 overflow-y-auto max-h-[calc(100vh-140px)] scrollbar-none">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              {!collapsed && (
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/admin/dashboard" && pathname.startsWith(item.href))
                const Icon = item.icon

                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    onClick={onCloseMobile}
                    title={collapsed ? item.title : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all group relative border-l-4",
                      isActive
                        ? "bg-blue-50 text-blue-700 font-semibold border-blue-600 shadow-xs"
                        : "border-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive
                          ? "text-blue-600"
                          : "text-slate-400 group-hover:text-slate-700"
                      )}
                    />
                    {!collapsed && (
                      <span className="flex-1 truncate">{item.title}</span>
                    )}
                    {!collapsed && item.badge && (
                      <span
                        className={cn(
                          "ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                          typeof item.badge === "string"
                            ? "bg-rose-100 text-rose-700 border border-rose-200"
                            : "bg-blue-600 text-white"
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer User Profile */}
      <div className="border-t border-slate-200 p-3 bg-white">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-slate-100 cursor-pointer transition-colors">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={siteConfig.adminUser.avatar} alt={siteConfig.adminUser.name} />
                <AvatarFallback className="rounded-lg bg-blue-100 text-blue-700 text-xs font-bold">
                  RP
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="truncate text-xs font-semibold text-slate-900">
                      {siteConfig.adminUser.name}
                    </span>
                    <span className="truncate text-[10px] text-slate-500">
                      {siteConfig.adminUser.email}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mb-2 bg-white text-slate-800 border-slate-200 shadow-lg">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-semibold text-slate-900">{siteConfig.adminUser.name}</p>
                <p className="text-[10px] text-slate-500">{siteConfig.adminUser.role}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-100" />
            <DropdownMenuItem asChild>
              <Link href="/admin/pengaturan" className="flex items-center gap-2 text-xs text-slate-700 hover:bg-slate-100 cursor-pointer">
                <User className="h-4 w-4 text-slate-500" />
                <span>Profil Akun</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/pengaturan" className="flex items-center gap-2 text-xs text-slate-700 hover:bg-slate-100 cursor-pointer">
                <Settings className="h-4 w-4 text-slate-500" />
                <span>Pengaturan Sistem</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-100" />
            <DropdownMenuItem
              className="text-xs cursor-pointer text-rose-600 focus:text-rose-600 focus:bg-rose-50"
              onClick={() => {
                alert("Simulasi Logout berhasil.")
              }}
            >
              <LogOut className="h-4 w-4 mr-2 text-rose-500" />
              <span>Keluar</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Inset Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out shrink-0 sticky top-0 h-screen",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 shadow-xl transition-transform duration-300 ease-in-out md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </div>
    </>
  )
}
