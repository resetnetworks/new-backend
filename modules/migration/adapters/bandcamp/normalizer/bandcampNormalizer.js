export function normalizeData(parsedData, migrationJobId) {
  const { artist, albums } = parsedData;

  const normalizedArtist = {
    migrationJobId,
    name: artist.name || "Unknown Artist",
    bio: artist.bio || "",
    image: artist.image || null,
    genres: artist.genres || [],
    location: artist.location || null,
    website: artist.website || null,
    socialLinks: artist.socialLinks || [],
  };

  const normalizedAlbums = (albums || []).map((album) => {
    let releaseDate = null;
    if (album.releaseDate) {
      try {
        releaseDate = new Date(album.releaseDate);
        if (isNaN(releaseDate.getTime())) {
          releaseDate = null;
        }
      } catch {
        releaseDate = null;
      }
    }

    return {
      migrationJobId,
      title: album.title || "Untitled Album",
      description: album.description || "",
      releaseDate,
      genres: album.genres || [],
      coverImage: album.coverImage || null,
      sourceUrl: album.sourceUrl || null,
      tracks: (album.tracks || []).map((track) => ({
        title: track.title || "Untitled Track",
        duration: track.duration || null,
        trackNumber: track.trackNumber || 1,
        lyrics: track.lyrics || "",
        credits: track.credits || "",
        audioStatus: "MISSING",
        artwork: album.coverImage || null,
      })),
    };
  });

  return {
    artist: normalizedArtist,
    albums: normalizedAlbums,
  };
}

export default { normalizeData };
