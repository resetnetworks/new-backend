export const shapePlaylistResponse = (playlist) => ({
  id: playlist._id,
  name: playlist.name,
  description: playlist.description,
  isPublic: playlist.isPublic,
  createdBy: playlist.createdBy,
  songs: playlist.songs || [],
  songCount: playlist.songs?.length || 0,
  createdAt: playlist.createdAt,
});