export function generateVerificationotpEmailTemplate(otpCode) {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9; padding: 40px 20px; max-width: 600px; margin: auto; border-radius: 10px; color: #333;">
      <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <h2 style="color: #0066ff; text-align: center; margin-bottom: 20px;">Your Verification Code</h2>
        <p style="font-size: 16px;">Hi there,</p>
        <p style="font-size: 16px;">Thank you for signing up for the <strong>Blessed Library Management System</strong>. Use the verification code below to complete your registration:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="display: inline-block; background-color: #f0f4ff; padding: 15px 30px; font-size: 32px; font-weight: bold; color: #003366; border-radius: 8px; letter-spacing: 4px;">
            ${otpCode}
          </span>
        </div>
        <p style="font-size: 15px;">This code is valid for <strong>10 minutes</strong>. If you did not request this code, please ignore this email.</p>
        <p style="font-size: 15px;">Need help? Contact our support team anytime.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
        <p style="font-size: 12px; color: #999; text-align: center;">This is an automated message. Please do not reply.</p>
      </div>
    </div>
  `;
}

export function generateForgotPasswordEmailTemplate(resetPasswordUrl) {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9; padding: 40px 20px; max-width: 600px; margin: auto; border-radius: 10px; color: #333;">
      <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <h2 style="color: #e74c3c; text-align: center; margin-bottom: 20px;">Reset Your Password</h2>
        <p style="font-size: 16px;">Hi there,</p>
        <p style="font-size: 16px;">We received a request to reset your password for your <strong>Blesses Hope Library Management System</strong> account. If you didn't request for this, you can safely ignore this email.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetPasswordUrl}" style="background-color: #3498db; color: white; text-decoration: none; padding: 12px 24px; font-size: 16px; border-radius: 5px;">Reset Password</a>
        </div>
        <p style="font-size: 15px;">This link is valid for <strong>15 minutes</strong>.</p>
        <p style="font-size: 15px;">If the button above doesn't work, copy and paste the following link into your browser:</p>
        <p style="word-break: break-all; font-size: 14px; color: #555;">${resetPasswordUrl}</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
        <p style="font-size: 12px; color: #999; text-align: center;">This is an automated message. Please do not reply.</p>
      </div>
    </div>
  `;
}
