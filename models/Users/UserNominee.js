const mongoose = require('mongoose');

const nomineeSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  nominee_name: { type: String, required: true },
  relation: { type: String, required: true },
  dob: { type: Date },
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  contact_number: { type: String },
  address: { type: String },
  id_proof_img: { type: String },  // if you want to upload
}, { timestamps: true });

module.exports = mongoose.model('UserNominee', nomineeSchema);


