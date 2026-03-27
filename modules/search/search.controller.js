import { StatusCodes } from "http-status-codes";
import {
  unifiedSearchService,
  searchSongsService,
  searchArtistsService,
  searchAlbumsService,
  getQuery,
  getPagination
} from "./search.service.js";

/**
 * Unified search across artists, songs, and albums.
 * Supports pagination and input validation.
 * Example: GET /api/search?q=love&page=1&limit=10
 */
export const unifiedSearch = async (req, res) => {
  const query = getQuery(req);
  const results = await unifiedSearchService(query);

  res.status(StatusCodes.OK).json({
    success: true,
    query,
    results,
  });
};


// @desc Search songs by title with pagination
// @route GET /api/search/songs?q=term&page=1&limit=10
// @access Public
export const searchSongs = async (req, res) => {
  const query = getQuery(req);
  const { page, limit } = getPagination(req);

  const data = await searchSongsService({
    query,
    page,
    limit,
    user: req.user,
  });

  res.status(StatusCodes.OK).json({
    success: true,
    query,
    page,
    ...data,
  });
};

// @desc Search artists by name with pagination
// @route GET /api/search/artists?q=term&page=1&limit=10
// @access Public
export const searchArtists = async (req, res) => {
  const query = getQuery(req);
  const { page, limit } = getPagination(req);

  const data = await searchArtistsService({ query, page, limit });

  res.status(StatusCodes.OK).json({
    success: true,
    query,
    page,
    ...data,
  });
};


// @desc Search albums by title with pagination
// @route GET /api/search/albums?q=term&page=1&limit=10
// @access Public
export const searchAlbums = async (req, res) => {
  const query = getQuery(req);
  const { page, limit } = getPagination(req);

  const data = await searchAlbumsService({ query, page, limit });

  res.status(StatusCodes.OK).json({
    success: true,
    query,
    page,
    ...data,
  });
};