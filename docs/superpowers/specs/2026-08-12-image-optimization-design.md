# Image optimization and the Vercel transformation quota

Date: 2026-08-12
Branch: `fix/image-optimization-quota` (off `development`)

## Problem

Every image on the deployed site renders as the grey fallback icon. The API is
healthy and returns good `imageUrl` values; the images break anyway.

The cause is Vercel's image optimizer refusing every request:

```
GET /_next/image?url=…mercatoronline.si…&w=640&q=75
HTTP/2 402
x-vercel-error: OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED
```

The monthly Image Optimization allowance is exhausted. The failing `<img>` fires
`onError` in `ProductImage.tsx`, which sets `failed` and swaps in `ImageIcon`.
The component behaves exactly as written — it just cannot tell "this store 404'd
one photo" from "the platform is refusing all of them".

This was not a spike. The catalogue is **53,088 listings across six store CDNs**
and nearly every listing is viewed once, so the optimizer gets almost no cache
reuse and bills roughly a transformation per listing. The allowance was always
going to run out; the recent Tuš work simply added more listings to browse.

The exhaustion is account-wide, not per-image-kind. Local `/public` assets 402 on
a cache miss too:

| Request | Result |
|---|---|
| `/_next/image?url=%2Fimages%2Flogo_kosarica.png&w=2048&q=75` | `402`, `x-vercel-cache: MISS` |
| `/_next/image?url=…mercatoronline.si…&w=2048&q=75` | `402`, `x-vercel-cache: MISS` |

A `200` on a common width is a stale cache hit from before the quota blew, not
evidence that anything still works. Any fix that leaves *some* images on the
optimizer leaves those images broken until the billing period resets.

## Goal

1. Images render on production, permanently and independently of any quota.
2. Vercel image transformations are **zero**, so catalogue growth cannot
   reintroduce this failure.
3. Shipped bytes drop wherever that is free to do.

## Investigation findings

These measurements drove the decision and are recorded so the next person does
not repeat them.

### Interspar cannot be proxied by anything

`cdn1.interspar.at` is roughly half the catalogue and by far the heaviest
source. It blocks server-side fetchers by IP:

| Client | Result |
|---|---|
| Slovenian residential IP (any user-agent, with or without a `vercel.app` referer) | `200` |
| wsrv.nl | `403` |
| allorigins | `520` |
| codetabs | `522` |

The block is IP-based, not user-agent-based — the same user-agent succeeds from a
consumer connection. So a self-hosted `sharp` route on Vercel would be blocked
too, and quite possibly Vercel's own optimizer. **Interspar images must be
fetched directly by the visitor's browser.** Visitors are on Slovenian consumer
connections, which Interspar serves.

Interspar also publishes exactly one variant. `dt_detail`, `dt_medium`,
`dt_small`, `dt_thumb`, `dt_list` and `gallery_zoom` all 404; only `dt_zoom.jpg`
exists, at ~146 KB and 1001 px wide, rendered into a 216 px card.

### No host uses hotlink protection

All six CDNs return `200` for a direct request carrying
`Referer: https://digitalna-kosarica-frontend.vercel.app/`. Loading images
straight from the browser is safe.

### Current payload

Measured above the fold at 1512×900, before any change:

| Page | Image payload |
|---|---|
| `/search?q=mleko` | 1,742 KB (Interspar alone: 1,041 KB) |
| `/top-discounts` | 1,206 KB (Interspar: 700 KB) |
| `/product/32533` | 688 KB |

### Static assets are oversized

| File | Size | Dimensions | Rendered at |
|---|---|---|---|
| `public/images/kosarica.png` | 896 KB | 1280×1280 | nowhere — no references |
| `public/images/hero-image.jpg` | 864 KB | 2400×1536 | 576 CSS px slot, home page |
| `public/images/logo_kosarica.png` | 384 KB | 750×750 | 36 px header logo (mobile only), **favicon**, apple-icon, OG image |

`logo_kosarica.png` is the expensive one. The header renders it at `width={36}`
and only below `sm`, but `icons.icon` in `app/layout.tsx` also makes it the
favicon, so **every page in every browser downloads 384 KB for a tab icon**.

`app/layout.tsx:25` additionally declares the OG image as `1200×630` while the
file is `750×750`. Pre-existing and unrelated to the quota, but it is a wrong
declaration in a file this work already edits, so it is corrected here.

## Approach

Bypass the optimizer globally and let browsers fetch images directly.

```ts
// next.config.ts
images: { unoptimized: true }
```

`next/image` then emits plain `<img>` tags pointing at the real URL and never
constructs a `/_next/image` request, for remote or local sources. Transformations
go to zero, so the 402 cannot recur at any catalogue size.

### Why not a proxying image CDN

A per-host loader sending the five proxyable CDNs through wsrv.nl was designed
and rejected for now. It works well on those five — 3.8× to 19× smaller — but it
cannot touch Interspar, which is both half the catalogue and the heaviest half.
It would add a third-party runtime dependency to every product image in exchange
for savings on the lighter half. It stays recorded as a follow-up because it is
one file to add if bandwidth becomes the binding constraint.

### Why not a self-hosted `sharp` route

Interspar would 403 it, so it buys nothing the global switch does not, while
adding code and function invocations.

### Trade-off

Remote product images ship at full size, and `unoptimized` drops `srcSet` as
well as `sizes`, so the browser has no smaller variant to request even if one
existed. Measured desktop (1512×900), comparing a dev build with a *working*
optimizer against a production build after this branch:

| Page | Before | After |
|---|---|---|
| `/` | 574 KB | 1,240 KB |
| `/search?q=mleko` | 815 KB | 2,581 KB |
| `/top-discounts` | 644 KB | 1,938 KB |
| `/product/32533` | 480 KB | 358 KB |

Mobile (390×844, DPR 2) is proportionally worse, for the same reason: phones
now receive byte-for-byte what desktops receive. After this branch: `/` 794 KB,
`/search?q=mleko` 2,655 KB, `/top-discounts` 2,011 KB.

The worst offender is oversized source images painted into small slots. On
`/top-discounts` the median natural-to-CSS width ratio is **12.5×** — Interspar
publishes only its 1001 px `dt_zoom.jpg`, which lands in an 80 CSS px list
thumbnail. On `/search` it is 3.8×.

The comparison baseline above is a *working* optimizer — real production was
serving no images at all, so this is still strictly better than the state it
replaces. Interspar images stay ~146 KB each regardless. The static-asset work
below separately recovers ~1.99 MB.

## Changes

### `next.config.ts`

Set `images.unoptimized: true`, with a comment recording why.

Keep `remotePatterns`. It is inert while `unoptimized` is set, but it documents
the six allowed hosts and makes re-enabling optimization a one-line change rather
than an archaeology exercise.

### `components/shared/ProductImage.tsx`

Unchanged. An `unoptimized` prop here was used as a stopgap during
investigation and is deliberately **not** kept: the global switch is the
guarantee, and one mechanism in one place is better than two. The rationale lives
in `next.config.ts`.

The existing `onError` → `ImageIcon` path stays exactly as it is. With the
optimizer gone it returns to meaning what it was written to mean: this particular
store CDN failed. The 842 listings (1.6%) with a null `imageUrl` keep showing the
icon correctly, as they should.

### Static assets

Measured with `sharp` 0.34.5, which is already present in the pnpm store as a
transitive dependency of Next. These are one-off local conversions whose outputs
are committed — **no new dependency is added** to `package.json`.

| File | Action | Before | After (measured) |
|---|---|---|---|
| `kosarica.png` | delete — zero references in `app`, `components`, `lib`, `stories`, `.storybook` | 896 KB | — |
| `hero-image.jpg` | resize to 1200 px wide, JPEG q80 mozjpeg | 864 KB | **100 KB** |
| `logo_kosarica.png` | resize to 512×512, palette PNG | 384 KB | **50 KB** |

These are measured outputs, not estimates. Alternatives were compared and
rejected: the hero at WebP q80 is 70 KB, but changing the extension would mean
editing the `src` in `app/(main)/page.tsx` for a 30 KB gain; the logo at 750×750
palette PNG is 94 KB, and at 256×256 is only 16 KB.

512×512 rather than the cheaper 256×256 because `app/layout.tsx` sets
`twitter.card: "summary_large_image"`, which requires a minimum of 300 px on the
short side. 256 would satisfy the favicon (48 px) and the apple-touch-icon
(180 px) but fall below that Twitter floor. 512 clears every consumer with
margin, and at 50 KB a second asset is not worth splitting header from OG.
Palette PNG preserves the alpha channel the logo actually uses.

`hero-image.jpg` is `priority` with `object-cover` in a slot at most 576 CSS px
wide, so 1200 px still covers a 2× display.

### `app/layout.tsx`

Correct the OG image dimensions from the declared `1200×630` to the true
`512×512`. Metadata that misdescribes its own asset causes social platforms to
mis-crop the preview.

This makes the declaration honest; it does not make the asset ideal. A square
logo is a poor `summary_large_image`, which wants roughly 1.91:1. Producing a
purpose-built wide OG image is listed as a follow-up rather than folded in here,
since it is a design task, not an optimization one.

Together this removes **~1.99 MB**, including ~334 KB from every page load,
since that file is the favicon.

## Verification

No test files in this repo; verification is in Chrome against the dev server,
plus a scripted sweep kept in the scratchpad rather than committed.

The sweep loads `/`, `/search?q=mleko`, `/top-discounts` and `/product/32533`,
scrolls each to the bottom, and asserts:

1. **zero requests to `/_next/image`** — the regression guard that matters most
2. zero broken images among visible ones
3. total image bytes, recorded before and after

Manual checks in Chrome:

1. A search grid shows photos, not icons, across several stores.
2. The header logo renders below `sm`, and the favicon appears in the tab.
3. The home page hero renders and still looks sharp at full width.
4. `/product/32533` shows its photo.
5. A product with a null `imageUrl` still shows the fallback icon — verified
   against a known one such as 60204 or 63194.
6. `/basket` with an item added shows that item's photo.

Production verification after deploy: confirm `/_next/image` appears nowhere in
the network panel, and that images render for a visitor on a Slovenian
connection.

## Follow-ups (not in this PR)

- **Backend thumbnails for Interspar.** The scraper already reaches Interspar
  from an allowed IP. Storing a resized thumbnail alongside each listing is the
  only real fix for that half of the catalogue, and would cut the heaviest images
  by roughly 10×.
- **Per-host proxy loader** for the five proxyable CDNs (Mercator, Hitri Nakup,
  Lidl, Tuš, Aldi) if bandwidth becomes the binding constraint.
- **Two malformed `imageUrl` rows** in the API, e.g. store product 20116, whose
  value is `https:/spar.logo.si` — a missing slash. A backend data fix.
- **A purpose-built OG image** at roughly 1.91:1, so `summary_large_image`
  previews stop being a square logo in a wide frame.
- **`metadataBase` points at a domain that does not exist.** `app/layout.tsx:8`
  sets `APP_URL = "https://digitalna-kosarica.si"`, which is NXDOMAIN (verified
  against 8.8.8.8). Every `og:image` and `twitter:image` URL is therefore
  unfetchable, which means the OG dimension correction in this branch has no
  observable effect until the domain exists or `APP_URL` points at the live
  host. Pre-existing, not caused by this branch.
- **Two of the six CDNs send no cache headers.** `hitrinakup.com` and
  `mercatoronline.si` return no `Cache-Control` and no `Expires`, only
  `ETag`/`Last-Modified`, so browsers fall back to heuristic freshness.
  `cdn1.interspar.at` sends `max-age=86400`, `www.lidl.si` a year. Repeat-visit
  cost is no longer under our control now that the optimizer no longer applies
  uniform headers from our own origin.
