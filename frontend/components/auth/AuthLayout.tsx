"use client";

import Image from "next/image";

interface AuthLayoutProps {
  children: React.ReactNode;
  authType: "login" | "register";
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen w-full flex selection:bg-green-500 selection:text-white">
      {/* Left Panel — Dark form area */}
      <div className="relative flex flex-col w-full lg:w-1/2 min-h-screen bg-[#0f0f0f] px-8 py-10 sm:px-12 md:px-16 lg:px-20 overflow-y-auto">
        <div className="flex-1 flex flex-col justify-center w-full max-w-[420px] mx-auto">
          {children}
        </div>
      </div>

      {/* Right Panel — Full-height landscape cover image (hidden on mobile) */}
      <div className="hidden lg:flex flex-1 items-stretch p-4 bg-[#0f0f0f]">
        <div className="relative w-full rounded-2xl overflow-hidden">
          <Image
            src="/images/auth-bg.jpg"
            alt="Scenic alpine landscape"
            fill
            className="object-cover object-center"
            priority
            sizes="50vw"
          />
        </div>
      </div>
    </div>
  );
}
