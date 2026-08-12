"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  /** Empty string, null and undefined all mean "no image". */
  src: string | null | undefined;
  alt: string;
  /**
   * Required: every call site renders at a different width.
   *
   * Inert while `images.unoptimized` is set in next.config.ts — Next drops
   * both `srcSet` and `sizes` before they reach the DOM when unoptimized, so
   * no `sizes` attribute is emitted on any `<img>`. Kept deliberately for
   * when that flag is lifted; the four call sites' tuned values should not
   * be deleted as "unused".
   */
  sizes: string;
  /** Classes for the <Image> itself — object-fit, padding, hover transform. */
  className?: string;
  /** Fallback icon size, e.g. "size-12". */
  iconClassName?: string;
  priority?: boolean;
}

/**
 * A product image that degrades to an icon.
 *
 * Two failure modes, both live in production: the listing carries no imageUrl
 * at all (~1.4% of rows), or a store's CDN 404s a URL it still advertises
 * (about half the Lidl .../si/1/... paths). A truthiness check catches only the
 * first, which is why onError is not optional here.
 *
 * Renders the image or the icon and nothing else — never the positioned
 * wrapper, which differs at all four call sites and stays with the caller.
 */
export function ProductImage({
  src,
  alt,
  sizes,
  className,
  iconClassName,
  priority,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <ImageIcon className={cn("text-border", iconClassName)} aria-hidden />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      priority={priority}
      onError={() => setFailed(true)}
      // This is the app's only cross-origin request: every product image comes
      // straight from a retailer CDN. Withholding the Referer means those six
      // retailers never learn which page a shopper was viewing.
      referrerPolicy="no-referrer"
    />
  );
}
