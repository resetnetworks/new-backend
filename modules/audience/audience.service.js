import { User } from "../../models/User.js";
import { Subscription } from "../../models/Subscription.js";
import mongoose from "mongoose";

import {
   AUDIENCE_FILTERS,
   DEFAULT_ACTIVE_DAYS
} from "./audience.constants.js";

const getDateDaysAgo = (days) => {
   return new Date(
      Date.now() - days * 24 * 60 * 60 * 1000
   );
};


export async function getAudience({
   filter,
   page = 1,
   limit = 20,
   days = DEFAULT_ACTIVE_DAYS,
   artistId
}) {

   const handler = audienceHandlers[filter];

   if (!handler) {
      throw new Error("Invalid audience filter");
   }

   const skip = (page - 1) * limit;

   const data = await handler({
      skip,
      limit,
      days,
      artistId
   });

   return data;
}

async function getAllUsers({ skip, limit }) {

   return User.find({
      role: "user"
   })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

}


async function getAllArtists({ skip, limit }) {

   return User.find({
      role: "artist"
   })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

}


async function getActiveUsers({
   skip,
   limit,
   days
}) {

   const threshold = getDateDaysAgo(days);

   return User.find({
      lastLoginAt: {
         $gte: threshold
      }
   })
      .sort({ lastLoginAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

}


async function getInactiveUsers({
   skip,
   limit,
   days
}) {

   const threshold = getDateDaysAgo(days);

   return User.find({
      $or: [
         { lastLoginAt: null },
         {
            lastLoginAt: {
               $lt: threshold
            }
         }
      ]
   })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

}


async function getNewlyRegisteredUsers({
   skip,
   limit,
   days
}) {

   const threshold = getDateDaysAgo(days);

   return User.find({
      createdAt: {
         $gte: threshold
      }
   })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

}


async function getArtistSubscribers({
   artistId,
   skip = 0,
   limit = 10
}) {

   const result =  await Subscription.aggregate([
      {
         $match: {
            artistId: new mongoose.Types.ObjectId(artistId),

            validUntil: {
               $gt: new Date()
            },

            status: "active"
         }
      },

      // newest first
      {
         $sort: {
            createdAt: -1
         }
      },

      // unique user
      {
         $group: {
            _id: "$userId",
            subscription: {
               $first: "$$ROOT"
            }
         }
      },

      // flatten
      {
         $replaceRoot: {
            newRoot: "$subscription"
         }
      },

      // populate user
      {
         $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user"
         }
      },

      {
         $unwind: "$user"
      },

      // pagination
      {
         $skip: skip
      },

      {
         $limit: limit
      },

      // clean response
      {
         $project: {
            // _id: 1,
            // cycle: 1,
            // startedAt: 1,
            // validUntil: 1,
            // status: 1,
            // createdAt: 1,

            user: {
               _id: "$user._id",
               name: "$user.name",
               email: "$user.email",
            //    profileImage: "$user.profileImage",
            //    role: "$user.role"
            }
         }
      }
   ]);
   
   console.log("result", result )

}


const audienceHandlers = {
   [AUDIENCE_FILTERS.ALL_USERS]: getAllUsers,

   [AUDIENCE_FILTERS.ALL_ARTISTS]: getAllArtists,

   [AUDIENCE_FILTERS.ACTIVE_USERS]: getActiveUsers,

   [AUDIENCE_FILTERS.INACTIVE_USERS]: getInactiveUsers,

   [AUDIENCE_FILTERS.NEWLY_REGISTERED_USERS]:
      getNewlyRegisteredUsers,

   [AUDIENCE_FILTERS.ARTIST_SUBSCRIBERS]:
      getArtistSubscribers,
};