
const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    frontendId: {
      type: String,
      required: true,
      unique: true,
    },
    departmentId: {
      type: String,
      required: true,
    },
    qualification: String,
    experience: Number,
    fee: Number,
    bio: String,
    shifts: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    leave: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Doctor", doctorSchema);