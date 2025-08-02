const mongoose = require("mongoose");

const PincodeSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    pincode: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Pincode", PincodeSchema);
