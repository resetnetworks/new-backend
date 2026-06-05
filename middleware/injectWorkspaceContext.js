import mongoose from "mongoose";
import { Workspace } from "../modules/workspace/workspace.model.js";
import { WorkspaceMember } from "../modules/workspace/workspaceMember.model.js";

export const injectWorkspaceContext = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const workspaceId = req.headers["x-workspace-id"];

      // If no workspace ID header is present, we proceed as a regular user/artist
      if (!workspaceId) {
        return next();
      }

      // Validate workspaceId
      if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
        return res.status(400).json({
          message: "Invalid x-workspace-id header format"
        });
      }

      // Check workspace exists
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          message: "Workspace not found"
        });
      }

      // Authenticate user must have run before this, so req.user exists
      if (!req.user) {
        return res.status(401).json({
          message: "Authentication required"
        });
      }

      // Check if user is a member of the workspace
      const member = await WorkspaceMember.findOne({
        workspaceId,
        userId: req.user._id
      });

      if (!member) {
        return res.status(403).json({
          message: "Access denied. You are not a member of this workspace."
        });
      }

      // Check specific permission if requested
      if (requiredPermission) {
        const hasPermission = member.permissions?.[requiredPermission];
        if (!hasPermission) {
          return res.status(403).json({
            message: `Permission denied: ${requiredPermission}`
          });
        }
      }

      // Save original user context
      req.originalUser = { ...req.user };

      // Temporarily override the user object for downstream handlers to act as the artist owner
      req.user = {
        ...req.user,
        _id: workspace.ownerId, // override ID so creator checks pass
        role: "artist",
        artistId: workspace.artistId.toString(),
        isWorkspaceCollaborator: true,
        workspaceId: workspace._id.toString(),
        workspaceRole: member.role,
        collaboratorUserId: req.user._id // keep original user ID for tracking
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};