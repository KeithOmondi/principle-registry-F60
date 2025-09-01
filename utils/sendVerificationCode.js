import { sendEmail } from "./sendMail.js";
import { generateVerificationotpEmailTemplate } from "./emailTemplates.js";

export async function sendVerificationCode(email, verificationCode) {
  if (!email || !verificationCode || isNaN(Number(verificationCode))) {
    throw new Error("Valid email and numeric verification code are required.");
  }

  const html = generateVerificationotpEmailTemplate(verificationCode);
  const text = `Your verification code is: ${verificationCode}. It is valid for 10 minutes.`;

  await sendEmail({
    email,
    subject: "Verification Code (Library Management System)",
    message: text,
    html,
  });
}
