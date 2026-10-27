
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

async function createReceptionist() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected.");

    const name = "Ravi";
    const email = "ravi.reception@medisync.com";
    const role = "receptionist";

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      console.log("This email already exists.");
      console.log("No changes made to the existing account.");
      return;
    }

    const password = process.env.INITIAL_RECEPTIONIST_PASSWORD;

    if (!password || password.length < 8) {
      console.log(
        "Set INITIAL_RECEPTIONIST_PASSWORD in your backend .env file first."
      );
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await User.create({
      name,
      email,
      password: hashedPassword,
      role
    });

    console.log("Receptionist account created successfully.");
    console.log("Email:", email);
    console.log("Use the password configured in .env.");
  } catch (error) {
    console.error("Receptionist setup failed:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

createReceptionist();
