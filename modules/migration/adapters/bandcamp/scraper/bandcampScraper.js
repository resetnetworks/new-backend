import { fetchHtml, loadHtml, absoluteUrl } from "../bandcampClient.js";

const ALBUM_CONCURRENCY = 3;

export async function scrapeArtistData(artistUrl) {
  const artistHtml = await fetchHtml(artistUrl);
  const $ = loadHtml(artistHtml);

  // Discover album URLs
  const albumUrls = new Set();

  // 1. Standard anchor links
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if (/\/album\//i.test(href) || /\/releases\//i.test(href) || /\/track\//i.test(href)) {
      const abs = absoluteUrl(artistUrl, href);
      if (abs) albumUrls.add(abs);
    }
  });

  // 2. Grid items
  $("[data-item-url]").each((_, el) => {
    const href = $(el).attr("data-item-url");
    const abs = absoluteUrl(artistUrl, href);
    if (abs) albumUrls.add(abs);
  });

  // 3. Lazy loaded client items
  $("[data-client-items]").each((_, el) => {
    const attr = $(el).attr("data-client-items");
    if (!attr) return;
    try {
      const items = JSON.parse(attr);
      if (Array.isArray(items)) {
        items.forEach((item) => {
          const pageUrl = item.page_url || item.url;
          if (pageUrl) {
            const abs = absoluteUrl(artistUrl, pageUrl);
            if (abs) albumUrls.add(abs);
          }
        });
      }
    } catch (err) {
      // Ignore
    }
  });

  const urlsToScrape = Array.from(albumUrls);
  const albums = [];
  const queue = [...urlsToScrape];

  // Concurrently scrape album HTML
  async function worker() {
    while (queue.length > 0) {
      const albumUrl = queue.shift();
      try {
        const albumHtml = await fetchHtml(albumUrl);
        albums.push({ url: albumUrl, html: albumHtml });
      } catch (err) {
        console.error(`[BandcampScraper] Failed to fetch album html for ${albumUrl}:`, err.message);
        albums.push({ url: albumUrl, html: null, error: err.message });
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(ALBUM_CONCURRENCY, urlsToScrape.length) },
    worker
  );
  await Promise.all(workers);

  return {
    artistUrl,
    artistHtml,
    albums,
  };
}

export default { scrapeArtistData };
