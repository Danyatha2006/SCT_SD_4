
from pathlib import Path
import csv, json, re
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, HttpUrl

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
CSV_PATH = DATA_DIR / "products.csv"

app = FastAPI(title="ProductScope")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")


class ScrapeRequest(BaseModel):
    url: HttpUrl


def clean_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def parse_number(value):
    if value is None:
        return None
    text = clean_text(value).replace(",", "")
    match = re.search(r"[-+]?\d*\.?\d+", text)
    return float(match.group()) if match else None


def walk_json(value):
    if isinstance(value, dict):
        yield value
        for item in value.values():
            yield from walk_json(item)
    elif isinstance(value, list):
        for item in value:
            yield from walk_json(item)


def jsonld_products(soup, page_url):
    products = []
    for script in soup.select('script[type="application/ld+json"]'):
        raw = script.get_text(strip=True)
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except Exception:
            continue

        for item in walk_json(data):
            item_type = item.get("@type", "")
            types = item_type if isinstance(item_type, list) else [item_type]
            if "Product" not in types:
                continue

            name = clean_text(item.get("name"))
            offers = item.get("offers", {})
            if isinstance(offers, list):
                offers = offers[0] if offers else {}
            price = parse_number(offers.get("price") or item.get("price"))

            aggregate = item.get("aggregateRating", {})
            rating = parse_number(
                aggregate.get("ratingValue") if isinstance(aggregate, dict) else None
            )

            product_url = item.get("url") or page_url
            products.append({
                "name": name,
                "price": price,
                "rating": rating,
                "currency": clean_text(offers.get("priceCurrency")) if isinstance(offers, dict) else "",
                "url": urljoin(page_url, product_url),
                "method": "JSON-LD"
            })
    return products


def selector_products(soup, page_url):
    cards = soup.select(
        "article, .product-card, .product-item, .product, "
        "[data-product], [itemtype*='Product']"
    )
    products = []

    for card in cards[:200]:
        def first(selectors):
            for selector in selectors:
                node = card.select_one(selector)
                if node:
                    value = node.get("content") or node.get("data-price") or node.get_text(" ", strip=True)
                    if clean_text(value):
                        return clean_text(value)
            return ""

        name = first([
            "[itemprop='name']", ".product-title", ".product-name",
            ".title", "h1", "h2", "h3", "h4"
        ])
        price_text = first([
            "[itemprop='price']", ".product-price", ".price",
            "[data-price]", "[class*='price']"
        ])
        rating_text = first([
            "[itemprop='ratingValue']", ".rating", ".stars",
            "[class*='rating']"
        ])
        link = card.select_one("a[href]")
        if not name:
            continue

        products.append({
            "name": name,
            "price": parse_number(price_text),
            "rating": parse_number(rating_text),
            "currency": "",
            "url": urljoin(page_url, link["href"]) if link else page_url,
            "method": "HTML"
        })
    return products


def deduplicate(products):
    result, seen = [], set()
    for product in products:
        name = clean_text(product.get("name"))
        if not name:
            continue
        key = name.casefold()
        if key in seen:
            continue
        seen.add(key)
        product["name"] = name
        result.append(product)
    return result


def scrape_products(url):
    try:
        response = requests.get(
            url,
            timeout=20,
            headers={
                "User-Agent": "Mozilla/5.0 (Educational ProductScope Project; compatible)"
            }
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=400, detail=f"Could not fetch URL: {exc}")

    soup = BeautifulSoup(response.text, "html.parser")
    products = jsonld_products(soup, url)
    if not products:
        products = selector_products(soup, url)

    products = deduplicate(products)
    source = urlparse(url).netloc

    rows = []
    collected_at = datetime.now(timezone.utc).isoformat()
    for product in products:
        rows.append({
            "name": product["name"],
            "price": product["price"],
            "rating": product["rating"],
            "currency": product["currency"],
            "source": source,
            "url": product["url"],
            "method": product["method"],
            "collected_at": collected_at
        })
    return rows


def save_csv(rows):
    fields = ["name", "price", "rating", "currency", "source", "url", "method", "collected_at"]
    with CSV_PATH.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


@app.get("/")
def home():
    return FileResponse(BASE_DIR / "static" / "index.html")


@app.post("/api/scrape")
def scrape(request: ScrapeRequest):
    rows = scrape_products(str(request.url))
    if not rows:
        raise HTTPException(
            status_code=422,
            detail="No product records were found. Try a public page with server-rendered product data."
        )
    save_csv(rows)
    return {"source": urlparse(str(request.url)).netloc, "count": len(rows), "products": rows}


@app.get("/api/export")
def export_csv():
    if not CSV_PATH.exists():
        raise HTTPException(status_code=404, detail="No CSV has been generated yet.")
    return FileResponse(CSV_PATH, media_type="text/csv", filename="productscope_products.csv")


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "ProductScope"}
