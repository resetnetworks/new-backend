export function normalizeSpotifyData(scrapedData, migrationJobId) {
  const { artist, albums } = scrapedData;

  const normalizedArtist = {
    migrationJobId,
    name: artist.name,
    bio: artist.bio || "",
    image: artist.image || "",
    location: "",
    socials: [],
    genres: [],
  };

  const normalizedAlbums = albums.map(album => {
    return {
      title: album.title,
      description: "",
      releaseDate: album.releaseDate || new Date(),
      genres: album.genres || [],
      coverImage: album.coverImage || "",
      sourceUrl: album.sourceUrl,
      tracks: (album.tracks || []).map(track => {
        return {
          title: track.title,
          duration: track.duration || 0,
          trackNumber: track.trackNumber,
          lyrics: "",
          credits: "",
          audioStatus: "MISSING",
          artwork: album.coverImage || null,
        };
      }),
    };
  });

  return {
    artist: normalizedArtist,
    albums: normalizedAlbums,
  };
}
