"use client";

import React from "react";
import { useToast } from "@/contexts/ToastContext";

export function ToastViewport() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 left-0 right-0 z-[999] flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          onClick={() => removeToast(toast.id)}
          className={`w-full max-w-md rounded-xl px-4 py-3 text-sm shadow-lg ${
            toast.type === "success"
              ? "bg-emerald-500/20 text-emerald-200"
              : toast.type === "error"
              ? "bg-red-500/20 text-red-200"
              : "bg-slate-800 text-slate-200"
          }`}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}

