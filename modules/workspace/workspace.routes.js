import express from "express";
import { inviteWorkspaceMember, acceptInvite, getWorkspaceMembers, removeWorkspaceMember, updateWorkspaceMember, getMyWorkspaces, getWorkspaceDashboard } from "./workspace.controller.js";
import { authenticateUser } from "../../middleware/authenticate.js";
import { requireWorkspacePermission } from "../../middleware/requireWorkspacePermission.js";

const router = express.Router();

router.post("/:workspaceId/invite", authenticateUser, inviteWorkspaceMember);

router.post("/invite/accept", authenticateUser, acceptInvite);

router.get(
  "/:workspaceId/members",
 authenticateUser,
  requireWorkspacePermission("manageTeam"),
  getWorkspaceMembers
);

router.delete(
  "/workspaces/:workspaceId/members/:userId",
  authenticateUser,
  requireWorkspacePermission("manageTeam"),
  removeWorkspaceMember
);

router.patch(
  "/workspaces/:workspaceId/members/:userId",
  authenticateUser,
  requireWorkspacePermission("manageTeam"),
  updateWorkspaceMember
);


router.get("/me/workspaces", authenticateUser, getMyWorkspaces);

router.get(
  "/:workspaceId",
  authenticateUser,
  requireWorkspacePermission("viewAnalytics"),
  getWorkspaceDashboard
);

export default router;