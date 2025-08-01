

const User = require("../models/auth");
const { Transaction } = require("../models/Transaction");



const express = require("express");
const router = express.Router();
const { loginAdmin, getAdminProfile ,getAllOrders} = require("../controllers/admin.controller");
const { authMiddleware } = require("../middleware/auth.middleware");
const dashboard = require('../controllers/admin.controller');
const txnCtrl = require('../controllers/admin.controller');


const { checkRole } = require("../middleware/roles.middleware");
router.use(authMiddleware, checkRole("admin")); // Protect entire admin route

router.get("/profile", getAdminProfile);
router.get('/order', getAllOrders);
router.get('/allusers', async (req, res) => {
  try {
    // Fetch users
    const users = await User.find(
      {},
      {
        username: 1,
        email: 1,
        mobile: 1,
        country_id: 1,
        crt_date: 1,
        is_active: 1,
        wallet_balance: 1,
      }
    ).sort({ crt_date: -1 });

    // Fetch all successful transactions, sorted by creation date
    const transactions = await Transaction.find({ status: 'Success' }).sort({ created_at: 1 });

    // Map user_id => [transactions], and first transaction
    const firstTransactionMap = {};
    const userPackageSums = {};
    let totalPackageSell = 0;

    for (const txn of transactions) {
      const userId = txn.user_id.toString();
      const amount = parseFloat(txn.package_amount?.toString() || '0');

      // Sum all packages
      userPackageSums[userId] = (userPackageSums[userId] || 0) + amount;
      totalPackageSell += amount;

      // Store the first (oldest) transaction only
      if (!firstTransactionMap[userId]) {
        firstTransactionMap[userId] = amount;
      }
    }

    // Prepare response data
    const userData = users.map((user) => {
      const userId = user._id.toString();
      return {
        userId: userId,
        username: user.username,
        email: user.email,
        isVarified_email: false,
        isVarified_mobile: false,
        mobile: user.mobile,
        country: user.country_id,
        joined_at: user.crt_date,
        active: user.is_active,
        balance: user.wallet_balance,
        activated_amount: firstTransactionMap[userId] || 0,
      };
    });

    return res.json({
      total_package_sell: totalPackageSell,
      withdrawals: 0,
      data: userData,
    });

  } catch (err) {
    console.error("User list error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// routes/admin.js
router.patch('/user/:id/status', async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  try {
    await User.updateOne({ _id: id }, { $set : { is_active } });
    console.log(is_active);

    res.json({
      success: true,
      message: `User ${is_active ? 'activated' : 'deactivated'}`,
      _id: id,
      is_active
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: err
    });
  }
});


router.get('/total-users', dashboard.getTotalUsers);
router.get('/active-users', dashboard.getActiveUsers);
router.get('/total-income', dashboard.getTotalIncome);
router.get('/recent-signups', dashboard.getRecentSignups);
router.get('/top-earners', dashboard.getTopEarners);
router.get('/income-summary',  dashboard.getIncomeSummary);
router.get('/bv-stats',  dashboard.getBusinessVolumeStats);
router.get('/tree/:userId',  dashboard.getTreeDataForUser); // optional


router.get('/allTxn',  txnCtrl.getAllTransactions);
router.get('/total-volume',  txnCtrl.getTotalTransactionVolume);
router.get('/recent',  txnCtrl.getRecentTransactions);
router.get('/stats',  txnCtrl.getTransactionStats);




module.exports = router;
