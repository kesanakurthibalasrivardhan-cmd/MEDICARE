
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Doctor = require("../models/Doctor");

function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Please log in first"
    });
  }

  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired login"
    });
  }
}

router.get("/", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can view all doctors"
      });
    }

    const doctors = await Doctor.find()
      .populate("user", "name email phone")
      .sort({ createdAt: -1 });

    return res.status(200).json({ doctors });
  } catch (error) {
    console.error("Doctors retrieval error:", error.message);

    return res.status(500).json({
      message: "Could not retrieve doctors"
    });
  }
});


router.get("/me", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "doctor") {
      return res.status(403).json({
        message: "Only doctors can access this profile"
      });
    }
    console.log("Doctor profile lookup:", {
  userId: req.user.userId,
  role: req.user.role
});

    const doctor = await Doctor.findOne({
      user: req.user.userId || req.user.id || req.user.sub
    }).populate("user", "name email phone");

    if (!doctor) {
      return res.status(404).json({
        message: "Doctor profile not found for this login account"
      });
    }

    return res.status(200).json({ doctor });
  } catch (error) {
    console.error("Doctor profile retrieval error:", error.message);

    return res.status(500).json({
      message: "Could not retrieve doctor profile"
    });
  }
});
 
router.put("/me/shifts", authenticate, async (req, res) => {
    console.log("PUT /api/doctors/me/shifts ROUTE HIT");
  try {
    if (req.user.role !== "doctor") {
      return res.status(403).json({
        message: "Only doctors can update working hours"
      });
    }

    const userId =
      req.user.userId || req.user.id || req.user.sub;

    const shifts = req.body.shifts;

    if (!shifts || typeof shifts !== "object" || Array.isArray(shifts)) {
      return res.status(400).json({
        message: "Please provide valid working hours"
      });
    }

    // Validate Monday to Saturday.
    for (const day of ["1", "2", "3", "4", "5", "6"]) {
      const dayShifts = shifts[day];

      if (!Array.isArray(dayShifts)) {
        return res.status(400).json({
          message: `Invalid working hours for day ${day}`
        });
      }

      for (const shift of dayShifts) {
        if (
          !Array.isArray(shift) ||
          shift.length !== 2 ||
          !Number.isFinite(shift[0]) ||
          !Number.isFinite(shift[1]) ||
          shift[0] < 0 ||
          shift[1] > 1440 ||
          shift[0] >= shift[1]
        ) {
          return res.status(400).json({
            message: `Invalid time range for day ${day}`
          });
        }
      }
    }

    // Sunday is always off.
    shifts["0"] = [];

    const doctor = await Doctor.findOneAndUpdate(
      { user: userId },
      { $set: { shifts } },
      { new: true, runValidators: true }
    ).populate("user", "name email phone");

    if (!doctor) {
      return res.status(404).json({
        message: "Doctor profile not found"
      });
    }

    return res.status(200).json({
      message: "Working hours saved successfully",
      doctor
    });
  } catch (error) {
    console.error("Save working hours error:", error.message);

    return res.status(500).json({
      message: "Could not save working hours"
    });
  }
});


router.get("/public", async (req, res) => {
  try {
    const doctors = await Doctor.find()
     .populate("user", "name email")
      .select(
        "frontendId departmentId qualification experience fee bio shifts"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      doctors: doctors
        .filter(d => d.user)
        .map(d => ({
          _id: d._id,
          frontendId: d.frontendId,
          name: d.user.name,
          userId: d.user._id,
          departmentId: d.departmentId,
          qualification: d.qualification,
          experience: d.experience,
          fee: d.fee,
          bio: d.bio,
          shifts: d.shifts
        }))
    });
  } catch (error) {
    console.error("Public doctors retrieval error:", error.message);

    return res.status(500).json({
      message: "Could not retrieve doctors"
    });
  }
});
console.log("Doctor routes loaded: GET /me, PUT /me/shifts");

module.exports = router;
