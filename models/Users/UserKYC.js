const mongoose = require('mongoose');

const userKycSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

  // Aadhar Section
  aadhar_number: { type: String },
  aadhar_front_img: { type: String },
  aadhar_back_img: { type: String },
  aadhar_verified: { type: Boolean, default: false },
  aadhar_verified_at: { type: Date },

  // PAN Section
  pan_number: { type: String },
  pan_img: { type: String },
  pan_verified: { type: Boolean, default: false },
  pan_verified_at: { type: Date },

  // Basic Info Section
  dob: { type: Date },
  user_img: { type: String },

  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  basic_info_verified: { type: Boolean, default: false },
  basic_info_verified_at: { type: Date },

  // Final Global KYC status
  is_fully_verified: { type: Boolean, default: false },
  fully_verified_at: { type: Date }

}, { timestamps: true });

module.exports = mongoose.model('UserKYC', userKycSchema);
