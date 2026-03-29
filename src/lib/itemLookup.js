// itemLookup.js
// Client-side fuzzy search over the canonical item library.
// Same library as vdm-wizard — keeps day-of pricing consistent with the quote.
// The library JSON is fetched once and cached.

import Fuse from 'fuse.js';

let _fuse = null;
let _items = null;

async function loadLibrary() {
  if (_items) return _items;
  // In production this should point to a shared CDN copy or be bundled.
  // For now: fetch from the vdm-wizard public path or a local copy.
  const res = await fetch('/item-library.json');
  const data = await res.json();
  _items = data;
  return data;
}

export async function getFuse() {
  if (_fuse) return _fuse;
  const items = await loadLibrary();
  const flat = items.flatMap(category =>
    (category.items || []).map(item => ({
      ...item,
      category: category.category,
    }))
  );
  _fuse = new Fuse(flat, {
    keys: ['canonical_name', 'aliases'],
    threshold: 0.4,
    includeScore: true,
  });
  return _fuse;
}

/**
 * Search for items matching a query string.
 * Returns up to `limit` results, each with the full item spec.
 */
export async function searchItems(query, limit = 8) {
  const fuse = await getFuse();
  return fuse.search(query, { limit }).map(r => r.item);
}
