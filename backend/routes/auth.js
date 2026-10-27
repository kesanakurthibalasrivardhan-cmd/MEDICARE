const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const crypto = require("crypto");
const router = express.Router();

console.log("DEBUG: Loaded MediSync auth.js from:", __filename);

// Patient registration
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    console.log("Receptionist email received:", email);
console.log("Password length received:", password?.length);

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email is already registered"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone: phone || "",
      role: "patient"
    });

    res.status(201).json({
      message: "Patient registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Registration error:", error.message);
    res.status(500).json({
      message: "Registration failed"
    });
  }
});

// Login

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check required fields
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    // Find the user by email
    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail
    });

    if (!user) {
      return res.status(401).json({
      message: "invalid email or password"
      });
    }
    console.log("LOGIN DEBUG:", {
  email: user.email,
  role: user.role,
  passwordType: typeof password,
  passwordLength: password.length,
  hashExists: Boolean(user.password),
  hashPrefix: user.password?.slice(0, 7)
});

    // Compare the entered password with the saved hash
    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
      message: " Invalid email or password"
      });
    }

    // Check JWT configuration
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "Server authentication is not configured"
      });
    }

    // Generate login token
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // Return successful login
    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || ""
      }
    });

  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      message: "Login failed"
    });
  }
});

 // Create receptionist account (admin only)
router.post("/receptionists", async (req, res) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Please log in as admin"
      });
    }

    const token = header.split(" ")[1];

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "Server authentication is not configured"
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        message: "Invalid or expired login"
      });
    }

    if (decoded.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can create receptionist accounts"
      });
    }

const { name, email, phone, password } = req.body;
console.log("Receptionist email received:", email);
console.log("Password length received:", password?.length);
    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({
        message: "Name and email are required"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email is already registered"
      });
    }

if (!password || password.length < 8) {
  return res.status(400).json({
    message: "Password must be at least 8 characters"
  });
}


const hashedPassword = await bcrypt.hash(password, 12);

const user = await User.create({
  name: name.trim(),
  email: normalizedEmail,
  phone: phone || "",
  password: hashedPassword,
  role: "receptionist"
});

const savedUser = await User.findById(user._id);

const passwordMatches = await bcrypt.compare(
  password,
  savedUser.password
);

if (!passwordMatches) {
  await User.deleteOne({ _id: user._id });

  return res.status(500).json({
    message: "Could not verify the newly created account."
  });
}

 console.log(
    "Receptionist password verification:",
    await bcrypt.compare(password, user.password)
);

    return res.status(201).json({
      message: "Receptionist account created successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Receptionist creation error:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email is already registered"
      });
    }

    return res.status(500).json({
      message: "Could not create receptionist account"
    });
  }
});

 // Create doctor account (admin only)

router.post("/doctors", async (req, res) => {
  let createdUser = null;

  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Please log in as admin"
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "Server authentication is not configured"
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(
        header.split(" ")[1],
        process.env.JWT_SECRET
      );
    } catch {
      return res.status(401).json({
        message: "Invalid or expired login"
      });
    }

    if (decoded.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can create doctor accounts"
      });
    }

    const {
      name,
      email,
      phone,
      password,
      frontendId,
      departmentId,
      qualification,
      experience,
      fee,
      bio,
      shifts,
      leave: doctorLeave
    } = req.body;

    if (
      !name?.trim() ||
      !email?.trim() ||
      !frontendId ||
      !departmentId ||
      !qualification?.trim()
    ) {
      return res.status(400).json({
        message: "Please provide all required doctor details"
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters"
      });
    }

    if (
      !Number.isFinite(Number(experience)) ||
      Number(experience) < 0 ||
      !Number.isFinite(Number(fee)) ||
      Number(fee) < 0
    ) {
      return res.status(400).json({
        message: "Please provide valid experience and fee values"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email is already registered"
      });
    }

    const existingDoctor = await Doctor.findOne({
      frontendId
    });

    if (existingDoctor) {
      return res.status(409).json({
        message: "This doctor profile already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    createdUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone || "",
      password: hashedPassword,
      role: "doctor"
    });

    const doctor = await Doctor.create({
      user: createdUser._id,
      frontendId,
      departmentId,
      qualification: qualification.trim(),
      experience: Number(experience),
      fee: Number(fee),
      bio: bio || "",
      shifts: shifts || {},
      leave: Array.isArray(doctorLeave) ? doctorLeave : []
    });

    return res.status(201).json({
      message: "Doctor account and profile created successfully",
      user: {
        id: createdUser._id,
        name: createdUser.name,
        email: createdUser.email,
        role: createdUser.role,
        phone: createdUser.phone || ""
      },
      doctor: {
        id: doctor._id,
        frontendId: doctor.frontendId
      }
    });
  } catch (error) {
    console.error("Doctor creation error:", error.message);

    // Avoid leaving a login account without its doctor profile.
    if (createdUser) {
      try {
        await User.deleteOne({ _id: createdUser._id });
      } catch (cleanupError) {
        console.error(
          "Could not clean up doctor account:",
          cleanupError.message
        );
      }
    }

    if (error.code === 11000) {
      return res.status(409).json({
        message: "This email or doctor profile is already registered"
      });
    }

    return res.status(500).json({
      message: "Could not create doctor account"
    });
  }
});
// Get registered patients from MongoDB (admin only)

router.get("/patients", async (req, res) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Please log in as admin"
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "Server authentication is not configured"
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(
        header.split(" ")[1],
        process.env.JWT_SECRET
      );
    } catch {
      return res.status(401).json({
        message: "Invalid or expired login"
      });
    }

    if (decoded.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can view registered patients"
      });
    }

    const patients = await User.find({ role: "patient" })
      .select("name email phone createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ patients });
  } catch (error) {
    console.error("Patient retrieval error:", error.message);

    return res.status(500).json({
      message: "Could not retrieve registered patients"
    });
  }
});

module.exports = router;