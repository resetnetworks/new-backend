import {
  addFavoriteArtistService,
  removeFavoriteArtistService,
  getUserFavoriteArtistsService,
  isArtistFavoritedService,
} from "../services/favoriteArtistService.js";


export const addFavoriteArtistController = async (req, res) => {
  const userId = req.user._id;
  const { artistId } = req.params;

  const result = await addFavoriteArtistService({ userId, artistId });

  res.json({
    success: true,
    data: result,
  });
};



export const removeFavoriteArtistController = async (req, res) => {
  const userId = req.user._id;
  const { artistId } = req.params;

  await removeFavoriteArtistService({ userId, artistId });

  res.json({
    success: true,
  });
};



export const getUserFavoritesController = async (req, res) => {
  const userId = req.user._id;

  const data = await getUserFavoriteArtistsService({
    userId,
    page: req.query.page,
    limit: req.query.limit,
  });

  res.json({
    success: true,
    data,
  });
};




export const checkFavoriteController = async (req, res) => {
  const userId = req.user._id;
  const { artistId } = req.params;

  const isFavorited = await isArtistFavoritedService({
    userId,
    artistId,
  });

  res.json({
    success: true,
    isFavorited,
  });
};