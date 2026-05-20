import { getAudience } from "./audience.service.js";
import { generateAudienceCSV }
from "./audience.export.service.js";
import { shapeAudienceUser } from "./audience.dto.js";

export const getAudienceController = async (
   req,
   res,
   next
) => {

   try {

      const {
         filter,
         page = 1,
         limit = 20,
         days = 30,
         artistId
      } = req.query;

      const audience = await getAudience({
         filter,
         page: Number(page),
         limit: Number(limit),
         days: Number(days),
         artistId
      });

      let users = audience;
      console.log(users)

      // For artist subscribers populate case
      if (filter === "artist_subscribers") {

         users = audience.map((sub) =>
            shapeAudienceUser(sub.user)
         );

      } else {

         users = audience.map(shapeAudienceUser);

      }

      return res.status(200).json({
         success: true,
         filter,
         page: Number(page),
         limit: Number(limit),
         count: users.length,
         users
      });

   } catch (error) {
      next(error);
   }
};


export const exportAudienceCSVController =
async (req, res, next) => {

   try {

      const {
         filter,
         days = 30,
         artistId
      } = req.query;

      const audience = await getAudience({
         filter,
         page: 1,
         limit: 100000,
         days: Number(days),
         artistId
      });

      let users = audience;

      if (filter === "artist_subscribers") {

         users = audience.map(
            (sub) => sub.userId
         );

      }

      const csv = generateAudienceCSV(users);

      res.header(
         "Content-Type",
         "text/csv"
      );

      res.attachment(
         `${filter}.csv`
      );

      return res.send(csv);

   } catch (error) {
      next(error);
   }
};