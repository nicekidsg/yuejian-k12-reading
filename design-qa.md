# Product QA — 100-book reader

Status: passed on 2026-07-15.

## Data and content

- Exactly 100 unique English storybooks are present.
- Every catalog record has a matching cover and a readable, non-empty full-text gzip asset.
- Titles are sourced from Project Gutenberg's Children's Literature bookshelf.
- Duplicate editions, non-English entries, poetry, primers, textbooks, biographies, and scan-only records are excluded.
- Five themes contain exactly 20 books each.

## Interaction smoke test

- Fresh state shows 0 completed, 0 saved, 0 in progress, and 0% overall.
- Catalog shows 100 matches and renders in pages of 20.
- A real book opens inside the product and displays the full English text.
- Reader scroll updates progress; reopening resumes at the saved percentage.
- Favorites add a real book to the shelf and survive reload.
- Reading to 95% or later marks the book complete and advances the correct star-map theme.
- A new mobile context starts at zero.
- All four mobile bottom tabs navigate to distinct views.
- Desktop and mobile pages have no console errors or horizontal document overflow.

## Evidence

- `qa/v3-home-zero.png`
- `qa/v3-reader.png`
- `qa/v3-mobile-trail-zero.png`
- Automated check: `node scripts/browser-smoke.cjs`
