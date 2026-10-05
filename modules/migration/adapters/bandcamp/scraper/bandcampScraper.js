import { fetchHtml, loadHtml, absoluteUrl } from "../bandcampClient.js";

export async function discoverArtistAlbums(artistUrl) {
  const artistHtml = await fetchHtml(artistUrl);

  // 1. Direct Album/Track URL Ingestion Safeguard
  const urlPath = new URL(artistUrl).pathname;
  const isDirectAlbumOrTrack = /\/(album|track)\//i.test(urlPath);

  if (isDirectAlbumOrTrack) {
    return {
      artistUrl,
      artistHtml,
      albumUrls: [artistUrl],
      isSingleAlbum: true,
    };
  }

  const albumUrls = new Set();
  const cleanHost = (host) => (host ? host.replace(/^www\./i, "").toLowerCase() : "");

  let inputHostname;
  try {
    inputHostname = cleanHost(new URL(artistUrl).hostname);
  } catch {
    inputHostname = "";
  }

  const addUrlIfSameHost = (href) => {
    const abs = absoluteUrl(artistUrl, href);
    if (abs) {
      try {
        const absHostname = cleanHost(new URL(abs).hostname);
        if (absHostname === inputHostname || absHostname.endsWith(inputHostname)) {
          const cleanUrl = abs.split("#")[0].split("?")[0];
          albumUrls.add(cleanUrl);
        }
      } catch {
        // Skip invalid URLs
      }
    }
  };

  const parseHtmlForUrls = (htmlText) => {
    const $ = loadHtml(htmlText);

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      if (/\/album\//i.test(href) || /\/releases\//i.test(href) || /\/track\//i.test(href)) {
        addUrlIfSameHost(href);
      }
    });

    $("[data-item-url]").each((_, el) => {
      const href = $(el).attr("data-item-url");
      if (href) addUrlIfSameHost(href);
    });

    $("[data-client-items]").each((_, el) => {
      const attr = $(el).attr("data-client-items");
      if (!attr) return;
      try {
        const items = JSON.parse(attr);
        if (Array.isArray(items)) {
          items.forEach((item) => {
            const pageUrl = item.page_url || item.url;
            if (pageUrl) addUrlIfSameHost(pageUrl);
          });
        }
      } catch {
        // Ignore
      }
    });

    const regexMatches = htmlText.match(/\/(?:album|track)\/[a-zA-Z0-9\-_]+/gi) || [];
    regexMatches.forEach((path) => addUrlIfSameHost(path));
  };

  parseHtmlForUrls(artistHtml);

  // Fallback 1: Try /music subpath if 0 albums found
  if (albumUrls.size === 0 && !artistUrl.endsWith("/music")) {
    try {
      const musicUrl = `${artistUrl.replace(/\/+$/, "")}/music`;
      console.log(`[BandcampScraper] 0 albums on homepage. Checking discography subpath: ${musicUrl}`);
      const musicHtml = await fetchHtml(musicUrl, artistUrl);
      parseHtmlForUrls(musicHtml);
    } catch (err) {
      console.warn(`[BandcampScraper] Failed /music subpath: ${err.message}`);
    }
  }

  // Fallback 2: Single album artist homepage check
  let isSingleAlbum = false;
  if (albumUrls.size === 0) {
    const isSingleAlbumPage = /data-tralbum/i.test(artistHtml) || /TralbumData/i.test(artistHtml) || /MusicAlbum/i.test(artistHtml);
    if (isSingleAlbumPage) {
      console.log(`[BandcampScraper] Detected single featured album page for ${artistUrl}`);
      albumUrls.add(artistUrl);
      isSingleAlbum = true;
    }
  }

  return {
    artistUrl,
    artistHtml,
    albumUrls: Array.from(albumUrls),
    isSingleAlbum,
  };
}

export async function scrapeSingleAlbum(albumUrl, artistUrl = "") {
  const albumHtml = await fetchHtml(albumUrl, artistUrl);
  return {
    url: albumUrl,
    html: albumHtml,
  };
}

export async function scrapeArtistData(artistUrl) {
  const discovery = await discoverArtistAlbums(artistUrl);
  const albums = [];
  for (const url of discovery.albumUrls) {
    try {
      const alb = await scrapeSingleAlbum(url, artistUrl);
      albums.push(alb);
    } catch (err) {
      albums.push({ url, html: null, error: err.message });
    }
  }
  return {
    artistUrl: discovery.artistUrl,
    artistHtml: discovery.artistHtml,
    albums,
  };
}

export default {
  discoverArtistAlbums,
  scrapeSingleAlbum,
  scrapeArtistData,
};
