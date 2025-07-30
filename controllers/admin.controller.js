const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { Transaction } = require("../models/Transaction");
const User = require('../models/auth'); // Adjust path to your User model


// const { Transaction } = require("../models/Transaction");
// const User = require("../models/user");

const ADMIN = {
  email: "admin@example.com",
  password: bcrypt.hashSync("admin123", 10), // hashed password
};


const loginAdmin = (req, res) => {
  const { email, password } = req.body;

  if (email !== ADMIN.email || !bcrypt.compareSync(password, ADMIN.password)) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // 🟢 Include role in token payload
  const token = jwt.sign(
    {
      email,
      role: "admin", // Marking this token as admin
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    }
  );

  res.json({ token });
};









const getAdminProfile = (req, res) => {
  res.json({ message: "Welcome, Admin", admin: req.admin });
};

const getAllOrders = async (req, res) => {
  try {
    const adminId = req.admin.id; // assuming JWT sets `req.admin` in middleware

    const transactions = await Transaction.find({ created_by_admin: adminId })
      .populate("user_id", "username email mobile full_name") // populate user details
      .sort({ created_at: -1 });

    res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      data: transactions,
    });
  } catch (error) {
    console.error("Error fetching admin orders:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching orders",
      error: error.message,
    });
  }
};



// Get total users count
const getTotalUsers = async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ totalUsers: count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get total users' });
  }
};

// Get total active users
const getActiveUsers = async (req, res) => {
  try {
    const count = await User.countDocuments({ is_active: true });
    res.json({ activeUsers: count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get active users' });
  }
};

// Get total income across all users
const getTotalIncome = async (req, res) => {
  try {
    const users = await User.find({});
    const total = users.reduce((acc, user) => {
      return acc + user.wallet_balance;
    }, 0);
    res.json({ totalIncome: total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to calculate total income' });
  }
};

// Get recent signups
const getRecentSignups = async (req, res) => {
  try {
    const users = await User.find({})
      .sort({ crt_date: -1 })
      .limit(5)
      .select('username full_name email mobile crt_date');
    res.json({ recentSignups: users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get recent signups' });
  }
};

// Get top 5 earners
const getTopEarners = async (req, res) => {
  try {
    const topUsers = await User.find({})
      .sort({ wallet_balance: -1 })
      .limit(5)
      .select('username wallet_balance');
    res.json({ topEarners: topUsers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get top earners' });
  }
};

// Get income summary by type
const getIncomeSummary = async (req, res) => {
  try {
    const users = await User.find({});
    let summary = {
      direct: 0,
      fighter: 0,
      matching: 0,
    };
    users.forEach(user => {
      summary.direct += user.direct_sponsor_income || 0;
      summary.fighter += user.fighter_income || 0;
      summary.matching += user.matching_income || 0;
    });

    res.json({ incomeSummary: summary });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get income summary' });
  }
};

// Get total left/right business volume
const getBusinessVolumeStats = async (req, res) => {
  try {
    const users = await User.find({});
    let totalLeftBV = 0;
    let totalRightBV = 0;

    users.forEach(user => {
      totalLeftBV += user.left_bv || 0;
      totalRightBV += user.right_bv || 0;
    });

    res.json({ totalLeftBV, totalRightBV });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get BV stats' });
  }
};

// Optional: Get tree info for one user (left/right structure)
const getTreeDataForUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .populate('left_user', 'username wallet_balance')
      .populate('right_user', 'username wallet_balance');

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: user.username,
      left: user.left_user,
      right: user.right_user
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get tree data' });
  }
};


// transaction


const getAllTransactions = async (req, res) => {
  try {
    const txns = await Transaction.find().populate('user_id', 'username email');
    res.json({ transactions: txns });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get transactions' });
  }
};



const getTotalTransactionVolume = async (req, res) => {
  try {
    const txns = await Transaction.find({ status: 'Success' });

    const total = txns.reduce((sum, t) => sum + parseFloat(t.package_amount.toString()), 0);

    res.json({ totalVolume: total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to calculate total volume' });
  }
};


const getRecentTransactions = async (req, res) => {
  try {
    const recent = await Transaction.find({ status: 'Success' })
      .sort({ created_at: -1 })
      .limit(5)
      .populate('user_id', 'username email');

    res.json({ recentTransactions: recent });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get recent transactions' });
  }
};


const getTransactionStats = async (req, res) => {
  try {
    const pending = await Transaction.countDocuments({ status: 'Pending' });
    const success = await Transaction.countDocuments({ status: 'Success' });
    const failed = await Transaction.countDocuments({ status: 'Failed' });

    res.json({ pending, success, failed });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get transaction stats' });
  }
};


















module.exports = {
  // 👇 Add these
  loginAdmin,
  getAdminProfile,
  getAllOrders,

  // Already present
  getTotalUsers,
  getActiveUsers,
  getTotalIncome,
  getRecentSignups,
  getTopEarners,
  getIncomeSummary,
  getBusinessVolumeStats,
  getTreeDataForUser,

  getAllTransactions,
  getTotalTransactionVolume,
  getRecentTransactions,
  getTransactionStats
};
