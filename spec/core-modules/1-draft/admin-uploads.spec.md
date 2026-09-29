# Core Module Spec: Admin — Uploads

**Implements:** Arthur's 2026-09-27 ruling "Uploads everywhere: drag-and-drop box plus click-to-browse, for all asset fields. Don't use URL textboxes alone." PRD `BRAND-02` (sponsor assets), `TEN-04` (tenant isolation), `SEC-02`, `TEN-C1`.

**Depends on:** [`../../infra/environments.spec.md`](../../infra/environments.spec.md) — the stage model, the no-hardcoded-names rule, and `lib/config/environments.ts` as the one home of environment config. [`admin-surface.spec.md`](admin-surface.spec.md) — `resolveAdminScope`, the write gate (`refuseReadOnlyWrite`), `?tenant=` targeting. [`admin-sponsors.spec.md`](admin-sponsors.spec.md), [`admin-prizes.spec.md`](admin-prizes.spec.md), [`admin-branding.spec.md`](admin-branding.spec.md) — the screens whose asset fields this replaces, and their saves, which are unchanged.

**Status:** Draft, written 2026-09-27 for Wave 4.

## Overview

Every image the console asks for is a pasted URL today. The operator has to host the file somewhere first, and nothing checks that the link is an image, how big it is, or that it still resolves tomorrow. This spec replaces every asset field with one upload field, backed by a real S3 bucket in the backend stack.

**The whole change, in one line:** an admin drops or picks an image, the browser sends it straight to S3 under the tenant's own prefix, the server checks what arrived, and the field stores the resulting public https URL, so every reader of these fields keeps working unchanged.

**In scope:**

- The upload field (`UploadField`) in the console, used by every asset field listed below.
- `POST /admin/uploads` (a presigned POST) and `POST /admin/uploads/complete` (the server's check), with contracts in `obs-b2b-shared/src/api/admin/uploads.ts`.
- The asset bucket and its public read path in the backend CDK stack, stage-aware.
- How local `node-server` reaches the bucket.

**Not in scope:**

- **Links that are not assets.** A sponsor's website, its banner link and a prize's claim button link stay link fields: they point somewhere, they are not files.
- **Documents.** Opt-in documents are text stored in the database ([`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md), revision 2026-09-27). Nothing here stores a PDF.
- **Image editing** (crop, resize, background removal). The field shows the image's real size and what the fan app does with it; the operator fixes the file.
- **Fan uploads.** Fans upload nothing.

---

## The fields

Eight fields take an image. There are no others in the console: tenant creation and tiers take no image (a tier picks a library prize). The contest banner joined in Wave 4b.

| Screen | Field | Stored in | Accepted | Smallest raster size |
|---|---|---|---|---|
| Sponsor page, Sign-in | Logo | `B2BSponsor.assets.signInLogo` | PNG, JPEG, WebP, SVG | 40 px tall |
| Sponsor page, Board banner | Banner | `B2BSponsor.assets.boardBanner` | PNG, JPEG, WebP, SVG | 480 px wide |
| Sponsor page, Slider | Icon | `B2BSponsor.assets.sliderIcon` | PNG, JPEG, WebP, SVG | 36 × 36 px |
| Sponsor page, Prize logo | Logo | `B2BSponsor.assets.prizePopupLogo` | PNG, JPEG, WebP, SVG | 48 px tall |
| Prize page (library) | Prize image | `B2BPrize.prizeImageUrl` | PNG, JPEG, WebP | 200 px on the shorter side |
| Brand | Logo | `branding.assets.logo` | PNG, JPEG, WebP, SVG | 64 px on the shorter side |
| Brand | Progress marker | `branding.assets.sliderTipImageUrl` | PNG, JPEG, WebP, SVG | 36 × 36 px |
| Contest builder (Basics) and contest page (Overview) | Contest banner | `B2BContest.bannerImageUrl` | PNG, JPEG, WebP | 800 px wide |
| Contest page (Games tab), each game | Progress marker | `B2BContest.gameMarkerImageUrls[betEventId]` | PNG, JPEG, WebP, SVG | 36 × 36 px |

- **Every field:** at most **5 MB**, at most **4096 px** on either side. The smallest size is the fan app's own box at one pixel per CSS pixel ([`admin-sponsors.spec.md`](admin-sponsors.spec.md), the size table); an SVG has no raster size and is exempt from it.
- **No GIF.** An animated image in a sponsor slot is a different product decision, and a still GIF has no reason to be one.
- **The prize image takes no SVG** because the prize email renders it, and email clients drop SVG.
- **The contest banner takes no SVG, and is wide.** It is a photo-like band of about 4:1 across the top of the contest's card and page, drawn cover-cropped; 800 px wide covers a phone card at 2×. The hint adds "A wide image, about 4 to 1, shown across the top of the contest's card and page." Its writers are the contest's writers (tenant `org:admin`, OBS staff: the same `refuseReadOnlyWrite` gate as every field). The contest takes the URL when its form is saved ([`admin-contests.spec.md`](admin-contests.spec.md), "Banner"); Remove clears it back to the banner's default.
- **One list, one place.** The table is `UPLOAD_FIELDS` in `obs-b2b-shared/src/api/admin/uploads.ts` (`field` id, accepted types, minimum size), read by the console's field and by both endpoints, so the hint under the box and the server's refusal can never disagree.

Field ids: `sponsor.signInLogo`, `sponsor.boardBanner`, `sponsor.sliderIcon`, `sponsor.prizePopupLogo`, `prize.image`, `brand.logo`, `brand.progressMarker`, `contest.banner`, `contest.gameMarker`.

- **A game's progress marker takes the Brand marker's files and size** (`contest.gameMarker`): it is drawn where the Brand marker would be. Its write checks more than the https rule: the address must be one of the tenant's own uploads ([`admin-contests.spec.md`](admin-contests.spec.md), `PUT …/games/:betEventId/marker`).

## What is stored: the URL, as before

**The field stores an https URL, exactly as it does today.** The upload's only output is the public URL of the checked object, and the existing save (the sponsor `PATCH`, the prize library `POST`/`PATCH`, the Brand draft's publish) writes it into the existing field. No reader changes: the fan app, the prize email, the preview, the recap and the sponsor's mark all read a URL and still do.

- **Existing values keep working.** A URL stored before this change shows in the field as a filled upload (its image, its natural size, "Replace" and "Remove"). Nothing is migrated or copied into the bucket.
- **No paste box.** The field has no URL input. An operator whose sponsor sends a link downloads the file and drops it; every image then lives in a bucket the platform controls, which is the point of the ruling.
- **The contracts tighten where they were loose.** The Brand assets (`brandingAssetsSchema`, today any string) and the prize image (`prize-library.ts`, today any string ≤2000, http allowed server-side) accept only https URLs ≤2000, like the sponsor assets already do. A stored relative path or http URL still reads (the read schemas stay `z.string()`); only new writes are checked.

---

## The upload, step by step

```
console                      node-server                        S3 (asset bucket)
  |  pick / drop a file          |                                    |
  |  check type, size, dims      |                                    |
  |-- POST /admin/uploads ------>|  write gate, tenant, field rules   |
  |<-- { url, fields, key } -----|  presigned POST, 5 minutes         |
  |-- multipart POST (file) -------------------------------------->   |
  |<-- 204 ---------------------------------------------------------  |
  |-- POST /admin/uploads/complete { key } -->|  read the object, sniff, measure
  |<-- { url, width, height, bytes } --------|  (deletes it and refuses if wrong)
  |  save the URL through the screen's own write                     |
```

### 1. In the browser

`UploadField` (in `obs-b2b-admin-frontend/src/components/upload/UploadField.tsx`) takes the field id, the current value and an `onUploaded(url)` callback. On a drop or a pick it checks, before any request:

- **Type** by the file's type and extension against the field's list: "Use a PNG, JPG, WebP or SVG file." (the prize image's list names no SVG).
- **Size:** "This file is 7.2 MB. The most is 5 MB."
- **Dimensions**, by decoding the image: "This image is 300 × 20. It needs to be at least 40 pixels tall." / "… at least 480 pixels wide." / "… at least 36 × 36." / "This image is 6000 × 3000. The most is 4096 pixels on a side."

These are courtesies; the server repeats every check.

### 2. `POST /admin/uploads`

Body `{ field, contentType, bytes }`. Auth `requireAdmin` plus the write gate: tenant `org:admin` of a tenant that is not paused, or OBS staff naming `?tenant=`. A caller who cannot save the field cannot upload for it.

- **400** for an unknown field, a type the field does not accept, `bytes` over 5 MB or under 1.
- **503** "Uploads aren't set up on this server." when the process has no bucket configured (below).
- **200** `{ key, uploadUrl, fields, expiresAt }`: a **presigned POST** (`@aws-sdk/s3-presigned-post`, `createPresignedPost`) valid for 5 minutes, whose policy pins:
  - the exact `key`,
  - `Content-Type` equal to `contentType`,
  - `content-length-range` from 1 to 5 MB (S3 itself refuses a bigger body; a presigned PUT cannot enforce size, which is why this is a POST).

**The key is tenant-scoped and unguessable:** `tenants/<organizationId>/<field>/<uuid>.<ext>`, the extension from the content type. The organization id comes from the resolved admin scope, never from the body.

### 3. The browser posts the file to S3

A multipart POST of the returned `fields` plus the file to `uploadUrl`. The field shows a progress bar. S3's own refusals (an expired policy, a body over the limit) show as "The upload didn't finish. Try again."

### 4. `POST /admin/uploads/complete`

Body `{ key }`. Same auth. The server:

1. Refuses a key outside `tenants/<this organizationId>/` (404, as for another tenant's anything).
2. Reads the object (at most 5 MB, so a full read is fine) and **sniffs its real type from its first bytes**, never trusting the declared one: PNG, JPEG, WebP, or an SVG (a text document whose root element is `<svg>`).
3. **Measures it** with `image-size` (raster) or the root's `width`/`height`/`viewBox` (SVG, informational only).
4. Checks the field's rules: accepted type, 4096 px limit, smallest size.
5. For an SVG, refuses a document containing `<script`, an `on…=` event attribute, or a `javascript:` URL ("This SVG contains scripts. Export it again without them."). The CDN's headers (below) are the real defence; this check keeps such files out of the bucket at all.

A file that fails is **deleted** and the answer is 400 with the same plain messages the browser uses. A file that passes answers `{ url, width, height, bytes, contentType }`, where `url` is the public URL ([below](#public-read)). The console then saves `url` through the screen's own write, and shows the measured line from `width` and `height`.

**Why a second call and not an S3 event.** The console needs the verdict before it saves the field; an event handler would answer later, to nobody. The object is small, the check is one read, and the answer arrives in the same interaction.

### Errors the field shows

| Case | Where | Message |
|---|---|---|
| Wrong type | box | "Use a PNG, JPG, WebP or SVG file." |
| Too big | box | "This file is 7.2 MB. The most is 5 MB." |
| Too small | box | "This image is 300 × 20. It needs to be at least 40 pixels tall." |
| Too large in pixels | box | "This image is 6000 × 3000. The most is 4096 pixels on a side." |
| SVG with scripts | box | "This SVG contains scripts. Export it again without them." |
| Upload interrupted or expired | box | "The upload didn't finish. Try again." |
| Uploads not configured | box | "Uploads aren't set up on this server." |
| Save of the field failed | the screen's own save error | unchanged |

Only one file at a time: dropping several takes the first and says "One image at a time."

---

## Storage and public read

### The asset bucket (CDK)

A new construct, `lib/constructs/asset-uploads.ts` in `overboard_sports_backend`, created by `application-stack.ts` for every stage:

- **`AssetBucket`**: an S3 bucket with **no explicit name** (CDK derives one, per `environments.spec.md`), `BlockPublicAccess.BLOCK_ALL`, `enforceSSL`, S3-managed encryption, versioning off. Removal policy follows the stage's existing `deletionProtection` (retained when on, destroyed with auto-delete on a personal stack).
- **CORS** allows `POST` from the console's origins: the stage's configured admin origin(s) from `lib/config/environments.ts`, plus `http://localhost:5174` on dev-account stages (the console's local Vite origin, as `adminAuthorizedParties` already lists it). No wildcard.
- **Public read through CloudFront.** A `Distribution` with the bucket as an origin through **Origin Access Control**; the bucket stays private and only the distribution reads it. A response-headers policy on it sets:
  - `Content-Security-Policy: default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'` and `X-Content-Type-Options: nosniff`, so an SVG opened directly runs nothing;
  - `Cache-Control: public, max-age=31536000, immutable` (every key is new, so nothing is ever overwritten).
- **Access for the API task.** `bucket.grantPut(taskRole)`, `grantRead(taskRole)` and `grantDelete(taskRole)` on `tenants/*`: the presigned POST is signed with the task role's own credentials, so the role must hold the permission the upload uses.
- **Into the container:** `ASSET_BUCKET_NAME` and `ASSET_PUBLIC_BASE_URL` (`https://<distribution domain>`) join `containerEnv` in `main-api-service.ts`. Both are also stack outputs, so a developer can copy them into a local `.env`.

The distribution's default domain (`d…cloudfront.net`) is used as is. A custom domain is a later choice (recorded gap).

<a id="public-read"></a>**The public URL** of an object is `ASSET_PUBLIC_BASE_URL + "/" + key`. It is stable forever: keys are never reused and objects are never overwritten.

### Local `node-server`

**No local-disk fallback.** A developer's `node-server` uses their own personal stack's bucket:

1. Deploy (or redeploy) the personal stack: `cdk deploy -c stage=<name>` with the dev SSO profile.
2. Copy the stack outputs `AssetBucketName` and `AssetPublicBaseUrl` into `node-server/.env` as `ASSET_BUCKET_NAME` and `ASSET_PUBLIC_BASE_URL` (both documented in `.env.example`).
3. The server already runs with `AWS_PROFILE=obs-b2b-dev` (`.env.example`) for the database's IAM login; the S3 client uses the same default credential chain, so the developer's SSO session signs the presigned POST. The SSO role in the dev account holds S3 rights on the dev account's buckets.

With either variable unset, `POST /admin/uploads` answers 503 and the field says so. Unit and integration tests never touch S3: the handlers take an `AssetStore` interface (`presignPost`, `read`, `delete`, `publicUrl`), and tests pass an in-memory one. A local-disk store is not needed, because every developer who runs the console against a backend already has an AWS session for that backend's database.

---

## Permissions and audit

| Action | Gate |
|---|---|
| Request an upload, complete it | `requireAdmin` + the write gate (`refuseReadOnlyWrite`): tenant `org:admin` of an unpaused tenant, or OBS staff on `?tenant=` |
| See an uploaded image | Anyone with its URL (it is shown to fans) |

**Uploads are not audited**, like the saves that use them (`SP-05`, `THEME-10`): an image is configuration, replaced by uploading another. The server logs each completed upload (tenant, field, key, bytes, the caller's user id) at info level, so an odd file can be traced. Nothing personal is ever uploaded.

## Rules

1. **`UP-01` — Every asset field is an upload field.** Drag and drop plus click-to-browse, in every screen that takes an image. No URL box, alone or beside it.
2. **`UP-02` — The field stores a URL.** Readers never change; old stored URLs keep rendering.
3. **`UP-03` — The server checks the bytes, not the claim.** Type by sniffing, size by S3's policy and by reading, dimensions by measuring. A file that fails is deleted.
4. **`UP-04` — Keys are tenant-scoped, server-chosen and never reused.** `tenants/<organizationId>/<field>/<uuid>.<ext>`; a complete call for another tenant's key is 404.
5. **`UP-05` — The bucket is private; fans read through CloudFront.** Origin Access Control, strict response headers, no public bucket policy.
6. **`UP-06` — Stage-aware, nothing named by hand.** The bucket and distribution take CDK-derived names; their names reach the server through environment variables set by the stack.
7. **`UP-07` — One field list.** `UPLOAD_FIELDS` in the shared package drives the console's hint and checks and the server's.

## Tests

- **Shared:** `UPLOAD_FIELDS` covers exactly the eight fields; the https-only asset schemas refuse `http:` and relative paths on write and still read them.
- **Backend unit** (in-memory `AssetStore`): the presign refuses an unknown field, a wrong type, a size over 5 MB, a read-only caller and a paused tenant; the key carries the caller's organization id whatever the body says; complete refuses another tenant's key (404), a PNG declared as JPEG passes as PNG, a text file declared as PNG is deleted and refused, a too-small raster is deleted and refused per field, an SVG with `<script>` is refused, an SVG passes the size minimum; unset bucket variables answer 503.
- **CDK:** a snapshot or assertion test that the stack has one private bucket with BLOCK_ALL, a distribution with OAC and the headers policy, the three grants on the task role, the two container variables, and no explicit bucket name.
- **Console:** `UploadField` states (empty, dragging over, uploading, error, filled) and its local refusals; each screen with an image field renders an `UploadField` and no URL input for its image.
- **End to end** (the Wave 3 harness in `node-server/scripts/e2e/`, or a Playwright console walk): upload a PNG as a sponsor's board banner on the personal stack, place the sponsor on the harness contest, and assert the fan board's banner `src` is the CloudFront URL and loads.

## Recorded gaps (recorded, not blocking, never on screen)

- **Orphaned objects.** A file uploaded and then never saved, or replaced later, stays in the bucket. A sweep that deletes `tenants/` objects no document references is a later script; at dev volume it costs nothing.
- **Tenant deletion leaves the tenant's files.** `deleteAdminTenant` should delete `tenants/<organizationId>/`; added with the sweep.
- **No custom asset domain.** URLs use the CloudFront default domain. A branded domain needs a certificate and DNS per stage.
- **No resizing.** A 4000-pixel banner is served at full size to a 358-pixel column. Resized variants (or CloudFront image resizing) are the fix if page weight matters.
- **No virus scanning.** Only images are accepted and they are sniffed and measured; a scanner is out of proportion for that.

## References

- Ruling 2026-09-27, "Uploads everywhere" (`artifacts/review-2026-09-27/arthur-rulings-2026-09-27.md`, workspace)
- [`../../infra/environments.spec.md`](../../infra/environments.spec.md) — stages, naming, `environments.ts`
- Current code replaced: `obs-b2b-admin-frontend/src/components/sponsors/SponsorDrawer.tsx` (`TextField` image rows), `src/pages/prizes/PrizeLibrary.tsx` ("Prize image URL"), `src/pages/Branding.tsx` (the Images card's Logo and Progress marker rows)
- `overboard_sports_backend/lib/constructs/main-api-service.ts` (container environment, task role), `lib/application-stack.ts`, `lib/config/environments.ts`
- Mock: `mocks/console-v2/sponsor-page.html` (workspace), the upload field in use; `mocks/console-v2/w4-shared.css`, the field's markup and states
