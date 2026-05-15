import { Parser } from "json2csv";

export const generateAudienceCSV = (users) => {

   const fields = [
      "name",
      "email",
      "role",
      "createdAt",
      "lastLoginAt"
   ];

   const parser = new Parser({ fields });

   return parser.parse(users);

};