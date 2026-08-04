import {
  getDiscounts,
  getHighestPriceIncrease,
  getMostPopular,
} from "@/actions/home.actions";
import ProductScrollSection from "@/components/shared/ProductScrollSection";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default async function Page() {
  const [discounts, popular, increases] = await Promise.all([
    getDiscounts(),
    getMostPopular(),
    getHighestPriceIncrease(),
  ]);

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
          {/* inline-flex, not flex: an <a> with flex becomes block-level and
              would stretch to the full width of this max-w-xl column, unlike
              the inline-block <button> this replaced. */}
          <Link
            href="/search?filter=DISCOUNT_PCT&order=DESCENDING"
            className="bg-primary text-primary-foreground px-6 py-3 md:px-8 md:py-4 rounded-lg font-semibold tracking-wide shadow-lg hover:shadow-xl transition-all active:scale-95 inline-flex items-center gap-2 cursor-pointer text-sm md:text-base"
          >
            Primerjaj cene
            <ArrowRight className="size-5" />
          </Link>
        </div>
        <div className="relative w-full max-w-md aspect-video rounded-2xl overflow-hidden shadow-2xl hidden md:block">
          <Image
            src="/images/hero-image.jpg"
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

      <ProductScrollSection
        title="Najvišji popusti"
        subtitle="Današnja selekcija prihrankov"
        items={discounts}
        moreHref="/top-discounts"
      />

      <ProductScrollSection
        title="Najbolj priljubljeni"
        subtitle="Izdelki, ki jih kupci najpogosteje kupujejo"
        items={popular}
        moreHref="/popular"
      />

      <ProductScrollSection
        title="Največje podražitve"
        subtitle="Izdelki, ki so se najbolj podražili"
        items={increases}
        badgeVariant="increase"
      />
    </>
  );
}
