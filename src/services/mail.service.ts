import nodemailer from "nodemailer";

export async function sendOtpEmail(toEmail: string, otpCode: string): Promise<boolean> {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const resendKey = process.env.RESEND_API_KEY;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0F172A; color: #F8FAFC; padding: 40px 20px; text-align: center;">
      <div style="max-width: 460px; margin: 0 auto; background-color: #1E293B; border-radius: 16px; padding: 32px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 10px 25px rgba(0,0,0,0.4);">
        <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #6366F1, #4F46E5); border-radius: 14px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 28px;">
          🛡️
        </div>
        <h2 style="margin: 0 0 8px; color: #FFFFFF; font-size: 22px; font-weight: 700;">VEDA Identity Wallet</h2>
        <p style="margin: 0 0 24px; color: #94A3B8; font-size: 14px;">Your one-time verification code for mobile wallet login</p>
        
        <div style="background-color: #0F172A; border-radius: 12px; padding: 20px; margin: 0 0 24px; border: 1px solid rgba(99, 102, 241, 0.3);">
          <span style="font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #818CF8; display: inline-block;">
            ${otpCode}
          </span>
        </div>
        
        <p style="margin: 0 0 8px; color: #94A3B8; font-size: 13px;">This code expires in <strong>5 minutes</strong>.</p>
        <p style="margin: 0; color: #64748B; font-size: 12px;">If you did not request this verification code, please ignore this email.</p>
      </div>
    </div>
  `;

  // 1. Direct Gmail / SMTP Delivery
  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: smtpUser,
          pass: smtpPass.replace(/\s+/g, ""),
        },
      });

      await transporter.sendMail({
        from: `"VEDA Identity Wallet" <${smtpUser}>`,
        to: toEmail,
        subject: `${otpCode} is your VEDA Wallet Verification Code`,
        html: htmlContent,
      });

      console.log(`[Server B Mailer] ✉️ Direct Gmail OTP sent to ${toEmail}!`);
      return true;
    } catch (err: any) {
      console.error("[Server B Mailer] Gmail SMTP error:", err.message);
    }
  }

  // 2. Direct Resend API Delivery
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: "VEDA Wallet <onboarding@resend.dev>",
          to: [toEmail],
          subject: `${otpCode} is your VEDA Wallet Verification Code`,
          html: htmlContent,
        }),
      });

      const data = (await res.json()) as any;
      if (res.ok) {
        console.log(`[Server B Mailer] ✉️ Resend API OTP sent to ${toEmail}! ID: ${data.id}`);
        return true;
      } else {
        console.error("[Server B Mailer] Resend API error:", data);
      }
    } catch (err: any) {
      console.error("[Server B Mailer] Resend error:", err.message);
    }
  }

  return false;
}
