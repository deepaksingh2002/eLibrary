"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const AdminNav: React.FC = () => {
  const pathname = usePathname();

  const items = [
    { name: "Dashboard", path: "/admin", icon: "📊" },
    { name: "Books", path: "/admin/books", icon: "📚" },
    { name: "Import", path: "/admin/books/import", icon: "⬆" },
    { name: "Moderation", path: "/admin/reviews", icon: "🚩" },
    { name: "Users", path: "/admin/users", icon: "👤" }
  ];

  return (
    <aside className="w-56 bg-white border-r border-gray-100 min-h-screen flex-col py-6 px-3 hidden md:flex">
      <div className="font-bold text-blue-600 px-3 mb-6">eLibrary Admin</div>
      
      <nav className="flex-1 space-y-1">
        {items.map(item => {
          const isActive = pathname === item.path;
            
          return (
            <Link 
              key={item.path} 
              href={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="pt-4 border-t border-gray-100 mt-auto">
        <Link 
          href="/"
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <span className="text-lg">←</span>
          Back to site
        </Link>
      </div>
    </aside>
  );
};
