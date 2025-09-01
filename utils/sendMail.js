import nodemailer from "nodemailer";

export const sendEmail = async ({ email, subject, message, html }) => {
  if (!email || !subject || (!message && !html)) {
    throw new Error("Email, subject, and either message or HTML content are required.");
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465, // true for port 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false, // Optional: helpful in dev, but should be `true` in prod if using proper certs
      },
    });

    const mailOptions = {
      from: `"Blessed Hope Library System" <${process.env.SMTP_USER}>`,
      to: email,
      subject,
      text: message || "", // fallback plain text
      html: html || "",    // HTML content
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", info.response);
    return info;
  } catch (error) {
    console.error("❌ Email sending error:", error.message);
    throw new Error("Failed to send email. Please try again.");
  }
};
