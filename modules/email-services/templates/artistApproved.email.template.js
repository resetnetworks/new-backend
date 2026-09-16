
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

Thank you for signing up with us for Reset Music Streaming Platform.

Let's get started:
• Distribute your music - singles, EPs, albums, DJ mixes. It's completely free.
• Activate monetisation
• Reach a global audience

From here, you can:
• Manage your releases
• Customize your Artist Page
• Request payouts at any time

🎵 Already have your music on Bandcamp?
Bring your existing discography to Reset — without uploading everything manually.
Simply provide your Bandcamp artist URL, and we'll extract your available releases so you can review and import them into your Reset Artist account.

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

    <table style="background:white;border-radius:16px;margin-top:-40px;padding:40px;width:100%;max-width:760px;box-sizing:border-box;">
    <tr><td style="color:#0f172a;font-size:16px;line-height:1.8;">

    <p>Hi ${data.user.name},</p>

    <h2 style="margin:0 0 8px;font-size:28px;font-weight:700;color:#000000;">
      Your Artist Account is Now Live
    </h2>

    <p style="margin-top:8px;color:#334155;">
      Thank you for signing up with us for <b>${data.app.name}</b> Streaming Platform.
    </p>

    <p style="margin-bottom:6px;"><b>Let's get started:</b></p>
    <ul style="margin:0 0 24px;padding-left:20px;color:#334155;">
      <li style="margin-bottom:8px;">Distribute your music — singles, EPs, albums, DJ mixes. <b>Unlimited FREE Distribution.</b></li>
      <li style="margin-bottom:8px;">Activate monetisation</li>
      <li style="margin-bottom:8px;">Reach a global audience</li>
    </ul>

    <p style="margin-bottom:6px;"><b>From here, you can:</b></p>
    <ul style="margin:0 0 24px;padding-left:20px;color:#334155;">
      <li style="margin-bottom:8px;">Manage your releases</li>
      <li style="margin-bottom:8px;">Customize your Artist Page</li>
      <li style="margin-bottom:8px;">Request payouts at any time</li>
    </ul>

    <div style="text-align:center;margin:35px 0;">
      <a href="${data.artist.dashboardUrl}" style="background:linear-gradient(45deg, #0F3272 0%, #1A5DB4 60%, #3380FF 100%);box-shadow:0 12px 32px rgba(51,128,255,0.35);color:#fff;padding:14px 26px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
        Open Artist Dashboard
      </a>
    </div>

    <hr style="border:none; border-top:1px solid #e2e8f0; margin:10px 0 35px 0;" />

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
      <tr>
        <td style="background-color:#f8fafc; border-radius:12px; padding:24px; border:1px solid #e2e8f0;">
          <h3 style="margin:0 0 12px; font-size:18px; color:#0f172a;">🎵 Already have your music on Bandcamp?</h3>
          <p style="margin:0 0 12px; color:#334155; font-size:15px;">
            Bring your existing discography to Reset — <b>without uploading everything manually.</b>
          </p>
          <p style="margin:0 0 20px; color:#334155; font-size:15px; line-height:1.6;">
            Simply provide your <b>Bandcamp artist URL</b>, and we'll extract your available releases so you can review and import them into your Reset Artist account.
          </p>

          <div style="text-align:center;margin:35px 0;">
            <a href="${data.artist.dashboardUrl}" style="background:linear-gradient(45deg, #0F3272 0%, #1A5DB4 60%, #3380FF 100%);box-shadow:0 12px 32px rgba(51,128,255,0.35);color:#fff;padding:14px 26px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
              Import Music from Bandcamp
            </a>
          </div>

        </td>
      </tr>
    </table>

    


    <p>We're excited to have you onboard 💜</p>

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