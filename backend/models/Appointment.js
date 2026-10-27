
const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true
    },
    department: {
      type: String,
      required: true
    },
    appointmentDate: {
      type: Date,
      required: true
    },
    appointmentTime: {
      type: String,
      required: true
    },
    reason: {
      type: String,
      default: ""
    },
    tokenNumber: {
      type: Number
    },
    status: {
      type: String,
      enum: [
        "BOOKED",
        "CHECKED_IN",
        "IN_CONSULT",
        "COMPLETED",
        "CANCELLED",
        "NO_SHOW"
      ],
      default: "BOOKED"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "Appointment",
  appointmentSchema
);