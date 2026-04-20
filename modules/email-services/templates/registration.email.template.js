

// 🔹 Build registration email data from user
export const prepareRegistrationData = async (user) => {
  if (!user) return null;

  console.log("\nPreparing registration email data for user:", user.email);

  return {
    app: {
      name: "Reset Music",
      supportEmail: "support@reset93.net",
      website: "https://www.musicreset.com",
    },

    user: {
      id: user._id.toString(),
      name: user.name || "Artist",
      email: user.email,
      username: user.username || null,
    },

    registration: {
      date: new Date(),
      formattedDate: new Date().toLocaleDateString("en-IN"),
    },
  };
};

// 🔹 Generate welcome email subject + body
export const prepareRegistrationEmailFormat = (data) => {
  if (!data) {
    console.warn("⚠️ RegistrationEmail: Missing template data");
    return null;
  }

  const subject = `${data.app.name} 🎵`;

  const text = `
Hi ${data.user.name},

${data.app.name}

Here, you’ll find a carefully curated world of ambient, instrumental, and experimental sound.
Just music that helps you slow down, focus, motivate, inspire and reset.

Start exploring:
• Discover artists, support directly
• Soundscapes for focus, rest, and reflection
• Your own space to listen, uninterrupted

Visit: ${data.app.url}

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
      Welcome to
      <span style="
        background: linear-gradient(120deg, #020617, #0B1A3A, #1E3A8A);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        color: transparent;
      ">
        ${data.app.name}
      </span>
    </h2>

    <p>
    Here, you’ll find a carefully curated world of ambient, instrumental, and experimental sound.
    Just music that helps you slow down, focus, motivate, inspire and reset.
    </p>

    <div style="text-align:center;margin:35px;">
    <a href="${data.app.url}" style="background:#3B82F6;color:#fff;padding:14px 26px;border-radius:8px;text-decoration:none;font-weight:bold;">
    Keep exploring artists
    </a>
    </div>

    <b>Start exploring:</b>
    <ul>
    <li>Discover artists, support directly (We’re trying to make a real difference here in artists’ lives)</li>
    <li>Soundscapes for focus, rest, and reflection</li>
    <li>Your own space to listen, uninterrupted</li>
    </ul>

    <b>What you can do here:</b>
    <ul>
    <li>Find music that doesn’t fight for attention</li>
    <li>Discover artists you probably won’t hear anywhere else</li>
    <li>Actually listen (wild concept, we know)</li>
    </ul>

    <p style="margin-top:40px;">— Team ${data.app.name}</p>

    </td></tr></table>
    </td></tr></table>
    </body>
    </html>
`;

  return { subject, text, html };
};

