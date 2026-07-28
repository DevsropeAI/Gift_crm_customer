"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getRoleFromToken, getToken } from "@/lib/api";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const role = getRoleFromToken(token);
    if (role === "Customer") {
      router.replace("/portal");
    } else if (role === "Production") {
      router.replace("/production");
    } else {
      router.replace("/leads");
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500" />
    </div>
  );
}
