import express from "express";

import { getAudienceController, exportAudienceCSVController }
from "./audience.controller.js";

import { authenticateUser }
from "../../middleware/authenticate.js";

import { authorizeRoles }
from "../../middleware/authorize.js";

const router = express.Router();

router.get(
   "/export/csv",
//    authenticateUser,
//    authorizeRoles("admin"),
   exportAudienceCSVController
);

router.get(
   "/",
   authenticateUser,
   authorizeRoles("admin"),
   getAudienceController
);


export default router;