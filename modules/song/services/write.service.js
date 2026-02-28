import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import mongoose from "mongoose";
import { calculatePrice } from "../utils/pricing/calculatePrice.js";
import { NotFoundError } from "../errors/index.js";
import { hasAccessToSong } from "../utils/accessControl.js";
import { shapeSongResponse } from "../dto/song.dto.js";
import { User } from "../models/User.js";
import { Artist } from "../models/Artist.js";

// import { BadRequestError } from "../errors/index.js";
// import { songDeletionQueue } from "../queue/songDeletionQueue.js";

export const shapeSongsWithAccess = async ({
  songs,
  user,
  streamUrlResolver = null,
}) => {
  return Promise.all(
    songs.map(async (song) => {
      const hasAccess = user
        ? await hasAccessToSong(user, song)
        : false;

      const streamUrl = hasAccess && streamUrlResolver
        ? await streamUrlResolver(song)
        : null;

      return shapeSongResponse(song, hasAccess, streamUrl);
    })
  );
};


export const createSongService = async ({
  data
}) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const finalPrice = calculatePrice(data);

    const [song] = await Song.create(
      [
        {
          title: data.title,
          artist: data.artist,
          album: data.album || null,
          genre: data.genre,
          duration: data.duration,
          accessType: data.accessType,
          basePrice: finalPrice,
          releaseDate: data.releaseDate,
          coverImageKey: data.coverImageKey || null,
          albumOnly: data.albumOnly || false,
          isrc: data.isrc || null,
          audioKey: data.audioKey,
          convertedPrices: data.convertedPrices || []
        }
      ],
      { session }
    );

    if (data.album) {
      const updatedAlbum = await Album.findByIdAndUpdate(
        data.album,
        { $push: { songs: song._id } },
        { session }
      );

      if (!updatedAlbum) {
        throw new NotFoundError(
          "Album not found while attaching song"
        );
      }
    }

    await session.commitTransaction();
    return song;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};


export const updateSongService = async ({ songId, data, coverImageUrl, audioUrl }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const song = await Song.findById(songId).session(session);
    if (!song) throw new Error("Song not found");

    const oldAlbumId = song.album?.toString();
    const newAlbumId = data.album || null;

    // Update song fields
    song.title = data.title ?? song.title;
    song.artist = data.artist ?? song.artist;
    song.genre = data.genre ?? song.genre;
    song.duration = data.duration ?? song.duration;
    song.price = data.price ?? song.price;
    song.accessType = data.accessType ?? song.accessType;
    song.releaseDate = data.releaseDate ?? song.releaseDate;
    song.album = newAlbumId;

    if (coverImageUrl) song.coverImage = coverImageUrl;
    if (audioUrl) {
      song.audioUrl = audioUrl;
      song.audioKey = audioUrl.split("/").pop().replace(/\.[^/.]+$/, "");
    }

    await song.save({ session });

    // Update album references if changed
    if (oldAlbumId && oldAlbumId !== newAlbumId) {
      await Album.findByIdAndUpdate(oldAlbumId, { $pull: { songs: song._id } }, { session });
    }

    if (newAlbumId && oldAlbumId !== newAlbumId) {
      await Album.findByIdAndUpdate(newAlbumId, { $addToSet: { songs: song._id } }, { session });
    }

    await session.commitTransaction();
    session.endSession();

    return song;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};



// export const deleteSong = async (songId) => {
//   if (!mongoose.Types.ObjectId.isValid(songId)) {
//     throw new Error("Invalid song ID");
//   }

//   const song = await Song.findById(songId);
//   if (!song) throw new Error("Song not found");

//   // Remove song from album if applicable
//   if (song.album) {
//     await Album.findByIdAndUpdate(song.album, { $pull: { songs: song._id } });
//   }

//   // Enqueue S3 deletion
//   await songDeletionQueue.add("deleteSongFiles", {
//     audioUrl: song.audioUrl,
//     coverImage: song.coverImage,
//   });

//   // Delete song from DB
//   await song.deleteOne();

//   return { message: "Song deleted successfully" };
// };