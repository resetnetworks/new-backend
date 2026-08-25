// 🔹 Build registration OTP data
export const prepareRegistrationOtpData = async (name, email, otp) => {
  if (!email || !otp) return null;

  console.log("\nPreparing registration OTP template data for user:", email);

  return {
    app: {
      name: "Reset Music",
      supportEmail: "support@musicreset.com",
      website: "https://www.musicreset.com",
      url: "https://www.musicreset.com",
    },

    user: {
      name: name || "Music Lover",
      email: email,
    },

    verification: {
      otp: otp,
      expiryMinutes: 10,
      requestDate: new Date(),
      formattedDate: new Date().toLocaleDateString("en-IN"),
    },
  };
};


// 🔹 Generate registration OTP subject + body
export const prepareRegistrationOtpEmailFormat = (data) => {
  if (!data) {
    console.warn("⚠️ RegistrationOtpTemplate: Missing template data");
    return null;
  }

  const subject = `Verify your email address for ${data.app.name}`;

  const text = `
Hi ${data.user.name},

Thank you for registering at ${data.app.name}! 

Your email verification code is:
${data.verification.otp}

⚠️ This code will expire in ${data.verification.expiryMinutes} minutes.

If you did not attempt to register an account, please ignore this email.

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

    <table style="background:white;border-radius:16px;margin-top:-40px;padding:50px;width:100%; max-width:800px;">
    <tr><td style="color:#0f172a;font-size:16px;line-height:1.8;">

    <p>Hi ${data.user.name},</p>

    <h2 style="margin:0;font-size:28px;font-weight:700;color:#000000;">
      Welcome to ${data.app.name}!
    </h2>

    <p>
    We are excited to have you on board. Please use the verification code below to confirm your email and complete your registration.
    </p>

    <div style="text-align:center;margin:35px;">
      <div style="background:#F1F5F9;color:#0F172A;padding:14px 26px;border-radius:8px;font-weight:bold;font-size:32px;letter-spacing:8px;border: 1px solid #E2E8F0;display:inline-block;">
        ${data.verification.otp}
      </div>
    </div>

    <p style="font-size:14px;color:#334155;">
    This secure code will expire in <b>${data.verification.expiryMinutes} minutes</b>.
    </p>

    <p style="font-size:14px;color:#334155;">
    If you didn’t request to sign up, you can safely ignore this email.
    </p>
    
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
