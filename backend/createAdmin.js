
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected.");

    const email = "admin@medisync.com";

    const existingAdmin = await User.findOne({
      email,
      role: "admin"
    });

    if (existingAdmin) {
      console.log("An admin with this email already exists.");
      return;
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      console.log(
        "This email belongs to another role. No changes made."
      );
      return;
    }

    const password = process.env.INITIAL_ADMIN_PASSWORD;

    if (!password || password.length < 8) {
      console.log(
        "Set INITIAL_ADMIN_PASSWORD in your backend .env file first."
      );
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await User.create({
      name: "MediSync Admin",
      email,
      password: hashedPassword,
      role: "admin"
    });

    console.log("Admin account created successfully.");
    console.log("Email: admin@medisync.com");
    console.log("Use the password you configured in .env.");
  } catch (error) {
    console.error("Admin setup failed:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

createAdmin();
