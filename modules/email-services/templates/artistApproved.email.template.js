
export const prepareArtistApprovedData = async (payload) => {
  if (!payload) return null;

  return {
    app: {
      name: "Reset Music",
      supportEmail: "support@musicreset.com",
      url: "https://www.musicreset.com",
    },

    user: {
      name: payload.userName || "Artist",
      email: payload.userEmail,
    },

    artist: {
      name: payload.artistName,
      dashboardUrl: "https://www.musicreset.com/artist/dashboard",
    },
  };
};



export const prepareArtistApprovedEmailTemplate = (data) => {

  if (!data) {
    console.warn("⚠️ ArtistApprovedEmail: Missing template data");
    return null;
  }

  const subject = `You're officially an Artist 🎉`;

  const text = `
    Hi ${data.user.name},

    Great news — your artist profile "${data.artist.name}" has been approved.

    You can now:
    • Access your Artist Dashboard
    • Upload songs & DJ remixes
    • Manage your profile
    • Start growing your audience

    Open your dashboard:
    ${data.artist.dashboardUrl}

    — Team ${data.app.name}
    Need help? ${data.app.supportEmail}
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
    You’re officially an Artist 🎉
    </h2>

    <p>
    Your artist profile <b>${data.artist.name}</b> has been approved.
    </p>

    <p>You can now start your journey on ${data.app.name}.</p>

    <b>What you can do now:</b>
    <ul>
      <li>Upload songs & DJ remixes</li>
      <li>Manage your artist profile</li>
      <li>Reach listeners worldwide</li>
      <li>Start growing your audience</li>
    </ul>

    <div style="text-align:center;margin:35px;">
      <a href="https://www.musicreset.com/artist/dashboard" style="background:#3B82F6;color:#fff;padding:14px 26px;border-radius:8px;text-decoration:none;font-weight:bold;">
        Open Artist Dashboard
      </a>
    </div>

    <p>We’re excited to have you onboard 💜</p>

    <p style="margin-top:40px;">— Team ${data.app.name}</p>

    <p style="font-size:13px;color:#64748b;margin-top:25px;">
      Need help? Contact us at <b>${data.app.supportEmail}</b>
    </p>

    </td></tr></table>
    </td></tr></table>
    </body>
    </html>
  `;

  return { subject, text, html };
};