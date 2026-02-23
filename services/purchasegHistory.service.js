import { Transaction } from "../models/Transaction.js";
import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { shapeSongResponse } from "../dto/song.dto.js";
import { shapeAlbumResponse } from "../dto/album.dto.js";


export const getUserPurchasesService = async (userId) => {
  const transactions = await Transaction.find({
    userId,
    status: "paid",
    itemType: { $in: ["song", "album"] },
  })
    .select("itemType itemId createdAt amount currency")
    .lean();

  if (!transactions.length) {
    return {
      songs: [],
      albums: [],
      history: [],
    };
  }

  const songIds = [];
  const albumIds = [];

  for (const tx of transactions) {
    if (tx.itemType === "song") songIds.push(tx.itemId);
    if (tx.itemType === "album") albumIds.push(tx.itemId);
  }

  const [songs, albums] = await Promise.all([
    Song.find({ _id: { $in: songIds } })
      .select("title duration coverImageKey artist slug")
      .populate("artist", "name slug profileImageKey")
      .lean(),

    Album.find({ _id: { $in: albumIds } })
      .select("title coverImageKey artist slug")
      .populate("artist", "name slug profileImageKey")
      .lean(),
  ]);

  return {
    songs: songs.map((song) => shapeSongResponse(song, null)),
    albums: albums.map((album) => shapeAlbumResponse(album)),
    history: transactions.map((tx) => ({
      itemType: tx.itemType,
      itemId: tx.itemId,
      amount: tx.amount,
      currency: tx.currency,
      purchasedAt: tx.createdAt,
    })),
  };
};
