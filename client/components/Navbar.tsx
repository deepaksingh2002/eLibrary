"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../store/authStore";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";

export const Navbar: React.FC = () => {
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuthStore();
  const [searchValue, setSearchValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on route change
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, []);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchValue.trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
    setMobileMenuOpen(false);
  };

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/search", label: "Search" },
    ...(user?.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <>
      <nav className="fixed top-0 z-50 w-full border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Logo + desktop nav */}
            <div className="flex flex-shrink-0 items-center gap-6">
              <Link
                href="/"
                className="rounded font-bold text-xl text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="eLibrary Home"
              >
                eLibrary
              </Link>

              {/* Desktop links */}
              <div className="hidden md:flex space-x-6">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded font-medium text-gray-700 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Desktop center search */}
            <form onSubmit={handleSearchSubmit} className="hidden flex-1 justify-center md:flex">
              <div
                className={`flex w-64 items-center rounded-full bg-gray-100 px-4 py-1.5 transition-all ${
                  isFocused ? "ring-2 ring-blue-200" : ""
                }`}
              >
                <span className="mr-2 text-sm text-gray-500" aria-hidden="true">🔍</span>
                <input
                  type="search"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Search books..."
                  className="w-full border-0 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
                />
              </div>
            </form>

            {/* Desktop right side */}
            <div className="hidden md:flex items-center space-x-3">
              {!isAuthenticated ? (
                <>
                  <Link href="/login">
                    <Button variant="ghost" size="sm">Log in</Button>
                  </Link>
                  <Link href="/register">
                    <Button variant="primary" size="sm">Sign up</Button>
                  </Link>
                </>
              ) : (
                <div className="flex items-center space-x-3 relative" ref={dropdownRef}>
                  {user?.role === "admin" && (
                    <span className="hidden sm:inline-flex">
                      <Badge variant="info">Admin</Badge>
                    </span>
                  )}

                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center space-x-2 focus:outline-none rounded-full p-1 hover:bg-gray-50 transition-colors"
                  >
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-600 text-sm overflow-hidden relative"
                      aria-hidden="true"
                    >
                      {user?.avatar ? (
                        <Image width={32} height={32} src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        user?.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="hidden text-sm font-medium text-gray-700 sm:block">
                      {user?.name}
                    </span>
                    <svg
                      className={`h-4 w-4 text-gray-500 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-lg p-1 z-50">
                      <Link
                        href="/dashboard"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-50 cursor-pointer text-gray-700 w-full text-left"
                      >
                        <span aria-hidden="true">🏠</span> Dashboard
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-50 cursor-pointer text-gray-700 w-full text-left"
                      >
                        <span aria-hidden="true">⚙</span> Settings
                      </Link>
                      {user?.role === "admin" && (
                        <Link
                          href="/admin"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-blue-50 cursor-pointer text-blue-700 w-full text-left font-medium"
                        >
                          <span aria-hidden="true">📊</span> Admin Dashboard
                        </Link>
                      )}
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          logout();
                          router.push("/");
                        }}
                        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-red-50 cursor-pointer text-red-600 w-full text-left"
                      >
                        Log out
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile hamburger button */}
            <button
              className="md:hidden ml-auto p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-white flex flex-col pt-16 px-6"
          role="dialog"
          aria-modal="true"
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Logo */}
          <div className="mb-6">
            <span className="font-bold text-xl text-blue-600">eLibrary</span>
          </div>

          {/* Mobile search */}
          <form onSubmit={handleSearchSubmit} className="mb-6">
            <div className="flex items-center rounded-xl bg-gray-100 px-4 py-3 gap-2">
              <span className="text-gray-400">🔍</span>
              <input
                type="search"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search books..."
                className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
              />
            </div>
          </form>

          {/* Nav links */}
          <nav className="flex flex-col gap-1 mb-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="py-4 text-base font-medium text-gray-900 border-b border-gray-100 hover:text-blue-600 transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {isAuthenticated && (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-4 text-base font-medium text-gray-900 border-b border-gray-100 hover:text-blue-600 transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-4 text-base font-medium text-gray-900 border-b border-gray-100 hover:text-blue-600 transition-colors"
                >
                  Settings
                </Link>
              </>
            )}
          </nav>

          {/* Auth actions */}
          <div className="mt-auto pb-8">
            {isAuthenticated ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 py-3 border-b border-gray-100">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">
                    {user?.avatar ? (
                      <Image width={32} height={32} src={user.avatar} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      user?.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{user?.name}</p>
                    <p className="text-xs text-gray-400">{user?.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                    router.push("/");
                  }}
                  className="w-full py-3 text-center text-sm font-medium text-red-600 rounded-xl border border-red-100 hover:bg-red-50 transition-colors"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full">Log in</Button>
                </Link>
                <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="primary" className="w-full">Sign up</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
