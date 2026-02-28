export const getPurchasedSongsService = async ({
  userId,
  user,
  page,
  limit
}) => {
  const skip = (page - 1) * limit;

  /* -------------------- Fetch purchased song IDs -------------------- */
  const userDoc = await User.findById(userId)
    .select("purchasedSongs")
    .lean();

  if (!userDoc) {
    throw new NotFoundError("User not found");
  }

  if (!userDoc.purchasedSongs?.length) {
    return {
      songs: [],
      total: 0
    };
  }

  /* -------------------- Fetch songs -------------------- */
  const query = { _id: { $in: userDoc.purchasedSongs } };

  const [total, songs] = await Promise.all([
    Song.countDocuments(query),
    Song.find(query)
      .sort({ releaseDate: -1 })
      .skip(skip)
      .limit(limit)
      .populate("artist", "name slug")
      .populate("album", "title slug")
      .lean()
  ]);

  /* -------------------- Access + DTO -------------------- */
  const shapedSongs = await shapeSongsWithAccess({songs, user});

  return {
    songs: shapedSongs,
    total
  };
};

export const getPremiumSongsService = async ({
  user,
  page,
  limit
}) => {
  const skip = (page - 1) * limit;

  const query = { accessType: "purchase-only" };

  const [total, songs] = await Promise.all([
    Song.countDocuments(query),
    Song.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("artist", "name slug")
      .populate("album", "title slug")
      .lean()
  ]);

  const shapedSongs = await shapeSongsWithAccess({songs, user});

  return {
    songs: shapedSongs,
    total
  };
};

export const getLikedSongsService = async ({
  userId,
  user,
  page,
  limit
}) => {
  const skip = (page - 1) * limit;

  /* -------------------- Fetch liked song IDs -------------------- */
  const userDoc = await User.findById(userId)
    .select("likedsong")
    .lean();

  if (!userDoc) {
    throw new NotFoundError("User not found");
  }

  if (!userDoc.likedsong?.length) {
    return {
      songs: [],
      total: 0
    };
  }

  /* -------------------- Query songs properly -------------------- */
  const query = { _id: { $in: userDoc.likedsong } };

  const [total, songs] = await Promise.all([
    Song.countDocuments(query),
    Song.find(query)
      .sort({ releaseDate: -1 }) // consistent ordering
      .skip(skip)
      .limit(limit)
      .populate("artist", "name slug")
      .populate("album", "title slug")
      .lean()
  ]);

  /* -------------------- Access + DTO -------------------- */
  const shapedSongs = await shapeSongsWithAccess({songs, user});

  return {
    songs: shapedSongs,
    total
  };
};