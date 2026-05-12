import { getDiscounts } from "@/actions/home.actions";
import ProductCard from "@/components/shared/ProductCard";
import { HeroFocusButton } from "@/components/shared/HeroFocusButton";
import { normalizeStoreName } from "@/lib/utils";
import Image from "next/image";

export default async function Page() {
  const discounts = await getDiscounts();

  return (
    <>
      <section className="relative mx-4 sm:mx-6 mt-6 overflow-hidden rounded-xl bg-secondary p-8 md:p-16 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12">
        <div className="relative z-10 max-w-xl">
          <h1 className="text-3xl sm:text-4xl md:text-[60px] font-bold text-foreground mb-4 md:mb-6 tracking-tight leading-tight">
            Prihrani pri vsakem nakupu
          </h1>
          <p className="text-base md:text-[18px] font-normal text-muted-foreground mb-6 md:mb-8 leading-relaxed max-w-md">
            Odkrijte najugodnejše cene vaših najljubših izdelkov v vseh
            trgovinah na enem mestu. Pametno nakupovanje, brez truda.
          </p>
          <HeroFocusButton />
        </div>
        <div className="relative w-full max-w-md aspect-video rounded-2xl overflow-hidden shadow-2xl hidden md:block">
          <Image
            src="/images/hero-image.png"
            alt="Izbor živil iz trgovin"
            fill
            className="object-cover"
            sizes="448px"
            priority
          />
        </div>

        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />
      </section>

      <div className="px-4 sm:px-6 pt-8">
        <h2 className="text-2xl sm:text-[30px] font-semibold text-foreground">
          Najvišji popusti
        </h2>
        <p className="text-[14px] font-medium text-muted-foreground uppercase tracking-wider mt-1">
          Današnja selekcija prihrankov
        </p>
      </div>

      <div className="flex gap-4 py-6 overflow-x-auto">
        <div className="shrink-0 w-0" />
        {discounts.map((item) => (
          <div key={item.id} className="shrink-0">
            <ProductCard
              id={item.id}
              imageUrl={item.product.imageUrl}
              brandName={item.product.brand?.name ?? ""}
              productName={item.product.name}
              price={item.price?.toString() ?? ""}
              oldPrice={item.oldPrice?.toString() ?? ""}
              discountPct={item.discountPct}
              stores={
                item.store?.name && normalizeStoreName(item.store.name)
                  ? [normalizeStoreName(item.store.name)!]
                  : []
              }
            />
          </div>
        ))}
        <div className="shrink-0 w-4" />
      </div>
    </>
  );
}
