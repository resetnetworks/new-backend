import { createWorkspaceInvite, acceptWorkspaceInvite } from "./invite.service.js";
import { WorkspaceMember } from "./workspaceMember.model.js";
import { ROLE_PERMISSIONS } from "../../permissions/rolePermissions.js";
import mongoose from "mongoose";
import { Workspace } from "./workspace.model.js";
import { Song } from "../../models/song.model.js";
import { Album } from "../../models/album.model.js";

export const inviteWorkspaceMember = async (req, res) => {

  const { workspaceId } = req.params;
  const { email, role, permissionsOverride } = req.body;

  if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
    return res.status(400).json({
      message: "Invalid workspaceId"
    });
  }

  const invite = await createWorkspaceInvite({
    workspaceId,
    email,
    role,
    permissionsOverride,
    invitedBy: req.user._id
  });

  res.status(201).json({
    success: true,
    invite
  });
};

export const acceptInvite = async (req, res) => {

  const { token } = req.body;

  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const result = await acceptWorkspaceInvite({
    token,
    user: req.user
  });

  res.status(200).json(result);
};

export const getWorkspaceMembers = async (req, res) => {
  const { workspaceId } = req.params;

  const members = await WorkspaceMember.find({ workspaceId })
    .populate("userId", "name email")
    .lean();

  res.status(200).json({
    success: true,
    members
  });
};

export const removeWorkspaceMember = async (req, res) => {
  const { workspaceId, userId } = req.params;

  const member = await WorkspaceMember.findOne({ workspaceId, userId });

  if (!member) {
    return res.status(404).json({ message: "Member not found" });
  }

  // ❌ Cannot remove owner
  if (member.role === "owner") {
    return res.status(400).json({
      message: "Cannot remove workspace owner"
    });
  }

  // ❌ Cannot remove yourself
  if (req.user._id.toString() === userId) {
    return res.status(400).json({
      message: "You cannot remove yourself"
    });
  }

  await WorkspaceMember.deleteOne({ _id: member._id });

  res.status(200).json({
    success: true,
    message: "Member removed successfully"
  });
};

export const updateWorkspaceMember = async (req, res) => {
  const { workspaceId, userId } = req.params;
  const { role, permissionsOverride } = req.body;

  const member = await WorkspaceMember.findOne({ workspaceId, userId });

  if (!member) {
    return res.status(404).json({ message: "Member not found" });
  }

  // ❌ Cannot update owner
  if (member.role === "owner") {
    return res.status(400).json({
      message: "Cannot modify owner"
    });
  }

  // 1️⃣ Update role
  if (role) {
    member.role = role;

    const defaultPermissions = ROLE_PERMISSIONS[role];

    member.permissions = {
      ...defaultPermissions,
      ...permissionsOverride
    };
  }

  await member.save();

  res.status(200).json({
    success: true,
    member
  });
};

export const getMyWorkspaces = async (req, res) => {
  const userId = req.user._id;

  const memberships = await WorkspaceMember.find({ userId })
    .populate({
      path: "workspaceId",
      select: "name artistId"
    })
    .lean();

  const workspaces = memberships.map((m) => ({
    workspaceId: m.workspaceId._id,
    name: m.workspaceId.name,
    artistId: m.workspaceId.artistId,
    role: m.role,
    permissions: m.permissions
  }));

  res.status(200).json({
    success: true,
    workspaces
  });
};

export const getWorkspaceDashboard = async (req, res) => {
  const { workspaceId } = req.params;

  const workspace = await Workspace.findById(workspaceId)
    .select("name artistId")
    .lean();

  if (!workspace) {
    return res.status(404).json({ message: "Workspace not found" });
  }

  const [memberCount, songCount, albumCount] = await Promise.all([
    WorkspaceMember.countDocuments({ workspaceId }),
    Song.countDocuments({ artist: workspace.artistId, isDeleted: false }),
    Album.countDocuments({ artist: workspace.artistId, isDeleted: false })
  ]);

  res.status(200).json({
    success: true,
    workspace: {
      id: workspace._id,
      name: workspace.name,
      artistId: workspace.artistId
    },
    stats: {
      members: memberCount,
      songs: songCount,
      albums: albumCount
    }
  });
};