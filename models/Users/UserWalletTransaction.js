const UserWalletTransaction = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: {
    type: String,
    enum: ['AdminCredit', 'Purchase', 'DownlineSupport'],
    required: true,
  },
  amount: { type: Number, required: true }, // positive or negative
  from_user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  note: { type: String },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('UserWalletTransaction', UserWalletTransaction);
