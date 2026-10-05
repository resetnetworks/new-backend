import axios from "axios";
import * as cheerio from "cheerio";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const TIMEOUT_MS = 15_000;

async function fetchHtmlWithRetry(url, headers, retries = 4, delayMs = 2000) {
  try {
    const res = await axios.get(url, { timeout: TIMEOUT_MS, headers });
    return res.data;
  } catch (err) {
    const status = err.response?.status;
    if ((status === 429 || status === 503 || status === 403 || !status) && retries > 0) {
      const retryAfterHeader = err.response?.headers?.["retry-after"];
      const waitTime = retryAfterHeader
        ? parseInt(retryAfterHeader, 10) * 1000
        : delayMs * (5 - retries) + Math.floor(Math.random() * 1000);

      console.warn(
        `[BandcampClient] Request failed or rate limited (Status: ${status || "Network Error"}). Retrying ${url} in ${Math.round(waitTime)}ms... (${retries} retries left)`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return fetchHtmlWithRetry(url, headers, retries - 1, delayMs * 1.5);
    }
    throw err;
  }
}

import puppeteer from "puppeteer";

let sharedBrowser = null;
let activeCookieHeader = "";

async function getBrowser() {
  if (!sharedBrowser || !sharedBrowser.isConnected()) {
    sharedBrowser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
      ],
    });
  }
  return sharedBrowser;
}

export async function fetchHtmlWithPuppeteer(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent(getRandomUserAgent());
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));

    // Capture cookies set during JS challenge resolution
    const cookies = await page.cookies();
    if (cookies && cookies.length > 0) {
      activeCookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
      console.log(`[BandcampClient] Captured session cookie from Headless Browser (${cookies.length} cookies).`);
    }

    return await page.content();
  } catch (err) {
    console.error(`[PuppeteerFetcher] Failed to fetch ${url}:`, err.message);
    throw err;
  } finally {
    await page.close().catch(() => {});
  }
}

export async function fetchHtml(url, referer = "") {
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
            <div class="tralbum-about">Mock Album Description</div>
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

  const headers = {
    "User-Agent": getRandomUserAgent(),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    ...(activeCookieHeader ? { Cookie: activeCookieHeader } : {}),
    ...(referer ? { Referer: referer } : {}),
  };

  try {
    const html = await fetchHtmlWithRetry(url, headers, 2, 1000);
    const isChallenge = /Client Challenge/i.test(html);
    if (!isChallenge && html.length > 1000) {
      return html;
    }
    console.warn(`[BandcampClient] Detected Client Challenge page for ${url}. Bypassing with Headless Browser...`);
    return await fetchHtmlWithPuppeteer(url);
  } catch (err) {
    console.warn(`[BandcampClient] Axios request failed for ${url} (${err.message}). Bypassing with Headless Browser...`);
    return await fetchHtmlWithPuppeteer(url);
  }
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
