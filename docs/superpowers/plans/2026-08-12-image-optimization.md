# Image Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take every image off Vercel's metered optimizer so production stops
returning 402, and strip ~1.99 MB of oversized static assets.

**Architecture:** One global switch — `images.unoptimized: true` in
`next.config.ts` — makes `next/image` emit plain `<img>` tags and never build a
`/_next/image` URL, for remote and local sources alike. Vercel transformations go
to zero permanently. Separately, three `public/images` assets are deleted or
recompressed offline with `sharp`, and `app/layout.tsx` is corrected to declare
the OG image's real dimensions.

**Tech Stack:** Next.js 16.1.1 (App Router, Turbopack), React 19, pnpm,
Playwright (already a devDependency) for verification, `sharp` 0.34.5 used
offline only.

**Spec:** `docs/superpowers/specs/2026-08-12-image-optimization-design.md`

## Global Constraints

- **No new dependency may be added to `package.json`.** `sharp` is used via the
  existing pnpm store path, as a one-off local conversion. Only its outputs are
  committed.
- **No test files are added to this repo.** Verification is a Playwright script
  that lives in the scratchpad and is never committed.
- **`next.config.ts` changes require a dev server restart.** Turbopack does not
  hot-reload it. Every task that touches it must restart the server before
  verifying.
- **`remotePatterns` stays in `next.config.ts`.** It is inert while `unoptimized`
  is set but documents the six allowed hosts.
- **Commit messages** use conventional prefixes (`fix:`, `perf:`, `chore:`) and
  end with the trailer:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- **Branch:** `fix/image-optimization-quota`, already created off `development`.
- **Scratchpad path** (referred to below as `$SCRATCH`):
  `/private/tmp/claude-501/-Users-svenahac-Documents-Personal-Projects-digitalna-kosarica-frontend/e090504b-6960-4edb-8aa6-e23b519313f8/scratchpad`

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `next.config.ts` | Build/runtime image policy | Modify — add `images.unoptimized` |
| `public/images/kosarica.png` | none — dead asset | Delete |
| `public/images/hero-image.jpg` | Home page hero | Replace with 1200 px, q80 |
| `public/images/logo_kosarica.png` | Header logo, favicon, apple-icon, OG | Replace with 512×512 palette PNG |
| `app/layout.tsx` | Site metadata | Modify — OG `width`/`height` only |
| `$SCRATCH/imgcheck.mjs` | Verification sweep | Create, **not committed** |
| `$SCRATCH/compress.mjs` | One-off asset conversion | Create, **not committed** |

`components/shared/ProductImage.tsx` is deliberately **not** modified. The global
switch is the single mechanism; its `onError` → `ImageIcon` fallback stays as-is.

---

### Task 1: Build the verification sweep and capture the baseline

The sweep is the regression guard for every later task. It must exist and show
the *current* (bad) state before anything changes.

**Files:**
- Create: `$SCRATCH/imgcheck.mjs` (not committed)

**Interfaces:**
- Consumes: nothing.
- Produces: `node $SCRATCH/imgcheck.mjs <baseUrl>` prints, per page, a line
  `optimizerRequests=<n> visible=<n> loaded=<n> broken=<n> imageBytes=<n>KB`
  and exits non-zero if any page has `optimizerRequests > 0` or `broken > 0`.
  Later tasks rely on that exit code.

- [ ] **Step 1: Export `$SCRATCH` and make sure the dev server is running**

Every later task's commands assume `$SCRATCH` is set. Export it in each shell
session that runs a step from this plan:

```bash
export SCRATCH=/private/tmp/claude-501/-Users-svenahac-Documents-Personal-Projects-digitalna-kosarica-frontend/e090504b-6960-4edb-8aa6-e23b519313f8/scratchpad
mkdir -p "$SCRATCH"
cd /Users/svenahac/Documents/Personal_Projects/digitalna-kosarica-frontend
lsof -ti:3000 >/dev/null || (pnpm dev > "$SCRATCH/dev.log" 2>&1 &)
sleep 8
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
```

Expected: `200`.

- [ ] **Step 2: Link node_modules so the scratchpad can import Playwright**

```bash
ln -sfn /Users/svenahac/Documents/Personal_Projects/digitalna-kosarica-frontend/node_modules "$SCRATCH/node_modules"
```

- [ ] **Step 3: Write the sweep script**

Create `$SCRATCH/imgcheck.mjs`:

```javascript
import { chromium } from "playwright";

const base = process.argv[2] || "http://localhost:3000";
const PAGES = ["/", "/search?q=mleko", "/top-discounts", "/product/32533"];

const browser = await chromium.launch({ channel: "chrome" });
let failed = false;

for (const path of PAGES) {
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  let optimizerRequests = 0;
  let imageBytes = 0;

  page.on("request", (r) => {
    if (r.resourceType() === "image" && r.url().includes("/_next/image")) optimizerRequests++;
  });
  page.on("response", (r) => {
    const ct = r.headers()["content-type"] || "";
    if (ct.startsWith("image/")) imageBytes += Number(r.headers()["content-length"] || 0);
  });

  await page.goto(base + path, { waitUntil: "load" });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(4000);

  const s = await page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      let e = el;
      while (e) { if (getComputedStyle(e).display === "none") return false; e = e.parentElement; }
      return true;
    };
    const imgs = [...document.querySelectorAll("img")].filter(visible);
    return {
      visible: imgs.length,
      loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
      broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
    };
  });

  const bad = optimizerRequests > 0 || s.broken > 0;
  if (bad) failed = true;
  console.log(
    `${bad ? "FAIL" : "ok  "} ${path.padEnd(22)} optimizerRequests=${optimizerRequests} ` +
      `visible=${s.visible} loaded=${s.loaded} broken=${s.broken} ` +
      `imageBytes=${(imageBytes / 1024).toFixed(0)}KB`,
  );
  await page.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
```

- [ ] **Step 4: Run it and confirm it FAILS on optimizer usage**

```bash
cd "$SCRATCH" && node imgcheck.mjs http://localhost:3000; echo "exit=$?"
```

Expected: every line starts `FAIL`, each with `optimizerRequests` well above
zero (roughly 18 on `/product/32533`, 74 on the search page, 95 on
`/top-discounts`), and `exit=1`.

This is the baseline. **Record the `imageBytes` figures** — Task 6 compares
against them.

- [ ] **Step 5: No commit**

Nothing to commit; the script is scratchpad-only by design.

---

### Task 2: Take images off the Vercel optimizer

This is the change that unbreaks production.

**Files:**
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: `$SCRATCH/imgcheck.mjs` from Task 1.
- Produces: no `/_next/image` request anywhere in the app.

- [ ] **Step 1: Confirm the check currently fails**

```bash
cd "$SCRATCH" && node imgcheck.mjs http://localhost:3000; echo "exit=$?"
```

Expected: `exit=1`, `optimizerRequests` non-zero on every page.

- [ ] **Step 2: Add the global switch**

In `next.config.ts`, add the `unoptimized` line and its comment inside the
existing `images` object, immediately above `remotePatterns`:

```typescript
const nextConfig: NextConfig = {
  images: {
    // The catalogue is ~53k listings across six store CDNs and nearly every one
    // is viewed once, so Vercel's optimizer got no cache reuse and billed a
    // transformation per listing. It exhausted the monthly allowance and began
    // answering every /_next/image with 402 — remote and local alike — which
    // tripped ProductImage's onError and turned the whole site into fallback
    // icons. Serving straight from source keeps a metered resource out of the
    // render path entirely, so catalogue growth cannot break images again.
    //
    // Interspar (~half the catalogue) additionally 403s every datacenter IP, so
    // its images can only ever be fetched by the visitor's own browser. That
    // rules out any server-side proxy, Vercel's or our own.
    unoptimized: true,
    // Inert while unoptimized is set. Kept because it documents the six hosts
    // the catalogue actually serves from, and re-enabling optimization later
    // should be a one-line change rather than an archaeology exercise.
    remotePatterns: [
```

Leave the rest of the `remotePatterns` array exactly as it is.

- [ ] **Step 3: Restart the dev server**

Turbopack does not hot-reload `next.config.ts`.

```bash
lsof -ti:3000 | xargs kill 2>/dev/null
cd /Users/svenahac/Documents/Personal_Projects/digitalna-kosarica-frontend
(pnpm dev > "$SCRATCH/dev.log" 2>&1 &)
sleep 10
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
```

Expected: `200`.

- [ ] **Step 4: Run the check and confirm it PASSES**

```bash
cd "$SCRATCH" && node imgcheck.mjs http://localhost:3000; echo "exit=$?"
```

Expected: every line starts `ok`, every page reports `optimizerRequests=0` and
`broken=0`, `loaded` equals `visible`, and `exit=0`.

- [ ] **Step 5: Confirm typecheck and lint are no worse**

```bash
cd /Users/svenahac/Documents/Personal_Projects/digitalna-kosarica-frontend
npx tsc --noEmit && echo "tsc OK"
pnpm lint 2>&1 | tail -3
```

Expected: `tsc OK`. Lint reports the same **6 problems (4 errors, 2 warnings)**
that pre-exist on `development` — all in `stories/Page.tsx` and `proxy.ts`,
neither touched here. More than 6 means this change caused one.

- [ ] **Step 6: Commit**

```bash
cd /Users/svenahac/Documents/Personal_Projects/digitalna-kosarica-frontend
git add next.config.ts
git commit -m "$(cat <<'EOF'
fix: serve images from source instead of Vercel's optimizer

Production answered every /_next/image with 402
OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED, which tripped ProductImage's
onError and rendered the whole site as fallback icons. With ~53k listings
viewed roughly once each the optimizer got no cache reuse and billed a
transformation per listing, so the allowance was always going to run out.

unoptimized takes the metered resource out of the render path entirely.
Interspar also 403s every datacenter IP, so half the catalogue could
never have been proxied by anything anyway.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Delete the dead `kosarica.png`

**Files:**
- Delete: `public/images/kosarica.png` (896 KB)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Prove it is unreferenced**

```bash
cd /Users/svenahac/Documents/Personal_Projects/digitalna-kosarica-frontend
grep -rn "kosarica\.png" --include="*.tsx" --include="*.ts" --include="*.json" \
  --include="*.css" --include="*.md" app components lib stories .storybook public \
  2>/dev/null | grep -v "logo_kosarica" || echo "NO REFERENCES — safe to delete"
```

Expected: `NO REFERENCES — safe to delete`. If anything prints, **stop** — the
file is in use and this task must be skipped.

- [ ] **Step 2: Delete it**

```bash
git rm public/images/kosarica.png
```

- [ ] **Step 3: Verify the app still builds and renders**

```bash
npx tsc --noEmit && echo "tsc OK"
cd "$SCRATCH" && node imgcheck.mjs http://localhost:3000; echo "exit=$?"
```

Expected: `tsc OK` and `exit=0`.

- [ ] **Step 4: Commit**

```bash
cd /Users/svenahac/Documents/Personal_Projects/digitalna-kosarica-frontend
git commit -m "$(cat <<'EOF'
chore: drop unused kosarica.png

896 KB with no reference anywhere in app, components, lib, stories or
.storybook. Not to be confused with logo_kosarica.png, which is the one
actually used.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Compress `hero-image.jpg`

864 KB at 2400×1536, rendered into a slot at most 576 CSS px wide.

**Files:**
- Modify: `public/images/hero-image.jpg`
- Create: `$SCRATCH/compress.mjs` (not committed)

**Interfaces:**
- Consumes: nothing.
- Produces: `hero-image.jpg` at 1200×768, ~100 KB, same filename and extension
  so no `src` in `app/(main)/page.tsx` changes.

- [ ] **Step 1: Record the current size**

```bash
cd /Users/svenahac/Documents/Personal_Projects/digitalna-kosarica-frontend
ls -l public/images/hero-image.jpg | awk '{printf "before: %.0f KB\n", $5/1024}'
```

Expected: `before: 864 KB` (approximately).

- [ ] **Step 2: Write the conversion script**

Create `$SCRATCH/compress.mjs`. It resolves `sharp` from the existing pnpm store
— nothing is installed — and writes to a temp file first, because `sharp` cannot
safely read and write the same path in one pass:

```javascript
import { execSync } from "node:child_process";
import { renameSync } from "node:fs";
import path from "node:path";

const REPO = "/Users/svenahac/Documents/Personal_Projects/digitalna-kosarica-frontend";
const sharpDir = execSync(
  `ls -d ${REPO}/node_modules/.pnpm/sharp@*/node_modules/sharp | head -1`,
).toString().trim();
const { default: sharp } = await import(path.join(sharpDir, "lib", "index.js"));

const [, , which] = process.argv;

if (which === "hero") {
  const dst = path.join(REPO, "public/images/hero-image.jpg");
  const tmp = dst + ".tmp";
  await sharp(dst).resize(1200).jpeg({ quality: 80, mozjpeg: true }).toFile(tmp);
  renameSync(tmp, dst);
  console.log("hero-image.jpg rewritten");
} else if (which === "logo") {
  const dst = path.join(REPO, "public/images/logo_kosarica.png");
  const tmp = dst + ".tmp";
  await sharp(dst).resize(512, 512).png({ palette: true, quality: 90, effort: 10 }).toFile(tmp);
  renameSync(tmp, dst);
  console.log("logo_kosarica.png rewritten");
} else {
  throw new Error("pass 'hero' or 'logo'");
}
```

- [ ] **Step 3: Run it**

```bash
cd "$SCRATCH" && node compress.mjs hero
```

Expected: `hero-image.jpg rewritten`.

- [ ] **Step 4: Verify size and dimensions**

```bash
cd /Users/svenahac/Documents/Personal_Projects/digitalna-kosarica-frontend
ls -l public/images/hero-image.jpg | awk '{printf "after: %.0f KB\n", $5/1024}'
sips -g pixelWidth -g pixelHeight public/images/hero-image.jpg | grep pixel
```

Expected: roughly `after: 100 KB`, `pixelWidth: 1200`, `pixelHeight: 768`.
Anything above 200 KB means the quality setting did not apply — re-check Step 2.

- [ ] **Step 5: Verify the hero still renders correctly**

Open `http://localhost:3000/` in Chrome at desktop width and confirm the hero
image on the right of the fold renders, fills its rounded container via
`object-cover`, and shows no visible compression artefacts. It is a `priority`
image, so it should appear immediately without scrolling.

Then run the sweep:

```bash
cd "$SCRATCH" && node imgcheck.mjs http://localhost:3000; echo "exit=$?"
```

Expected: `exit=0`, and `/` reports a lower `imageBytes` than the Task 1
baseline.

- [ ] **Step 6: Commit**

```bash
cd /Users/svenahac/Documents/Personal_Projects/digitalna-kosarica-frontend
git add public/images/hero-image.jpg
git commit -m "$(cat <<'EOF'
perf: shrink hero-image.jpg from 864 KB to ~100 KB

Was 2400x1536 for a slot at most 576 CSS px wide. Resized to 1200 px,
which still covers a 2x display, and re-encoded with mozjpeg q80. Same
filename, so no src changes.

Now that images bypass the optimizer this file ships exactly as stored,
which makes its size the size every visitor pays.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Compress `logo_kosarica.png` and correct its OG metadata

384 KB at 750×750. Used as the mobile header logo at `width={36}`, and — via
`icons.icon` — as the **favicon**, which every page in every browser downloads.

**Files:**
- Modify: `public/images/logo_kosarica.png`
- Modify: `app/layout.tsx` (OG `width`/`height` only)

**Interfaces:**
- Consumes: `$SCRATCH/compress.mjs` from Task 4.
- Produces: `logo_kosarica.png` at 512×512, ~50 KB, same filename.

- [ ] **Step 1: Record the current size and the wrong metadata**

```bash
cd /Users/svenahac/Documents/Personal_Projects/digitalna-kosarica-frontend
ls -l public/images/logo_kosarica.png | awk '{printf "before: %.0f KB\n", $5/1024}'
sips -g pixelWidth -g pixelHeight public/images/logo_kosarica.png | grep pixel
grep -n "width: 1200" app/layout.tsx
```

Expected: `before: 384 KB`, `pixelWidth: 750`, `pixelHeight: 750`, and a hit on
`width: 1200` — the OG block claims a size the file has never had.

- [ ] **Step 2: Convert the logo**

```bash
cd "$SCRATCH" && node compress.mjs logo
```

Expected: `logo_kosarica.png rewritten`.

- [ ] **Step 3: Verify size, dimensions and transparency**

```bash
cd /Users/svenahac/Documents/Personal_Projects/digitalna-kosarica-frontend
ls -l public/images/logo_kosarica.png | awk '{printf "after: %.0f KB\n", $5/1024}'
sips -g pixelWidth -g pixelHeight -g hasAlpha public/images/logo_kosarica.png | grep -E "pixel|Alpha"
```

Expected: roughly `after: 50 KB`, `pixelWidth: 512`, `pixelHeight: 512`, and
`hasAlpha: yes`. Losing the alpha channel would put a black or white box behind
the logo in the header — if `hasAlpha` is `no`, stop and re-check Step 2 of
Task 4.

- [ ] **Step 4: Correct the declared OG dimensions**

In `app/layout.tsx`, in the `openGraph.images` entry, change only the two
numbers:

```typescript
    images: [
      {
        url: "/images/logo_kosarica.png",
        width: 512,
        height: 512,
        alt: APP_NAME,
      },
    ],
```

Leave `twitter`, `icons`, and everything else untouched.

- [ ] **Step 5: Verify the logo renders and the metadata matches**

```bash
npx tsc --noEmit && echo "tsc OK"
curl -s http://localhost:3000/ | grep -o 'og:image:[a-z]*" content="[0-9]*"'
```

Expected: `tsc OK`, and the emitted tags report `512` for both width and height.

In Chrome, **hard-reload first** (Cmd+Shift+R) — the old 384 KB logo and the
favicon in particular will otherwise be served from browser cache and you will
be looking at the previous file. Then narrow the window below the `sm`
breakpoint (640 px) and confirm the header shows the logo image rather than the
"Digitalna Košarica" wordmark, that it is crisp at 36 px, and that it has no
opaque box behind it. Confirm the favicon renders in the tab.

- [ ] **Step 6: Run the full sweep**

```bash
cd "$SCRATCH" && node imgcheck.mjs http://localhost:3000; echo "exit=$?"
```

Expected: `exit=0` with `optimizerRequests=0` and `broken=0` on every page.

- [ ] **Step 7: Commit**

```bash
cd /Users/svenahac/Documents/Personal_Projects/digitalna-kosarica-frontend
git add public/images/logo_kosarica.png app/layout.tsx
git commit -m "$(cat <<'EOF'
perf: shrink logo_kosarica.png from 384 KB to ~50 KB

icons.icon points at this file, so every page in every browser was
downloading 384 KB for a tab icon. Resized 750x750 to 512x512 as a
palette PNG, keeping the alpha channel.

512 rather than a smaller square because twitter.card is
summary_large_image, which needs at least 300 px on the short side; the
favicon and apple-touch-icon would each have been happy with 256.

Also corrects the openGraph entry, which declared 1200x630 for a file
that has always been square.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Verify the whole change against a production build

Dev and production differ for `next/image`, and the whole bug was
production-only. This task proves the fix holds in a real build.

**Files:** none modified.

**Interfaces:**
- Consumes: `$SCRATCH/imgcheck.mjs`.
- Produces: the before/after report.

- [ ] **Step 1: Build**

```bash
cd /Users/svenahac/Documents/Personal_Projects/digitalna-kosarica-frontend
pnpm build 2>&1 | tail -20
```

Expected: the build completes and prints the route table. The
`DYNAMIC_SERVER_USAGE` messages for `/` are pre-existing and expected — those
routes are marked `ƒ (Dynamic)` on purpose.

- [ ] **Step 2: Start the production server on a spare port**

```bash
lsof -ti:3001 | xargs kill 2>/dev/null
(PORT=3001 pnpm start > "$SCRATCH/prod.log" 2>&1 &)
sleep 8
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/
```

Expected: `200`.

- [ ] **Step 3: Run the sweep against the production build**

```bash
cd "$SCRATCH" && node imgcheck.mjs http://localhost:3001; echo "exit=$?"
```

Expected: `exit=0`, every page `optimizerRequests=0` and `broken=0`.

- [ ] **Step 4: Confirm the fallback icon still works for genuinely missing images**

```bash
curl -s "https://digitalna-kosarica.duckdns.org/api/v1/store/products/60204" \
  | python3 -c "import json,sys; print('imageUrl:', json.load(sys.stdin)['product']['imageUrl'])"
```

Expected: `imageUrl: None`. Then open `http://localhost:3001/product/60204` in
Chrome and confirm it shows the grey `ImageIcon`, not a broken-image glyph. This
proves `ProductImage`'s `onError` path is intact and still meaningful.

- [ ] **Step 5: Verify the basket, which the sweep cannot reach**

The sweep skips `/basket` because an empty cart renders no product images, so
this one is manual. In Chrome on `http://localhost:3001`:

1. Open `/product/32533` and click **Dodaj v Košarico**.
2. Open `/basket`.

Expected: the basket row shows the product photo, not the fallback icon. This
covers `BasketItemCard`, the fourth `ProductImage` call site and the only one
the sweep never exercises.

- [ ] **Step 6: Record the before/after payload**

Compare the `imageBytes` values against the Task 1 baseline and write the
comparison into the PR description. Expected direction: `/` drops sharply (hero
plus favicon), and every page drops ~334 KB from the favicon alone. Search and
top-discounts stay roughly flat on remote product images — that is the accepted
trade-off, not a regression.

- [ ] **Step 7: Stop the production server**

```bash
lsof -ti:3001 | xargs kill 2>/dev/null; echo "stopped"
```

- [ ] **Step 8: Push the branch**

```bash
cd /Users/svenahac/Documents/Personal_Projects/digitalna-kosarica-frontend
git push -u origin fix/image-optimization-quota
```

Then open the pull request against `development`.

- [ ] **Step 9: Verify on the Vercel preview deployment**

Once the preview URL exists, confirm the fix holds where the bug actually lived:

```bash
curl -s -o /dev/null -D- "<PREVIEW_URL>/product/32533" | head -1
cd "$SCRATCH" && node imgcheck.mjs "<PREVIEW_URL>"; echo "exit=$?"
```

Expected: `exit=0` and `optimizerRequests=0`. Because no `/_next/image` request
is made at all, the exhausted quota is no longer reachable and no 402 can occur.

Note the preview runs from a datacenter IP, but that only affects *server-side*
fetches. Images are fetched by your browser, so Interspar still serves them.

---

## Post-merge follow-ups (not in this plan)

- Backend thumbnails for Interspar — the only real fix for the heaviest half of
  the catalogue, and the scraper already reaches it from an allowed IP.
- A per-host proxy loader through wsrv.nl for the five proxyable CDNs, if
  bandwidth becomes the binding constraint.
- Two malformed `imageUrl` rows in the API, e.g. store product 20116
  (`https:/spar.logo.si`, missing a slash).
- A purpose-built ~1.91:1 OG image so `summary_large_image` previews stop being
  a square logo in a wide frame.
