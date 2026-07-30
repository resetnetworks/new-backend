import axios from "axios";
import * as cheerio from "cheerio";

const HEADERS = {
  "User-Agent": "migration-service/1.0 (+https://resetmusic.io)",
};

const TIMEOUT_MS = 15_000;

export async function fetchHtml(url) {
  if (process.env.MOCK_MIGRATION === "true") {
    console.log(`[Mock Client] Intercepted fetchHtml for ${url}`);
    if (url.includes("album") || url.includes("track") || url.includes("releases") || url.includes("mock-album")) {
      return `
        <html>
          <head>
            <meta property="og:title" content="Mock Album Title">
            <meta property="og:description" content="Mock Album Description">
            <meta property="og:image" content="https://f4.bcbits.com/img/a1234_10.jpg">
            <script type="application/ld+json">
              {
                "@context": "http://schema.org",
                "@type": "MusicAlbum",
                "name": "Mock Album Title",
                "datePublished": "2026-07-24T00:00:00Z",
                "keywords": ["electronic", "synthwave"]
              }
            </script>
          </head>
          <body>
            <div data-tralbum='{"trackinfo":[{"title":"Mock Track 1","track_num":1,"duration":210,"lyrics":"Hello World","credits":"Credits 1"}]}'></div>
          </body>
        </html>
      `;
    } else {
      return `
        <html>
          <head>
            <meta property="og:title" content="Mock Artist Name">
            <meta property="og:description" content="Mock Artist Bio">
            <meta property="og:image" content="https://f4.bcbits.com/img/001234_10.jpg">
          </head>
          <body>
            <div id="bio-container">from Tokyo, Japan</div>
            <a href="/album/mock-album">Mock Album Link</a>
          </body>
        </html>
      `;
    }
  }

  const res = await axios.get(url, { timeout: TIMEOUT_MS, headers: HEADERS });
  return res.data;
}

export function loadHtml(html) {
  return cheerio.load(html);
}

export function absoluteUrl(base, href) {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export function extractTralbumData(html) {
  try {
    const $ = cheerio.load(html);
    const dataTralbum = $("[data-tralbum]").attr("data-tralbum");
    if (dataTralbum) {
      const parsed = JSON.parse(dataTralbum);
      if (parsed.trackinfo && Array.isArray(parsed.trackinfo)) {
        return parsed.trackinfo;
      }
    }
  } catch (err) {
    // fallback
  }

  const tralbumMatch = html.match(/TralbumData\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!tralbumMatch) return null;
  try {
    const trackinfoMatch = tralbumMatch[1].match(/trackinfo\s*:\s*(\[[\s\S]*?\])\s*(,|\})/);
    if (!trackinfoMatch) return null;
    return JSON.parse(trackinfoMatch[1].replace(/\n/g, " "));
  } catch {
    return null;
  }
}

export function extractEmbeddedJsonLd(html) {
  const scripts = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g) || [];
  const results = [];
  for (const script of scripts) {
    try {
      const jsonStr = script.match(/>([\s\S]*?)</)[1];
      results.push(JSON.parse(jsonStr));
    } catch {
      // skip
    }
  }
  return results;
}
