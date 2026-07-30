import { loadHtml, extractTralbumData, extractEmbeddedJsonLd } from "../bandcampClient.js";

export function parseArtistHtml(html) {
  const $ = loadHtml(html);
  const jsonLd = extractEmbeddedJsonLd(html);

  // Extract location
  let location = null;
  const bioText = $("#bio-container").text() || $("[class*='bio']").text() || "";
  const fromMatch = bioText.match(/from\s+([^,<\n]+)/i);
  if (fromMatch) {
    location = fromMatch[1].trim();
  } else {
    const rawMatch = html.match(/from\s+([^,<\n]{2,50})/i);
    if (rawMatch) location = rawMatch[1].trim();
  }

  // Extract genres
  const genres = [];
  $("a[href*='/tag/']").each((_, el) => {
    const text = $(el).text().trim();
    if (text && !genres.includes(text)) genres.push(text);
  });

  if (jsonLd) {
    for (const item of jsonLd) {
      if (item.keywords && Array.isArray(item.keywords)) {
        for (const kw of item.keywords) {
          if (!genres.includes(kw)) genres.push(kw);
        }
      }
    }
  }

  return {
    name:
      $('meta[property="og:title"]').attr("content") ||
      $("h1").first().text().trim() ||
      null,
    bio:
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      null,
    image: $('meta[property="og:image"]').attr("content") || null,
    location,
    genres,
    website: null,
    socialLinks: [],
  };
}

export function parseAlbumHtml(html, albumUrl) {
  if (!html) return null;
  const $ = loadHtml(html);
  const jsonLd = extractEmbeddedJsonLd(html);

  // Extract tags
  const tags = [];
  $("a[href*='/tag/']").each((_, el) => {
    const text = $(el).text().trim();
    if (text && !tags.includes(text)) tags.push(text);
  });

  if (jsonLd) {
    for (const item of jsonLd) {
      if (item.keywords && Array.isArray(item.keywords)) {
        for (const kw of item.keywords) {
          if (!tags.includes(kw)) tags.push(kw);
        }
      }
    }
  }

  let releaseDate = null;
  for (const item of jsonLd) {
    if (item.datePublished && !releaseDate) {
      releaseDate = item.datePublished;
    }
  }

  const tracks = [];
  const tralbum = extractTralbumData(html);

  if (tralbum && tralbum.length > 0) {
    tralbum.forEach((t, idx) => {
      tracks.push({
        title: t.title || t.name || null,
        trackNumber: t.track_num || t.trackNum || idx + 1,
        duration: typeof t.duration === "number" ? t.duration : null,
        lyrics: t.lyrics || null,
        credits: t.credits || null,
      });
    });
  } else {
    // HTML fallback
    $("tr.track_row_view").each((idx, el) => {
      const title =
        $(el).find(".track_title").text().trim() ||
        $(el).find("a.track-title").text().trim() ||
        null;

      const durationText = $(el).find(".track_duration").text().trim() || null;
      let durationSec = null;
      if (durationText) {
        const parts = durationText.split(":");
        if (parts.length === 2) {
          durationSec = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        } else if (parts.length === 3) {
          durationSec = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
        }
      }

      if (title) {
        tracks.push({
          title,
          trackNumber: idx + 1,
          duration: durationSec,
          lyrics: null,
          credits: null,
        });
      }
    });
  }

  return {
    title:
      $('meta[property="og:title"]').attr("content") ||
      $("h2.trackTitle, h1").first().text().trim() ||
      null,
    description:
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      null,
    releaseDate,
    coverImage: $('meta[property="og:image"]').attr("content") || null,
    genres: tags,
    sourceUrl: albumUrl,
    tracks,
  };
}

export function parseScrapedData(rawData) {
  const artist = parseArtistHtml(rawData.artistHtml);
  const albums = rawData.albums
    .map((alb) => parseAlbumHtml(alb.html, alb.url))
    .filter(Boolean);

  return {
    artist,
    albums,
  };
}

export default { parseScrapedData };
