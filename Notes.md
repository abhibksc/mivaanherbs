const mongoose = require('mongoose');

// Embedded Income Log for userSchema
const incomeLogSubSchema = new mongoose.Schema({
  type: { type: String, enum: ['Direct', 'Fighter', 'Matching'], required: true },
  amount: { type: Number, required: true },
  from_user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  created_at: { type: Date, default: Date.now }
}, { _id: false });

// MLM Network Subschema
const mlmReferralSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  package_amount: { type: Number, required: true },
  benefit_percent: { type: Number, required: true },
  joined_at: { type: Date, default: Date.now }
}, { _id: false });

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  full_name: { type: String, required: true },
  mobile: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  country_id: { type: String },

  password: { type: String, required: true },
// nn
 referred_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
MYsponsor_id: { type: String, required: true },
other_sponsor_id: { type: String, default: null }, 

  left_user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  right_user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  left_bv: { type: Number, default: 0 },
  right_bv: { type: Number, default: 0 },

  wallet_balance: { type: Number, default: 0 },
  direct_sponsor_income: { type: Number, default: 0 },
  fighter_income: { type: Number, default: 0 },
  matching_income: { type: Number, default: 0 },
  income_logs: [incomeLogSubSchema],

  my_mlm_network: [mlmReferralSchema],
  upline_path: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  package: { type: Number },
  is_active: { type: Boolean, default: false },

  crt_by: { type: String },
  crt_date: { type: Date, default: Date.now }
});




const User = mongoose.model('User', userSchema);

module.exports = User;



const mongoose = require('mongoose');

const userAddressSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  full_name: {
    type: String,
    required: true,
  },
  mobile_number: {
    type: String,
    required: true,
  },
  alternate_number: String,
  pincode: {
    type: String,
    required: true,
  },
  address_line1: {
    type: String,
    required: true,
  },
  address_line2: String,
  landmark: String,
  city: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    default: "India",
  },
  address_type: {
    type: String,
    enum: ["Home", "Work", "Other"],
    default: "Home",
  },
  is_default: {
    type: Boolean,
    default: false,
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('UserAddress', userAddressSchema);




const mongoose = require('mongoose');

const userBankSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  account_holder_name: { type: String, required: true },
  account_number: { type: String, required: true },
  ifsc_code: { type: String, required: true },
  bank_name: { type: String, required: true },
  branch_name: { type: String },
  upi_id: { type: String },
  is_verified: { type: Boolean, default: false },
  verified_at: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('UserBankDetail', userBankSchema);




const mongoose = require('mongoose');

const userKycSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  aadhar_number: { type: String, required: true },
  pan_number: { type: String, required: true },
  dob: { type: Date, required: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  aadhar_front_img: { type: String },  // URL or base64
  aadhar_back_img: { type: String },
  pan_img: { type: String },
  is_verified: { type: Boolean, default: false },
  verified_at: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('UserKYC', userKycSchema);



