import { migrationArtistRepository } from "../repositories/migrationArtist.repository.js";
import { migrationAlbumRepository } from "../repositories/migrationAlbum.repository.js";
import { migrationTrackRepository } from "../repositories/migrationTrack.repository.js";

export const saveNormalizedData = async (migrationJobId, normalizedData) => {
  const { artist, albums } = normalizedData;

  let artistRecord = await migrationArtistRepository.findByJobId(migrationJobId);
  if (artistRecord) {
    artistRecord = await migrationArtistRepository.updateByJobId(migrationJobId, artist);
  } else {
    artistRecord = await migrationArtistRepository.create(artist);
  }

  const createdAlbums = [];
  const createdTracks = [];

  const existingAlbums = await migrationAlbumRepository.findByJobId(migrationJobId);
  if (existingAlbums.length > 0) {
    const existingAlbumIds = existingAlbums.map((a) => a._id);
    await import("../models/migrationAlbum.model.js").then(({ MigrationAlbum }) =>
      MigrationAlbum.deleteMany({ migrationJobId })
    );
    await import("../models/migrationTrack.model.js").then(({ MigrationTrack }) =>
      MigrationTrack.deleteMany({ migrationAlbumId: { $in: existingAlbumIds } })
    );
  }

  for (const album of albums) {
    const albumRecord = await migrationAlbumRepository.create({
      migrationJobId,
      artistId: artistRecord._id,
      title: album.title,
      description: album.description,
      releaseDate: album.releaseDate,
      genres: album.genres,
      coverImage: album.coverImage,
      sourceUrl: album.sourceUrl,
    });

    createdAlbums.push(albumRecord);

    for (const track of album.tracks) {
      const trackRecord = await migrationTrackRepository.create({
        migrationAlbumId: albumRecord._id,
        title: track.title,
        duration: track.duration,
        trackNumber: track.trackNumber,
        lyrics: track.lyrics,
        credits: track.credits,
        audioStatus: track.audioStatus,
        artwork: track.artwork,
      });
      createdTracks.push(trackRecord);
    }
  }

  return {
    artist: artistRecord,
    albums: createdAlbums,
    tracksCount: createdTracks.length,
  };
};

export const migrationPersistenceService = {
  saveNormalizedData,
};

export default migrationPersistenceService;
