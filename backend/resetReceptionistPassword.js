
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("./models/User");

async function resetPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const email = "teja.reception@medisync.com";
    const newPassword = "TejaReception@2026";

    const user = await User.findOne({
      email: email.toLowerCase()
    });

    if (!user) {
      console.log("Receptionist account not found.");
      return;
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    console.log("Receptionist password reset successfully.");
    console.log("Email:", email);
    console.log("Log in using the new password set in this script.");
  } catch (error) {
    console.error("Password reset failed:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

resetPassword();
