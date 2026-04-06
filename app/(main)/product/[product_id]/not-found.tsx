import Link from "next/link";
import { SearchX } from "lucide-react";

export default function ProductNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32 px-4 gap-4 text-center">
      <SearchX className="size-16 text-muted-foreground" strokeWidth={1.5} />
      <h1 className="text-2xl font-bold text-foreground">
        Izdelek ni bil najden
      </h1>
      <p className="text-muted-foreground max-w-sm">
        Izdelek, ki ga iščete, ne obstaja ali pa je bil odstranjen.
      </p>
      <Link
        href="/"
        className="mt-4 bg-primary text-primary-foreground px-6 py-3 rounded-full font-bold text-sm hover:bg-primary/90 transition-all active:scale-95"
      >
        Nazaj na domačo stran
      </Link>
    </div>
  );
}
