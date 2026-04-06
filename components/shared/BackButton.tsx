"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="group inline-flex items-center gap-2.5 bg-secondary px-4 py-2 rounded-full text-sm font-semibold text-foreground hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer"
    >
      <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
      Nazaj
    </button>
  );
}
