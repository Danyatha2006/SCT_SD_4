# ProductScope — Task 04

A complete B.Tech-level software development project for:

> Create a program that extracts product information such as names, prices, and ratings from an online e-commerce website and stores the data in a structured format like a CSV file.

## What is implemented

- Modern responsive product intelligence dashboard
- URL input and live collection workflow
- Python FastAPI backend
- `requests` for page retrieval
- BeautifulSoup for HTML extraction
- JSON-LD Product extraction when available
- Generic HTML product-card extraction fallback
- Product name, price, rating, currency and product URL
- Duplicate removal
- Structured CSV generation
- Search and sorting in the dashboard
- CSV download
- Google Colab notebook for the extraction pipeline

## Run locally

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Then open:

```text
http://127.0.0.1:8000
```

The frontend is served by the same backend, so there is no browser CORS issue.

## Google Colab

Upload and open:

`notebook/ProductScope_Task04_Colab.ipynb`

Replace the URL in the notebook with a public page where automated access is permitted.

## Important

Website structures differ. The extractor first checks structured JSON-LD product data and then checks common HTML product-card patterns. It is intended for educational use on pages where scraping is permitted. Respect website Terms of Service, robots.txt, rate limits and applicable law.
