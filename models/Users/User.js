const mongoose = require("mongoose");

// Income Log Subschema
const incomeLogSubSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Direct", "Fighter", "Matching"],
      required: true,
    },
    amount: { type: Number, required: true },
    from_user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    created_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

// MLM Referral Subschema
const mlmReferralSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    package_amount: { type: Number, required: true },
    benefit_percent: { type: Number, required: true },
    joined_at: { type: Date, default: Date.now },
    position: { type: String },
  },
  { _id: false }
);

// ✅ ActivatedWith Subschema
const activatedWithSchema = new mongoose.Schema(
  {
    product_name: { type: String, required: true },
    product_mrp: { type: Number, required: true },
    product_dp: { type: Number, required: true },
    product_bv: { type: Number, required: true },
    total_activated_amount: { type: Number, required: true },
  },
  { _id: false }
);

// ✅ Main User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  full_name: { type: String, required: true },
  mobile: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  country_id: { type: String },

  password: { type: String, required: true },
  referred_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },

  MYsponsor_id: { type: String, required: true },
  other_sponsor_id: { type: String, default: null },

  left_user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  right_user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },

  left_bv: { type: Number, default: 0 },
  right_bv: { type: Number, default: 0 },

  fighter_user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },

  wallet_balance: { type: Number, default: 0 },
  direct_sponsor_income: { type: Number, default: 0 },
  fighter_income: { type: Number, default: 0 },
  matching_income: { type: Number, default: 0 },
  income_logs: [incomeLogSubSchema],

  my_mlm_network: [mlmReferralSchema],
  upline_path: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  // ✅ Updated field
  Activated_with: activatedWithSchema,

  is_active: { type: Boolean, default: false },
  level: { type: Number, default: 0 },
  crt_by: { type: String },
  crt_date: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
module.exports = User;
