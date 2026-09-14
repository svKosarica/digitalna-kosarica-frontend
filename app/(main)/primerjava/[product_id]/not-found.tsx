import Link from "next/link";
import { SearchX } from "lucide-react";

export default function ComparisonNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32 px-4 gap-4 text-center">
      <SearchX className="size-16 text-muted-foreground" strokeWidth={1.5} />
      <h1 className="text-2xl font-bold text-foreground">
        Primerjava ni na voljo
      </h1>
      <p className="text-muted-foreground max-w-sm">
        Tega izdelka ni več v ponudbi nobene trgovine, ali pa povezava ni
        pravilna.
      </p>
      <Link
        href="/primerjava"
        className="mt-4 bg-primary text-primary-foreground px-6 py-3 rounded-full font-bold text-sm hover:bg-primary/90 transition-all active:scale-95"
      >
        Poglej druge primerjave
      </Link>
    </div>
  );
}
