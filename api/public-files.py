"""GET/HEAD /api/public-files/<storage-path>?convert=jpeg

Crawler-friendly image shim. Social unfurlers (WhatsApp, Twitter) want a real
JPEG with fixed dimensions and no alpha channel; company logos in Supabase's
public bucket may be PNG/SVG/WebP of arbitrary size. This fetches the original
from Supabase public storage and returns a 1200x630 progressive JPEG.

<storage-path> is the path under the public storage root, e.g.
  company-logos/<vendorId>/logo-123.png
which maps to {SUPABASE_URL}/storage/v1/object/public/<storage-path>.

Routing note: Vercel's zero-config catch-all only matched a single path segment
here, so vercel.json rewrites `/api/public-files/(.*)` to this static function
with the subpath in `?path=`. We read `path` from the query, falling back to
parsing the request path for direct hits.

HEAD is supported because WhatsApp probes it before downloading.
"""

import io
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, unquote, urlparse

from PIL import Image, ImageOps

SUPABASE_URL = (
    os.environ.get("SUPABASE_URL")
    or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    or "https://gjpzgdrmfxiwqfijaizb.supabase.co"
).rstrip("/")

TARGET_SIZE = (1200, 630)
MAX_BYTES = 500 * 1024  # re-encode at lower quality above this
PUBLIC_ROOT = "/storage/v1/object/public/"
PREFIX = "/public-files/"
# Only these public buckets may be proxied/converted — never an arbitrary path,
# so the converter can't be coerced into fetching some other public object.
ALLOWED_PUBLIC_PREFIXES = ("inventory-photos/", "company-logos/")
# A pre-signed URL is the only way a PRIVATE object may be fetched here, and only
# for product photos — so the converter can never be coerced into proxying the
# private documents bucket or an arbitrary host.
SIGN_PREFIX = f"{SUPABASE_URL}/storage/v1/object/sign/inventory-photos/"


def _source_url(request_path: str) -> str | None:
    """Resolve the upstream URL to fetch, or None if the request isn't allowed."""
    parsed = urlparse(request_path)
    query = parse_qs(parsed.query)

    # Signed URL for a private product photo (minted by the share endpoint).
    src = query.get("src", [None])[0]
    if src:
        candidate = unquote(src)
        return candidate if candidate.startswith(SIGN_PREFIX) else None

    # Otherwise a public-bucket path, from `?path=` (rewrite) or the URL path.
    rel = query.get("path", [None])[0]
    if rel:
        rel = unquote(rel).lstrip("/")
    else:
        idx = parsed.path.find(PREFIX)
        rel = unquote(parsed.path[idx + len(PREFIX):] if idx != -1 else parsed.path.lstrip("/"))
    if not rel or "://" in rel or ".." in rel:
        return None
    if not rel.startswith(ALLOWED_PUBLIC_PREFIXES):
        return None
    return f"{SUPABASE_URL}{PUBLIC_ROOT}{rel}"


def _fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "mystokk-image-shim"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.read()


def _to_jpeg(data: bytes) -> bytes:
    img = Image.open(io.BytesIO(data))

    # JPEG has no alpha — flatten RGBA/LA/P (and anything else) onto white.
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        background = Image.new("RGBA", img.size, (255, 255, 255, 255))
        img = Image.alpha_composite(background, img).convert("RGB")
    elif img.mode != "RGB":
        img = img.convert("RGB")

    # Resize + centre-crop to exactly 1200x630 (cover).
    img = ImageOps.fit(img, TARGET_SIZE, method=Image.LANCZOS, centering=(0.5, 0.5))

    def encode(quality: int) -> bytes:
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality, progressive=True, optimize=True)
        return buf.getvalue()

    out = encode(85)
    if len(out) > MAX_BYTES:
        out = encode(70)
    return out


class handler(BaseHTTPRequestHandler):
    def _send_headers(self, status: int, length: int | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "image/jpeg")
        if length is not None:
            self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control", "public, max-age=86400, s-maxage=86400")
        self.end_headers()

    # WhatsApp issues a HEAD before downloading — answer with the image headers.
    def do_HEAD(self) -> None:  # noqa: N802 (http.server naming)
        self._send_headers(200)

    def do_GET(self) -> None:  # noqa: N802
        url = _source_url(self.path)
        if not url:
            self.send_response(400)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"Invalid file path.")
            return
        try:
            jpeg = _to_jpeg(_fetch(url))
        except urllib.error.HTTPError as err:
            self.send_response(err.code if err.code in (403, 404) else 502)
            self.end_headers()
            return
        except Exception:
            self.send_response(502)
            self.end_headers()
            return

        self._send_headers(200, len(jpeg))
        self.wfile.write(jpeg)
