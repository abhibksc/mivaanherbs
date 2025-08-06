const mongoose = require("mongoose");

const UserWalletRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  amount: {
    type: Number,
    required: true,
    min: [1, "Amount must be greater than 0"],
  },

  screenshot: {
    type: String, // 💡 This will store the image URL or path (e.g., /uploads/wallet/xyz.png)
    required: true,
  },

  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending",
  },

  reason: {
    type: String,
    default: "",
  },

  approved_by: {
    type: String, // admin name or ID
    default: null,
  },

  requested_at: {
    type: Date,
    default: Date.now,
  },

  approved_at: {
    type: Date,
  },
});

module.exports = mongoose.model("UserWalletRequest", UserWalletRequestSchema);
