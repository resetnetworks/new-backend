import axios from "axios";
import * as cheerio from "cheerio";

const TIMEOUT_MS = 15_000;
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
};

/**
 * Fetch HTML of a Spotify URL. Supports local mocking for testing.
 */
export async function fetchHtml(url) {
  if (process.env.MOCK_MIGRATION === "true") {
    console.log(`[Mock Spotify Client] Intercepted fetchHtml for ${url}`);
    if (url.includes("/album/") || url.includes("mock-album")) {
      return `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "http://schema.org",
                "@type": "MusicAlbum",
                "name": "Mock Spotify Album",
                "datePublished": "2026-08-01",
                "genre": ["pop", "dance"],
                "image": "https://f4.bcbits.com/img/a1234_10.jpg",
                "track": {
                  "@type": "ItemList",
                  "itemListElement": [
                    {
                      "@type": "ListItem",
                      "position": 1,
                      "item": {
                        "@type": "MusicRecording",
                        "name": "Spotify Mock Track 1",
                        "duration": "PT3M15S"
                      }
                    }
                  ]
                }
              }
            </script>
          </head>
          <body>
          </body>
        </html>
      `;
    } else {
      return `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "http://schema.org",
                "@type": "MusicGroup",
                "name": "Mock Spotify Artist",
                "description": "Scraped bio description from Spotify",
                "image": "https://f4.bcbits.com/img/001234_10.jpg"
              }
            </script>
          </head>
          <body>
            <a href="https://open.spotify.com/album/mock-album">Album Link 1</a>
          </body>
        </html>
      `;
    }
  }

  const res = await axios.get(url, { timeout: TIMEOUT_MS, headers: HEADERS });
  return res.data;
}

/**
 * Extract JSON-LD scripts from the fetched HTML
 */
export function extractJsonLd(html) {
  const $ = cheerio.load(html);
  const jsonLdData = [];
  
  $('script[type="application/ld+json"]').each((_, elem) => {
    try {
      const text = $(elem).text().trim();
      if (text) {
        jsonLdData.push(JSON.parse(text));
      }
    } catch (err) {
      // Skip malformed JSON
    }
  });

  return jsonLdData;
}

/**
 * Parses artist page HTML to get metadata and discover album links
 */
export async function scrapeArtistPage(artistUrl) {
  const html = await fetchHtml(artistUrl);
  const jsonLds = extractJsonLd(html);
  
  // Find MusicGroup data
  const artistData = jsonLds.find(j => j["@type"] === "MusicGroup");
  if (!artistData) {
    throw new Error("Could not find artist metadata on Spotify page");
  }

  // Parse links matching /album/ pattern
  const $ = cheerio.load(html);
  const albumUrls = new Set();

  const extractUrls = (pageHtml) => {
    const $ = cheerio.load(pageHtml);
    $("a").each((_, elem) => {
      const href = $(elem).attr("href");
      if (href && href.includes("/album/")) {
        if (href.startsWith("http")) {
          albumUrls.add(href);
        } else {
          albumUrls.add(`https://open.spotify.com${href}`);
        }
      }
    });
  };

  // 1. Extract from main page
  extractUrls(html);

  // 2. Fetch and extract from discography page
  const artistIdMatch = artistUrl.match(/artist\/([a-zA-Z0-9]+)/);
  if (artistIdMatch) {
    const artistId = artistIdMatch[1];
    const discoUrl = `https://open.spotify.com/artist/${artistId}/discography/album`;
    try {
      console.log(`[SpotifyScraper] Fetching discography page: ${discoUrl}`);
      const discoHtml = await fetchHtml(discoUrl);
      extractUrls(discoHtml);
    } catch (err) {
      console.warn(`[SpotifyScraper] Failed to fetch discography page: ${err.message}`);
    }
  }

  return {
    name: artistData.name,
    bio: artistData.description || "",
    image: artistData.image || "",
    albumUrls: Array.from(albumUrls),
  };
}

/**
 * Parses album page HTML to extract full tracklist and release info
 */
export async function scrapeAlbumPage(albumUrl) {
  const html = await fetchHtml(albumUrl);
  const jsonLds = extractJsonLd(html);
  
  // Find MusicAlbum data
  const albumData = jsonLds.find(j => j["@type"] === "MusicAlbum");
  if (!albumData) {
    throw new Error(`Could not find album metadata on Spotify page: ${albumUrl}`);
  }

  const tracks = [];
  if (albumData.track && albumData.track.itemListElement) {
    albumData.track.itemListElement.forEach(item => {
      if (item.item && item.item["@type"] === "MusicRecording") {
        tracks.push({
          title: item.item.name,
          trackNumber: item.position || 1,
          duration: parseISO8601Duration(item.item.duration),
        });
      }
    });
  }

  return {
    title: albumData.name,
    releaseDate: albumData.datePublished ? new Date(albumData.datePublished) : new Date(),
    genres: albumData.genre || [],
    coverImage: albumData.image || "",
    tracks,
    sourceUrl: albumUrl,
  };
}

/**
 * Helper to convert ISO 8601 duration (e.g. "PT3M15S") into seconds.
 */
function parseISO8601Duration(durationStr) {
  if (!durationStr) return 0;
  const match = durationStr.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const minutes = parseInt(match[1] || 0, 10);
  const seconds = parseInt(match[2] || 0, 10);
  return minutes * 60 + seconds;
}
