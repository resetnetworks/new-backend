export const ROLE_PERMISSIONS = {
  owner: {
    uploadSong: true,
    editSong: true,
    deleteSong: true,
    viewAnalytics: true,
    viewPayments: true,
    changeSubscriptionPrice: true,
    manageTeam: true
  },

  manager: {
    uploadSong: true,
    editSong: true,
    deleteSong: true,
    viewAnalytics: true,
    viewPayments: false,
    changeSubscriptionPrice: false,
    manageTeam: true
  },

  editor: {
    uploadSong: true,
    editSong: true,
    deleteSong: false,
    viewAnalytics: false,
    viewPayments: false,
    changeSubscriptionPrice: false,
    manageTeam: false
  },

  analyst: {
    uploadSong: false,
    editSong: false,
    deleteSong: false,
    viewAnalytics: true,
    viewPayments: false,
    changeSubscriptionPrice: false,
    manageTeam: false
  },

  finance: {
    uploadSong: false,
    editSong: false,
    deleteSong: false,
    viewAnalytics: false,
    viewPayments: true,
    changeSubscriptionPrice: false,
    manageTeam: false
  }
};