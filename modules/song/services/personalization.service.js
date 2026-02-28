export const getSongsMatchingUserGenresService = async ({
  userId,
  page,
  limit
}) => {
  const skip = (page - 1) * limit;

  /* -------------------- Fetch user preferences -------------------- */
  const user = await User.findById(userId)
    .select("preferredGenres")
    .lean();

  if (!user) {
    throw new NotFoundError("User not found");
  }

  /* -------------------- Normalize genres -------------------- */
  const genreSet = new Set();

  if (Array.isArray(user.preferredGenres)) {
    user.preferredGenres.forEach((g) => {
      if (typeof g === "string" && g.trim()) {
        genreSet.add(g.trim());
      }
    });
  }

  const genreArray = [...genreSet];



  if (genreArray.length === 0) {
    return {
      matchingGenres: [],
      songs: [],
      total: 0
    };
  }
  

  /* -------------------- Fetch matching songs -------------------- */
  const [total, songs] = await Promise.all([
    Song.countDocuments({ genre: { $in: genreArray } }),
    Song.find({ genre: { $in: genreArray } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("artist", "name slug")
      .populate("album", "title slug")
      .lean()
  ]);

 

  /* -------------------- Access + DTO -------------------- */
  const shapedSongs = await Promise.all(
    songs.map(async (song) => {
      const hasAccess = user ? await hasAccessToSong(user, song) : false;
      return shapeSongResponse(song, hasAccess);
    })
  );

  
 
  return {
    matchingGenres: genreArray,
    songs: shapedSongs,
    total
  };
};