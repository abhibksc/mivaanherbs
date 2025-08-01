const { Transaction } = require("../models/Transaction");
const express = require("express");
const userRouter = express.Router();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../models/auth.js");
const handleTransactionAbort = require("../utils/handleTransactionError.js"); // adjust path accordingly

const { authMiddleware } = require("../middleware/auth.middleware");
const { checkRole } = require("../middleware/roles.middleware");
userRouter.use(authMiddleware, checkRole("user")); // Protect entire user route

// Generate username
function generateUsername(fullName) {
  const prefix = fullName
    .replace(/[^A-Za-z]/g, "")
    .toLowerCase()
    .substring(0, 3);
  const random = Math.floor(1000 + Math.random() * 9000);
  return prefix + random;
}


userRouter.post("/purchase-item", async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { username, packageAmount } = req.body;

    await session.withTransaction(async () => {
      // 1. Fetch user
      const user = await User.findOne({ username }).session(session);
      if (!user) {
        throw new Error("User not found");
      }

      // 2. Activate user
      user.package = packageAmount;
      await user.save({ session });

      // 3. Record transaction
      await Transaction.create(
        [
          {
            user_id: user._id,
            username,
            package_amount: packageAmount,
            payment_ref: `${user._id}/${username}`,
            status: "Pending",
          },
        ],
        { session }
      );
    });

    session.endSession();

    return res.json({
      success: true,
      message: "Item Purchased. Please contact your Admin to activate ID.",
    });
  } catch (err) {
    console.error("Purchase Error:", err.message);

    // Use your custom handler
    return handleTransactionAbort(
      session,
      res,
      500,
      err.message || "Transaction Failed"
    );
  }
});

// GET: Get all incomes for a user
userRouter.get(
  "/getProfile",

  async (req, res) => {
    try {
      const userId = req.user.id; // assuming you're using auth middleware
      const user = await User.findById(userId).select("-password -income_logs");
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: "Something went wrong." });
    }
  }
);

// GET: Get all incomes for a user
// userRouter.get(
//   "/getIncome",

//   async (req, res) => {
//     try {
//       const userId = req.user.id;
//       const user = await User.findById(userId);
//       const {
//         direct_sponsor_income,
//         fighter_income,
//         matching_income,
//         wallet_balance,
//       } = user;

//       res.json({
//         direct_sponsor_income,
//         fighter_income,
//         matching_income,
//         wallet_balance,
//       });
//     } catch (err) {
//       res.status(500).json({ error: "Failed to fetch income." });
//     }
//   }
// );

// GET: Get all incomes for a user
// userRouter.get(
//   "/getTransactions ",

//   async (req, res) => {
//     try {
//       const userId = req.user.id;
//       const transactions = await Transaction.find({ user_id: userId }).sort({
//         created_at: -1,
//       });
//       res.json(transactions);
//     } catch (err) {
//       res.status(500).json({ error: "Failed to fetch transactions." });
//     }
//   }
// );

// GET: Get all incomes for a user
// userRouter.get(
//   "/getMyNetwork ",

//   async (req, res) => {
//     try {
//       const userId = req.user.id;
//       const user = await User.findById(userId).populate(
//         "my_mlm_network.user_id",
//         "full_name username"
//       );
//       res.json(user.my_mlm_network);
//     } catch (err) {
//       res.status(500).json({ error: "Failed to fetch network." });
//     }
//   }
// );

userRouter.get("/dashboard-data", async (req, res) => {
  try {
    const userId = req.user.id; // from JWT payload (e.g., req.user = { id, username, role })

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const totalWithdrawal = await Transaction.aggregate([
      { $match: { user_id: user._id, status: "Success" } },
      { $group: { _id: null, total: { $sum: "$package_amount" } } },
    ]);

    const dashboardData = {
      wallet_balance: user.wallet_balance || 0,
      direct_sponsor_income: user.direct_sponsor_income || 0,
      fighter_income: user.fighter_income || 0,
      matching_income: user.matching_income || 0,
      total_withdrawal: totalWithdrawal[0]?.total || 0,
      total_rewards: 1000, // Dummy for now
      total_repurchase: 700, // Dummy for now
      total_referrals: user.my_mlm_network?.length || 0,
    };

    res.json(dashboardData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

userRouter.get(
  "/getWalletDetails",

  async (req, res) => {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId).select("wallet_balance");
      const transactions = await Transaction.find({ user_id: userId }).sort({
        created_at: -1,
      });

      res.json({ wallet_balance: user.wallet_balance, transactions });
    } catch (error) {
      res.status(500).json({ message: "Error fetching wallet details", error });
    }
  }
);

userRouter.get("/getDirectSponsorIncomeDetails", async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).populate({
      path: "income_logs.from_user",
      select: "username full_name mobile",
    });

    const directLogs = user.income_logs.filter((log) => log.type === "Direct");

    res.json({
      total: user.direct_sponsor_income,
      logs: directLogs,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching direct sponsor income", error });
  }
});

userRouter.get(
  "/getFighterIncomeDetails",

  async (req, res) => {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId).populate({
        path: "income_logs.from_user",
        select: "username full_name mobile",
      });

      const fighterLogs = user.income_logs.filter(
        (log) => log.type === "Fighter"
      );

      res.json({
        total: user.fighter_income,
        logs: fighterLogs,
      });
    } catch (error) {
      res.status(500).json({ message: "Error fetching fighter income", error });
    }
  }
);

userRouter.get("/getMatchingIncomeDetails", async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).populate({
      path: "income_logs.from_user",
      select: "username full_name mobile",
    });

    const matchingLogs = user.income_logs.filter(
      (log) => log.type === "Matching"
    );

    res.json({
      total: user.matching_income,
      logs: matchingLogs,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching matching income", error });
  }
});

userRouter.get(
  "/getAllIncomeLogs",

  async (req, res) => {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId).populate({
        path: "income_logs.from_user",
        select: "username full_name mobile",
      });

      res.json({ logs: user.income_logs });
    } catch (error) {
      res.status(500).json({ message: "Error fetching income logs", error });
    }
  }
);

// Upline and downline hirarcy

// userRouter.get("/getUpline",

//   async (req, res) => {

//     const userId = req.user.id;

//   try {
//     const user = await User.findById(userId).populate('upline_path', 'username full_name');
//     if (!user) return res.status(404).json({ message: 'User not found' });

//     res.json({ upline: user.upline_path });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// }

// );

// const buildDownline = async(fullName) => {
//   const prefix = fullName
//     .replace(/[^A-Za-z]/g, "")
//     .toLowerCase()
//     .substring(0, 3);
//   const random = Math.floor(1000 + Math.random() * 9000);
//   return prefix + random;
// }

// userRouter.get("/getUpline",

//   async (userId) => {
//   const user = await User.findById(userId).select('username full_name left_user right_user');
//   if (!user) return null;

//   const left = user.left_user ? await buildDownline(user.left_user) : null;
//   const right = user.right_user ? await buildDownline(user.right_user) : null;

//   return {
//     _id: user._id,
//     username: user.username,
//     full_name: user.full_name,
//     left_user: left,
//     right_user: right
//   };
// }

// );

module.exports = userRouter;
