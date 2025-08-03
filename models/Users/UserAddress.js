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
  pin_code: {
    type: String,
    required: true,
  },
  address_line: {
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
