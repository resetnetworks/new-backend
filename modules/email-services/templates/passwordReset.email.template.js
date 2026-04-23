
// 🔹 Build password reset email data
export const preparePasswordResetData = async (user, resetToken) => {
  if (!user || !resetToken) return null;

  console.log("\nPreparing password reset email data for user:", user.email);

  const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  return {
    app: {
      name: "Reset Music",
      supportEmail: "support@musicreset.com",
      website: "https://www.musicreset.com",
      url: "https://www.musicreset.com",
    },

    user: {
      id: user._id.toString(),
      name: user.name || "Artist",
      email: user.email,
    },

    reset: {
      url: resetURL,
      expiryMinutes: 15,
      requestDate: new Date(),
      formattedDate: new Date().toLocaleDateString("en-IN"),
    },
  };
};


// 🔹 Generate password reset email subject + body
export const preparePasswordResetEmailFormat = (data) => {
  if (!data) {
    console.warn("⚠️ PasswordResetEmail: Missing template data");
    return null;
  }

  const subject = `Reset your ${data.app.name} password`;

  const text = `
Hi ${data.user.name},

We received a request to reset your password.

Reset your password:
${data.reset.url}

⚠️ This secure link expires in ${data.reset.expiryMinutes} minutes.

If you did not request this, please ignore this email — your password has not been changed.

Need help? ${data.app.supportEmail}

— Team ${data.app.name}
`;

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#eef2ff;">
    <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">

    <table width="100%" style="
      background:
        radial-gradient(circle at center, rgba(59,130,246,0.25) 0%, transparent 55%),
        linear-gradient(120deg, #020617, #0B1A3A, #1E3A8A);
      height:120px;
    ">
    <tr>
      <td align="center" valign="middle">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:middle;padding-right:12px;">
              <img
                src="https://res.cloudinary.com/dix5swbsw/image/upload/v1776162368/My%20Brand/pwa-512x512_vvr3yt.png"
                alt="${data.app.name}"
                width="80"
                style="display:block;border:0;outline:none;text-decoration:none;"
              />
            </td>
          </tr>
        </table>
      </td>
    </tr>
    </table>

    <table width="620" style="background:white;border-radius:16px;margin-top:-40px;padding:50px;">
    <tr><td style="color:#0f172a;font-size:16px;line-height:1.8;">

    <p>Hi ${data.user.name},</p>

    <h2 style="margin:0;font-size:28px;font-weight:700;color:#000000;">
      Reset your password
    </h2>

    <p>
    We received a request to reset your password.
    Click the button below to securely choose a new one.
    </p>

    <div style="text-align:center;margin:35px;">
    <a href="${data.reset.url}" style="background:#3B82F6;color:#fff;padding:14px 26px;border-radius:8px;text-decoration:none;font-weight:bold;">
    Reset password
    </a>
    </div>

    <p style="font-size:14px;color:#334155;">
    This secure link will expire in <b>${data.reset.expiryMinutes} minutes</b>.
    </p>

    <p style="font-size:14px;color:#334155;">
    If you didn’t request a password reset, you can safely ignore this email.
    </p>

    <p style="margin-top:40px;">
    Need help? Contact  
    <a href="mailto:${data.app.supportEmail}">${data.app.supportEmail}</a>
    </p>

    <p style="margin-top:40px;">— Team ${data.app.name}</p>

    </td></tr></table>
    </td></tr></table>
    </body>
    </html>
`;

  return { subject, text, html };
};