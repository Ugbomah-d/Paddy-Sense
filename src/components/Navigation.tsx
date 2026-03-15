"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function Navigation() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const homeHref = user ? "/home" : "/";
  const navItems = [
  { name: "Home", href: homeHref, public: true, desktopHidden: true },
  { name: "Camera", href: "/camera", public: false, desktopHidden: false },
  { name: "History", href: "/history", public: false, desktopHidden: false },
  { name: "Settings", href: "/settings", public: false, desktopHidden: false },
];

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2"
          onClick={() => setIsMenuOpen(false)}
        >
          <span className="text-xl">🌾</span>
          <span className="text-lg font-semibold text-slate-900">
            PaddySense
          </span>
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          {navItems.map((item) => {
            if (!item.public && !user) return null;
            if (item.desktopHidden && !user) return null;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive(item.href)
                    ? "bg-green-100 text-green-800"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <button onClick={logout} className="btn-secondary px-4 py-2">
              Logout
            </button>
          ) : (
            <>
              <Link href="/login" className="btn-secondary px-4 py-2">
                Login
              </Link>
              <Link href="/register" className="btn-primary px-4 py-2">
                Register
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="rounded-lg p-2 text-slate-700 transition hover:bg-slate-100 md:hidden"
          aria-label="Toggle menu"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {isMenuOpen && (
        <div className="border-t border-slate-200/70 bg-white px-4 py-3 md:hidden sm:px-6">
          <div className="space-y-1">
            {navItems.map((item) => {
              if (!item.public && !user) return null;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive(item.href)
                      ? "bg-green-100 text-green-800"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {user ? (
              <button
                onClick={() => {
                  logout();
                  setIsMenuOpen(false);
                }}
                className="btn-secondary col-span-2 w-full"
              >
                Logout
              </button>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="btn-secondary w-full"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  onClick={() => setIsMenuOpen(false)}
                  className="btn-primary w-full"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
