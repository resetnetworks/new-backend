import mongoose from "mongoose";
import { Workspace } from "../modules/workspace/workspace.model.js";
import { WorkspaceMember } from "../modules/workspace/workspaceMember.model.js";

export const requireWorkspacePermission = (permission) => {
  return async (req, res, next) => {
    try {
      const { workspaceId } = req.params;

      // 1️⃣ Validate workspaceId
      if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
        return res.status(400).json({
          message: "Invalid workspaceId"
        });
      }

      // 2️⃣ Check workspace exists
      const workspace = await Workspace.findById(workspaceId).select("_id");

      if (!workspace) {
        return res.status(404).json({
          message: "Workspace not found"
        });
      }

      req.workspace = workspace;

      // 3️⃣ Find membership
      const member = await WorkspaceMember.findOne({
        workspaceId,
        userId: req.user._id
      });

      if (!member) {
        return res.status(403).json({
          message: "You are not a member of this workspace"
        });
      }

      // 4️⃣ Check permission
      if (!member.permissions?.[permission]) {
        return res.status(403).json({
          message: `Permission denied: ${permission}`
        });
      }

      // 5️⃣ Attach to request (very useful later)
      req.workspaceMember = member;
      req.workspaceId = workspaceId;

      next();

    } catch (err) {
      next(err);
    }
  };
};