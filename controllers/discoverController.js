import { Artist } from "../models/Artist.js";
import { Song } from "../models/song.model.js";
import { StatusCodes } from "http-status-codes";
import { Album } from "../models/album.model.js";
import { shapeAlbumResponse } from "../dto/album.dto.js";
import { shapeSongResponse } from "../dto/song.dto.js";


export const getRandomArtistWithSongs = async (req, res) => {
  // 1️⃣ Count only valid artists
  const totalArtists = await Artist.countDocuments({
    isMonetizationComplete: true
  });

  if (!totalArtists) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: "No artists found"
    });
  }

  // 2️⃣ Pick random artist
  const randomIndex = Math.floor(Math.random() * totalArtists);

  const artist = await Artist.findOne({ isMonetizationComplete: true })
    .skip(randomIndex)
    .lean();

  if (!artist) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: "Artist not found"
    });
  }

  // 3️⃣ Pagination (for singles only)
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  // 4️⃣ Fetch Singles (album = null)
  const singleFilter = {
    artist: artist._id,
    album: null
  };

  const [totalSingles, singles] = await Promise.all([
    Song.countDocuments(singleFilter),
    Song.find(singleFilter)
      .select("_id title coverImage duration")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
  ]);

  // 5️⃣ Fetch Albums (separate)
  const albums = await Album.find({ artist: artist._id })
    .select("_id title coverImage releaseDate")
    .sort({ createdAt: -1 })
    .lean();

  // 6️⃣ Final Response
  res.status(StatusCodes.OK).json({
    success: true,
    artist: {
      _id: artist._id,
      name: artist.name,
      slug: artist.slug,
      profileImage: artist.profileImage
    },
    singles,
    albums,
    pagination: {
      singles: {
        total: totalSingles,
        page,
        limit,
        totalPages: Math.ceil(totalSingles / limit)
      }
    }
  });
};

export const getExploreFeed = async (req, res) => {
  try {
    // 🎲 Randomly fetch 10 albums and 10 songs
    const [albums, songs] = await Promise.all([
      Album.aggregate([{ $sample: { size: 10 } }]),
      Song.aggregate([{ $sample: { size: 10 } }]),
    ]);

    // 🧩 Shape + merge + shuffle the combined feed
    const feed = [
      ...albums.map(a => ({ type: "album", data: shapeAlbumResponse(a) })),
      ...songs.map(s => ({ type: "song", data: shapeSongResponse(s) })),
    ].sort(() => Math.random() - 0.5);

    res.status(StatusCodes.OK).json({ success: true, feed });
  } catch (err) {
    console.error("Error generating explore feed:", err);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to load explore feed ",
    });
  }
};