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
| `public/images/logo_kosarica.png` | 384 KB | 750×750 | ~40 px header logo, on every page |

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

Remote product images ship at full size. A search page stays around 1.7 MB and
Interspar images stay ~146 KB each. This is accepted: it buys guaranteed
availability with no external dependency and no metered resource anywhere in the
render path. The static-asset work below recovers ~1.9 MB elsewhere.

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

| File | Action | Target |
|---|---|---|
| `kosarica.png` | delete — zero references in `app`, `components`, `lib`, `stories`, `.storybook` | — |
| `hero-image.jpg` | resize to 1200 px wide, quality 80 | ~130 KB |
| `logo_kosarica.png` | recompress in place at 750×750 | ~40 KB |

`logo_kosarica.png` stays a single file rather than splitting header and OG
variants. It serves the header logo, the favicon, the apple-icon and the OG
image; the larger square is what the OG and icon consumers want, and once
compressed it is small enough that a second asset is not worth the extra file.

`hero-image.jpg` is `priority` with `object-cover` in a slot that is at most
576 CSS px wide, so 1200 px covers a 2× display.

Together this removes ~1.9 MB, including ~380 KB from **every page** via the
header logo.

## Verification

No test files in this repo; verification is in Chrome against the dev server,
plus a scripted sweep kept in the scratchpad rather than committed.

The sweep loads `/`, `/search?q=mleko`, `/top-discounts`, `/product/32533` and
`/basket`, scrolls each to the bottom, and asserts:

1. **zero requests to `/_next/image`** — the regression guard that matters most
2. zero broken images among visible ones
3. total image bytes, recorded before and after

Manual checks in Chrome:

1. A search grid shows photos, not icons, across several stores.
2. The header logo renders on every page.
3. The home page hero renders and still looks sharp.
4. `/product/32533` shows its photo.
5. A product with a null `imageUrl` still shows the fallback icon.

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
