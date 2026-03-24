import crypto from "crypto";
import { WorkspaceInvite } from "./workspaceInvite.model.js";
import mongoose from "mongoose";
import { WorkspaceMember } from "./workspaceMember.model.js";
import { ROLE_PERMISSIONS } from "../../permissions/rolePermissions.js";
import { sendEmail } from "../../utils/sendEmail.js";



export const createWorkspaceInvite = async ({
  workspaceId,
  email,
  role,
  permissionsOverride,
  invitedBy
}) => {

  const token = crypto.randomBytes(32).toString("hex");

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours

  

  const invite = await WorkspaceInvite.create({
    workspaceId,
    email,
    role,
    permissionsOverride,
    token,
    invitedBy,
    expiresAt
  });

  const inviteLink = `${process.env.FRONTEND_URL}/accept-invite?token=${token}`;

  await sendEmail({
    to: email,
    subject: "You're invited to collaborate",
    html: `
      <h2>Workspace Invitation</h2>
      <p>You’ve been invited to join a team.</p>
      <a href="${inviteLink}">Accept Invite</a>
    `
  });

  return invite;
};

export const acceptWorkspaceInvite = async ({ token, user }) => {

  // 1️⃣ Find invite
  const invite = await WorkspaceInvite.findOne({ token });

  if (!invite) {
    throw new Error("Invalid or expired invite");
  }

  // 2️⃣ Check expiration
  if (invite.expiresAt < new Date()) {
    throw new Error("Invite has expired");
  }

  // 3️⃣ Email match check
  // if (invite.email !== user.email) {
  //   throw new Error("This invite is not for your email");
  // }

  // 4️⃣ Check if already member
  const existingMember = await WorkspaceMember.findOne({
    workspaceId: invite.workspaceId,
    userId: user._id
  });

  if (existingMember) {
    throw new Error("You are already a member of this workspace");
  }

  // 5️⃣ Merge permissions
  const defaultPermissions = ROLE_PERMISSIONS[invite.role];

  const finalPermissions = {
    ...defaultPermissions,
    ...invite.permissionsOverride
  };

  // 6️⃣ Create membership
  await WorkspaceMember.create({
    workspaceId: invite.workspaceId,
    userId: user._id,
    role: invite.role,
    permissions: finalPermissions,
    invitedBy: invite.invitedBy
  });

  // 7️⃣ Delete invite
  await WorkspaceInvite.deleteOne({ _id: invite._id });

  return { success: true };
};