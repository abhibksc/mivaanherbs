const mongoose = require('mongoose');
const transactionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  package_amount: { type: mongoose.Decimal128, required: true },
  dp: { type: mongoose.Decimal128, required: false },
  bv: { type: mongoose.Decimal128, required: false },
  payment_ref: { type: String, required: true, unique: true },
  status: { type: String, enum: ['Pending', 'Success', 'Failed'], default: 'Success' },
  created_at: { type: Date, default: Date.now }
});
const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports={Transaction};