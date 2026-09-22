export const prepareArtistApplicationSubmittedData = async (payload) => {
  if (!payload) return null;

  return {
    app: {
      name: "Reset Music",
      supportEmail: "support@musicreset.com",
      url: "https://www.musicreset.com",
      adminUrl: "https://www.musicreset.com/admin/artist-applications",
    },

    applicant: {
      userId: payload.userId,
      name: payload.applicantName || "N/A",
      email: payload.applicantEmail || "N/A",
    },

    artist: {
      applicationId: payload.applicationId ? String(payload.applicationId) : "N/A",
      stageName: payload.stageName || "Not provided",
      legalName: payload.legalName || "Not provided",
      bio: payload.bio || "No bio provided",
      country: payload.country || "Not specified",
      contactPhone: payload.contact?.phone || payload.contact?.phoneNumber || "Not provided",
      contactEmail: payload.contact?.email || payload.applicantEmail || "Not provided",
      submittedAt: payload.submittedAt
        ? new Date(payload.submittedAt).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "UTC",
          }) + " UTC"
        : new Date().toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "UTC",
          }) + " UTC",
    },
  };
};

export const prepareArtistApplicationSubmittedEmailTemplate = (data) => {
  if (!data) {
    console.warn("⚠️ ArtistApplicationSubmittedTemplate: Missing template data");
    return null;
  }

  const subject = `New Artist Application: ${data.artist.stageName}`;

  const text = `
New Artist Application Received

Stage Name: ${data.artist.stageName}
Legal Name: ${data.artist.legalName}
Applicant: ${data.applicant.name} (${data.applicant.email})
Country: ${data.artist.country}
Contact Phone: ${data.artist.contactPhone}
Contact Email: ${data.artist.contactEmail}
Application ID: ${data.artist.applicationId}
Submitted: ${data.artist.submittedAt}

Bio:
${data.artist.bio}

Review application:
${data.app.adminUrl}

— Team ${data.app.name}
  `.trim();

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f1f5f9;color:#0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 0 48px;">
      <tr>
        <td align="center">
          <!-- Main Container -->
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">
            
            <!-- Header with Gradient -->
            <tr>
              <td style="background:radial-gradient(circle at center, rgba(59,130,246,0.25) 0%, transparent 60%), linear-gradient(120deg, #020617, #0B1A3A, #1E3A8A);padding:32px 40px;text-align:center;">
                <img
                  src="https://res.cloudinary.com/dix5swbsw/image/upload/v1776162368/My%20Brand/pwa-512x512_vvr3yt.png"
                  alt="${data.app.name}"
                  width="72"
                  style="display:inline-block;border:0;outline:none;"
                />
                <div style="color:#93c5fd;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;margin-top:12px;">
                  Admin Notification
                </div>
              </td>
            </tr>

            <!-- Body Content -->
            <tr>
              <td style="padding:36px 40px;">
                <div style="display:inline-block;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:600;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">
                  New Application
                </div>

                <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0f172a;line-height:1.3;">
                  Artist Application Submitted
                </h1>
                <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
                  A new artist application has been submitted and is awaiting your review in the admin dashboard.
                </p>

                <!-- Details Card -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
                  <tr>
                    <td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600;width:35%;">Stage Name</td>
                    <td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:700;">${data.artist.stageName}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600;">Legal Name</td>
                    <td style="padding:8px 0;font-size:14px;color:#0f172a;">${data.artist.legalName}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600;">Applicant Account</td>
                    <td style="padding:8px 0;font-size:14px;color:#0f172a;">${data.applicant.name} (${data.applicant.email})</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600;">Country</td>
                    <td style="padding:8px 0;font-size:14px;color:#0f172a;">${data.artist.country}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600;">Contact Phone</td>
                    <td style="padding:8px 0;font-size:14px;color:#0f172a;">${data.artist.contactPhone}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600;">Application ID</td>
                    <td style="padding:8px 0;font-size:13px;color:#64748b;font-family:monospace;">${data.artist.applicationId}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:600;">Submitted At</td>
                    <td style="padding:8px 0;font-size:13px;color:#475569;">${data.artist.submittedAt}</td>
                  </tr>
                </table>

                <!-- Bio Snippet -->
                ${
                  data.artist.bio && data.artist.bio !== "No bio provided"
                    ? `
                  <div style="margin-bottom:28px;">
                    <div style="font-size:13px;font-weight:600;color:#64748b;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Artist Bio</div>
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-left:4px solid #3b82f6;border-radius:6px;padding:12px 16px;font-size:14px;color:#334155;line-height:1.6;font-style:italic;">
                      ${data.artist.bio}
                    </div>
                  </div>
                `
                    : ""
                }

                <!-- Action Button -->
                <div style="text-align:center;margin:32px 0 16px;">
                  <a
                    href="${data.app.adminUrl}"
                    style="display:inline-block;background:linear-gradient(45deg, #0F3272 0%, #1A5DB4 60%, #3380FF 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 32px;border-radius:8px;box-shadow:0 8px 24px rgba(26,93,180,0.3);"
                  >
                    Review in Admin Dashboard
                  </a>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;color:#64748b;font-size:12px;line-height:1.5;">
                This is an automated administrative notification from <b>${data.app.name}</b>.<br>
                Recipient: <a href="mailto:info@musicreset.com" style="color:#2563eb;text-decoration:none;">info@musicreset.com</a>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
    </body>
    </html>
  `.trim();

  return { subject, text, html };
};
