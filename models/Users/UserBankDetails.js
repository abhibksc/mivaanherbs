const mongoose = require('mongoose');

const userBankSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
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
