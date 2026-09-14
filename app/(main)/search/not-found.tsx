import Link from "next/link";
import { SearchX } from "lucide-react";

export default function SearchNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32 px-4 gap-4 text-center">
      <SearchX className="size-16 text-muted-foreground" strokeWidth={1.5} />
      <h1 className="text-2xl font-bold text-foreground">
        Stran ni bila najdena
      </h1>
      <p className="text-muted-foreground max-w-sm">
        Ta stran ne obstaja. Poskusite z iskanjem po katalogu.
      </p>
      <Link
        href="/search"
        className="mt-4 bg-primary text-primary-foreground px-6 py-3 rounded-full font-bold text-sm hover:bg-primary/90 transition-all active:scale-95"
      >
        Poglej vse izdelke
      </Link>
    </div>
  );
}
