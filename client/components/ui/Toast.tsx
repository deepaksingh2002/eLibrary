"use client";

import React from "react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  visible: boolean;
}

type ToastListener = (toast: ToastItem) => void;

let listeners: ToastListener[] = [];
let toastId = 1;

function emitToast(type: ToastType, message: string) {
  const toast: ToastItem = {
    id: toastId++,
    message,
    type,
    visible: true,
  };

  listeners.forEach((listener) => listener(toast));
}

export const toast = {
  success: (message: string) => emitToast("success", message),
  error: (message: string) => emitToast("error", message),
  info: (message: string) => emitToast("info", message),
};

const variantMap: Record<ToastType, string> = {
  success: "bg-green-600 text-white",
  error: "bg-red-600 text-white",
  info: "bg-blue-600 text-white",
};

export const ToastContainer: React.FC = () => {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    const listener: ToastListener = (nextToast) => {
      setItems((current) => [...current.slice(-2), nextToast]);

      window.setTimeout(() => {
        setItems((current) =>
          current.map((item) =>
            item.id === nextToast.id ? { ...item, visible: false } : item
          )
        );
      }, 3000);

      window.setTimeout(() => {
        setItems((current) => current.filter((item) => item.id !== nextToast.id));
      }, 3400);
    };

    listeners.push(listener);
    return () => {
      listeners = listeners.filter((entry) => entry !== listener);
    };
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex max-w-sm flex-col gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          className={`transform rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all duration-300 ${
            variantMap[item.type]
          } ${item.visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
};
