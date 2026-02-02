import { buildCdnUrl } from "../utils/cdn/cdn.js";

export const shapeSongResponse = (
  song,
  hasAccess = false,
  streamUrl = null
) => {
  return {
    id: song._id,
    title: song.title,
    slug: song.slug,
    duration: song.duration,
    genre: song.genre,
    releaseDate: song.releaseDate,

    coverImage: song.coverImageKey
      ? buildCdnUrl(song.coverImageKey)
      : null,

    accessType: song.accessType,
    albumOnly: song.albumOnly,
    hlsReady: song.hlsReady,

    // 🎤 Artist (stable shape)
    artist:
      typeof song.artist === "object"
        ? {
            id: song.artist._id,
            name: song.artist.name,
            slug: song.artist.slug
          }
        : song.artist,

    // 💿 Album (stable shape)
    album: song.album
      ? typeof song.album === "object"
        ? {
            id: song.album._id,
            title: song.album.title,
            slug: song.album.slug
          }
        : song.album
      : null,

    // 💰 Price (public contract, not internals)
    price:
      song.accessType === "purchase-only"
        ? song.basePrice
        : null,

    // 🔐 Streaming URL (only if access allowed)
    audioUrl: hasAccess ? streamUrl : null
  };
};