import json
import urllib.error
import urllib.request
from pathlib import Path

BASE = "http://127.0.0.1:8000"


def request(method: str, url: str, data: bytes | None = None, headers: dict | None = None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, dict(resp.headers), resp.read()
    except urllib.error.HTTPError as exc:
        return exc.code, dict(exc.headers), exc.read()


status, _, body = request("GET", f"{BASE}/api/health")
print("HEALTH", status, body[:300])

geo_path = Path(__file__).resolve().parents[1] / "samples" / "raw_legacy_cadastre.geojson"
geo = geo_path.read_bytes()
boundary = "----Boundary7MA4YWxkTrZu0gW"
payload = (
    f"--{boundary}\r\n"
    'Content-Disposition: form-data; name="files"; filename="raw_legacy_cadastre.geojson"\r\n'
    "Content-Type: application/geo+json\r\n\r\n"
).encode() + geo + f"\r\n--{boundary}--\r\n".encode()
status, _, body = request(
    "POST",
    f"{BASE}/api/upload",
    payload,
    {"Content-Type": f"multipart/form-data; boundary={boundary}"},
)
print("UPLOAD", status, body[:400])
dataset_id = json.loads(body)["data"]["dataset_id"]

status, _, body = request(
    "POST",
    f"{BASE}/api/harmonize",
    json.dumps({"dataset_id": dataset_id}).encode(),
    {"Content-Type": "application/json"},
)
print("HARMONIZE", status, body[:400])

status, headers, body = request(
    "POST",
    f"{BASE}/api/export-pdf",
    json.dumps({"dataset_id": dataset_id, "owner_name": "M. Ramesh Patil"}).encode(),
    {"Content-Type": "application/json"},
)
print("PDF", status, headers.get("Content-Type"), len(body), headers.get("X-ULPIN"))
