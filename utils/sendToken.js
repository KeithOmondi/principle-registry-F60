export const sendToken = (user, statusCode, message, res) => {
  const token = user.generateToken();

  // Remove sensitive fields before sending (e.g., password)
  const sanitizedUser = {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    accountVerified: user.accountVerified,
    avatar: user.avatar,
  };

  res
    .status(statusCode)
    .cookie("token", token, {
      expires: new Date(Date.now() + process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Only send cookies over HTTPS in production
      sameSite: "strict", // Helps protect against CSRF
    })
    .json({
      success: true,
      message,
      user: sanitizedUser,
      token,
    });
};
