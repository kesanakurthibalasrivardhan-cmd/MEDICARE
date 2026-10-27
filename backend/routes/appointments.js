
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const router = express.Router();
const Notification = require("../models/Notification");

// Verify logged-in patient
function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Please log in first" });
  }

  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired login" });
  }
}

// Book appointment

 // Book appointment
router.post("/", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "patient") {
      return res.status(403).json({
        message: "Only patients can book appointments"
      });
    }

    const {
      doctor,
      department,
      appointmentDate,
      appointmentTime,
      reason
    } = req.body;

    if (!doctor || !department || !appointmentDate || !appointmentTime) {
      return res.status(400).json({
        message: "Please provide doctor, department, date and time"
      });
    }

    // Accept the frontend doctor ID and find its MongoDB profile.
    const doctorProfile = await Doctor.findOne({
      frontendId: doctor
    });

    if (!doctorProfile) {
      return res.status(404).json({
        message: "Doctor profile not found in the database"
      });
    }

    // Validate the appointment date.
    const date = new Date(appointmentDate);

    if (Number.isNaN(date.getTime()) || date <= new Date()) {
      return res.status(400).json({
        message: "Please choose a future appointment date"
      });
    }

    // Prevent duplicate active bookings for this doctor and time.
    const existing = await Appointment.findOne({
      doctor: doctorProfile._id,
      appointmentDate: date,
      appointmentTime,
      status: { $nin: ["CANCELLED", "NO_SHOW"] }
    });

    if (existing) {
      return res.status(409).json({
        message: "This time slot is already booked"
      });
    }

    const appointment = await Appointment.create({
      patient: req.user.userId,
      doctor: doctorProfile._id,
      department,
      appointmentDate: date,
      appointmentTime,
      reason: reason || ""
    });

    return res.status(201).json({
      message: "Appointment booked successfully",
      appointment
    });
  } catch (error) {
    console.error("Booking error:", error);
    return res.status(500).json({
      message: "Could not book appointment"
    });
  }
});


// Get appointments for the logged-in patient
router.get("/my", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "patient") {
      return res.status(403).json({ message: "Patients only" });
    }

    const appointments = await Appointment.find({
      patient: req.user.userId
    }).sort({ appointmentDate: 1 });

    res.json(appointments);
  } catch (error) {
    res.status(500).json({
      message: "Could not fetch appointments"
    });
  }
});

/* Admin: Get all appointments with patient and doctor details */

router.get("/", authenticate, async (req, res) => {
  try {
    let query = {};

   
if (
  req.user.role === "admin" ||
  req.user.role === "receptionist" ||
  req.user.role === "reception"
) {
  // Admin and reception staff can view appointments.
} else if (req.user.role === "doctor") {

      // Find the doctor profile linked to this login account.
      const doctorProfile = await Doctor.findOne({
        user: req.user.userId
      });

      if (!doctorProfile) {
        return res.status(404).json({
          message: "Doctor profile not found"
        });
      }

      // Doctors can view only their own appointments.
      query.doctor = doctorProfile._id;
    } else {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    const appointments = await Appointment.find(query)
      .populate("patient", "name email phone")
      .populate({
        path: "doctor",
        populate: {
          path: "user",
          select: "name email phone"
        }
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({ appointments });
  } catch (error) {
    console.error("Appointments retrieval error:", error.message);

    return res.status(500).json({
      message: "Could not retrieve appointments"
    });
  }
});

console.log("MediSync walk-in route loaded");
/* Receptionist: Register a walk-in patient and book an appointment */

router.post("/walkin", authenticate, async (req, res) => {
  // Do not log req.body because it contains the patient's password.
  console.log("WALKIN POST ROUTE HIT");

  try {
    if (req.user.role !== "receptionist") {
      return res.status(403).json({
        message: "Receptionist access only"
      });
    }

    const {
      name,
      phone,
      email,
      password,
      age,
      gender,
      doctor,
      department,
      appointmentDate,
      appointmentTime,
      checkin
    } = req.body;

    const normalizedEmail = email?.trim().toLowerCase();

    if (
      !name?.trim() ||
      !phone?.trim() ||
      !normalizedEmail ||
      !password ||
      !doctor ||
      !department ||
      !appointmentDate ||
      !appointmentTime
    ) {
      return res.status(400).json({
        message: "Please provide patient name, phone, email, password, doctor, department, date and time"
      });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Please provide a valid email address"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters"
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists"
      });
    }

    const doctorProfile = await Doctor.findOne({
      frontendId: doctor
    });

    console.log("Walk-in doctor lookup:", {
      requestedDoctorId: doctor,
      found: !!doctorProfile,
      matchedFrontendId: doctorProfile?.frontendId,
      matchedDepartmentId: doctorProfile?.departmentId
    });

    if (!doctorProfile) {
      return res.status(404).json({
        message: "Doctor profile not found in the database"
      });
    }

    if (
      String(doctorProfile.departmentId) !== String(department)
    ) {
      return res.status(400).json({
        message: "The selected doctor does not belong to this department"
      });
    }

    const date = new Date(appointmentDate);

    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({
        message: "Invalid appointment date"
      });
    }

    const existingAppointment = await Appointment.findOne({
      doctor: doctorProfile._id,
      appointmentDate: date,
      appointmentTime,
      status: { $nin: ["CANCELLED", "NO_SHOW"] }
    });

    if (existingAppointment) {
      return res.status(409).json({
        message: "This time slot is already booked"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const patient = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone: phone.trim(),
      role: "patient"
    });

    try {
      const appointment = await Appointment.create({
        patient: patient._id,
        doctor: doctorProfile._id,
        department,
        appointmentDate: date,
        appointmentTime,
        reason: [
          age !== undefined && age !== ""
            ? `Age: ${age}`
            : "",
          gender ? `Gender: ${gender}` : ""
        ].filter(Boolean).join(", "),
        status: checkin ? "CHECKED_IN" : "BOOKED"
      });
      await Notification.create({
  user: doctorProfile.user,
  type: "booking",
  title: "New walk-in appointment",
  body: `${patient.name} · ${appointmentDate} at ${appointmentTime}`,
  read: false
});

      return res.status(201).json({
        message: "Walk-in patient registered and appointment booked",
        patient: {
          id: patient._id,
          name: patient.name,
          email: patient.email,
          phone: patient.phone
        },
        appointment
      });
    } catch (appointmentError) {
      await User.deleteOne({ _id: patient._id });
      throw appointmentError;
    }
  } catch (error) {
    console.error("Walk-in registration error:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists"
      });
    }

    return res.status(500).json({
      message: "Could not register the walk-in patient"
    });
  }
});


router.patch("/:id/status", authenticate, async (req, res) => {
  try {
    const allowedRoles = ["admin", "reception", "receptionist", "doctor"];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { status } = req.body;

    const allowedTransitions = {
      CHECKED_IN: ["BOOKED"],
      IN_CONSULT: ["CHECKED_IN"],
      COMPLETED: ["IN_CONSULT", "CHECKED_IN"],
      NO_SHOW: ["BOOKED", "CHECKED_IN"]
    };

    if (!allowedTransitions[status]) {
      return res.status(400).json({ message: "Invalid appointment status" });
    }

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (!allowedTransitions[status].includes(appointment.status)) {
      return res.status(400).json({
        message: `Cannot change status from ${appointment.status} to ${status}`
      });
    }

    if (
      ["reception", "receptionist"].includes(req.user.role) &&
      !["CHECKED_IN", "IN_CONSULT", "COMPLETED", "NO_SHOW"].includes(status)
    ) {
      return res.status(403).json({
        message: "Reception staff cannot perform this appointment action"
      });
    }

    // Check-in is allowed only for appointments scheduled today.
    if (
      ["reception", "receptionist"].includes(req.user.role) &&
      status === "CHECKED_IN"
    ) {
      const appointmentDay = new Date(appointment.appointmentDate)
        .toISOString()
        .slice(0, 10);

      const today = new Date().toISOString().slice(0, 10);

      if (appointmentDay !== today) {
        return res.status(400).json({
          message: "Only appointments scheduled for today can be checked in"
        });
      }
    }

    // Doctors can update only their own appointments.
    if (req.user.role === "doctor") {
      const doctorProfile = await Doctor.findOne({
        user: req.user.userId
      });

      if (
        !doctorProfile ||
        String(appointment.doctor) !== String(doctorProfile._id)
      ) {
        return res.status(403).json({
          message: "You can only update your own patients' appointments"
        });
      }
    }

    appointment.status = status;
    await appointment.save();

    await Notification.create({
      user: appointment.patient,
      type: "status",
      title: `Appointment ${status.toLowerCase().replace("_", " ")}`,
      body: `Your appointment status is now ${status.replace("_", " ")}.`,
      read: false
    });

    return res.json({
      message: "Appointment status updated successfully",
      appointment
    });
  } catch (error) {
    console.error("Appointment status update error:", error);

    return res.status(500).json({
      message: "Could not update appointment status"
    });
  }
});


router.get("/notifications", authenticate, async (req, res) => {
  try {
    const notifications = await Notification.find({
      user: req.user.userId
    }).sort({ createdAt: -1 }).limit(50);

    return res.status(200).json({ notifications });
  } catch (error) {
    console.error("Notifications retrieval error:", error.message);

    return res.status(500).json({
      message: "Could not retrieve notifications"
    });
  }
});


module.exports = router;
