// dtos/album.dto.js
import { buildCdnUrl } from "../utils/cdn/cdn.js";

export const shapeAlbumResponse = (album) => {
  if (!album) return null;

  return {
    _id: album._id,

    // identity
    title: album.title,
    slug: album.slug,

    // media
    coverImage: album.coverImageKey
      ? buildCdnUrl(album.coverImageKey)
      : null,

    // metadata
    description: album.description || "",
    releaseDate: album.releaseDate,
    genre: album.genre || [],

    // access & pricing
    accessType: album.accessType,
    basePrice: album.basePrice || null,
    convertedPrices: Array.isArray(album.convertedPrices)
      ? album.convertedPrices
      : [],

    // artist (optional populate / aggregation-safe)
    artist: album.artist
      ? {
          _id: album.artist._id || album.artist.id || album.artist,
          name: album.artist.name,
          slug: album.artist.slug,
        }
      : null,

    // songs (ONLY if service populated them)
    songs: Array.isArray(album.songs)
      ? album.songs.map((song) => ({
          _id: song._id,
          title: song.title,
          duration: song.duration,
          accessType: song.accessType,
          coverImage: song.coverImageKey
            ? buildCdnUrl(song.coverImageKey)
            : null,
        }))
      : [],

    createdAt: album.createdAt,
    updatedAt: album.updatedAt,
  };
};
