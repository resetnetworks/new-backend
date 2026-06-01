import { handleNotification } from "./notification.handler.js";

import {
  handleNewSongReleaseFanout,
  handleNewAlbumReleaseFanout,
} from "./fanout/fanout.handler.js";

import { NOTIFICATION_TYPES } from "./utils/notification.constants.js";

export const dispatchNotification = async (payload) => {
  switch (payload.type) {

    case NOTIFICATION_TYPES.FANOUT_NEW_SONG_RELEASE:
      return handleNewSongReleaseFanout(payload);

    case NOTIFICATION_TYPES.FANOUT_NEW_ALBUM_RELEASE:
      return handleNewAlbumReleaseFanout(payload);

    default:
      return handleNotification(payload);
  }
};