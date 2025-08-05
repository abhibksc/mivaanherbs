const { Transaction } = require("../../models/Users/UserTransaction.js");
const express = require("express");
const userRouter = express.Router();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../../models/Users/User.js");
const handleTransactionAbort = require("../../utils/handleTransactionError.js"); // adjust path accordingly

const { authMiddleware } = require("../../middleware/auth.middleware.js");
const { checkRole } = require("../../middleware/roles.middleware.js");
const UserAddress = require("../../models/Users/UserAddress.js");
const UserBankDetails = require("../../models/Users/UserBankDetails.js");
const UserKYC = require("../../models/Users/UserKYC.js");
const UserNominee = require("../../models/Users/UserNominee.js");

const multer = require("multer");
const path = require("path");

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/kyc"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

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

userRouter.get(
  "/myteam",

  async (req, res) => {
    try {
      const userId = req.user.id; // Assuming auth middleware sets req.user

      console.log(userId);
      

      // Get all users who have this user in their upline_path
      const downlineUsers = await User.find({ upline_path: userId })
        .select(
          "full_name username mobile email is_active package referred_by crt_date"
        )
        .populate("referred_by", "full_name username");

      res.json({
        status: true,
        data: downlineUsers,
      });
    } catch (err) {
      console.error("MyTeam Error:", err);
      res.status(500).json({ status: false, message: "Server error" });
    }
  }
);

const buildTree = async (userId) => {
  const user = await User.findById(userId)
    .select("username full_name left_user right_user package is_active")
    .lean();

  if (!user) return null;

  const left = user.left_user ? await buildTree(user.left_user) : null;
  const right = user.right_user ? await buildTree(user.right_user) : null;

  return {
    _id: user._id,
    username: user.username,
    full_name: user.full_name,
    package: user.package,
    is_active: user.is_active,
    left,
    right,
  };
};

userRouter.get("/mygeology", async (req, res) => {
  try {
    const userId = req.user._id;

    const tree = await buildTree(userId);

    res.json({
      status: true,
      tree,
    });
  } catch (err) {
    console.error("MyGeology Error:", err);
    res
      .status(500)
      .json({ status: false, message: "Failed to build genealogy" });
  }
});

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

// GET: Get all incomes for a user
userRouter.get(
  "/getProfile",

  async (req, res) => {
    try {
      const userId = req.user.id;

      // Get user core details
      const user = await User.findById(userId).lean();
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Safely fetch related data
      const address =
        (await UserAddress.find({ user_id: userId }).lean()) || [];
      const bank =
        (await UserBankDetails.findOne({ user_id: userId }).lean()) || null;
      const kyc = (await UserKYC.findOne({ user_id: userId }).lean()) || null;
      const nominee =
        (await UserNominee.findOne({ user_id: userId }).lean()) || null;

      return res.json({
        user,
        address,
        bank,
        kyc,
        nominee,
      });
    } catch (err) {
      console.error("Error fetching user profile:", err);
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    }
  }
);

userRouter.post("/upload-doc", upload.single("file"), async (req, res) => {
  const userId = req.user.id;
  const { docType, dob, gender } = req.body;

  try {
    const filename = req.file ? req.file.filename : null;
    const relativePath = filename ? `/uploads/kyc/${filename}` : null;

    const fullUrl = req.protocol + "://" + req.get("host"); // http://localhost:3000
    const fileUrl = filename ? `${fullUrl}${relativePath}` : null;

    let updateData = {};
    switch (docType) {
      case "aadhar_front":
        updateData = {
          aadhar_front_img: fileUrl,
          aadhar_verified: false,
          aadhar_verified_at: null,
        };
        break;
      case "aadhar_back":
        updateData = {
          aadhar_back_img: fileUrl,
          aadhar_verified: false,
          aadhar_verified_at: null,
        };
        break;
      case "pan":
        updateData = {
          pan_img: fileUrl,
          pan_verified: false,
          pan_verified_at: null,
        };
        break;
      case "basic_info":
        updateData = {
          dob: dob ? new Date(dob) : undefined,
          gender,
          user_img: fileUrl,
          basic_info_verified: false,
          basic_info_verified_at: null,
        };
        break;
      default:
        return res.status(400).json({ message: "Invalid document type" });
    }

    const updated = await UserKYC.findOneAndUpdate(
      { user_id: userId },
      { $set: updateData },
      { new: true, upsert: true }
    );

    res.json({ message: "Document uploaded", data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Upload failed" });
  }
});

userRouter.get("/kyc-status", async (req, res) => {
  const userId = req.user.id;
  try {
    const status = await UserKYC.findOne({ user_id: userId });
    res.json(status || {});
  } catch (err) {
    res.status(500).json({ message: "Error getting status" });
  }
});

userRouter.get("/get-kyc-status", async (req, res) => {
  const userId = req.user.id;

  try {
    const userKYC = await UserKYC.findOne({ user_id: userId });

    if (!userKYC) {
      return res.status(404).json({ message: "KYC details not found" });
    }

    const response = {
      aadhar_front_img: userKYC.aadhar_front_img || null,
      aadhar_back_img: userKYC.aadhar_back_img || null,
      pan_img: userKYC.pan_img || null,
      user_img: userKYC.user_img || null,
      dob: userKYC.dob || null,
      gender: userKYC.gender || null,

      aadhar_verified: userKYC.aadhar_verified || false,
      aadhar_verified_at: userKYC.aadhar_verified_at || null,

      pan_verified: userKYC.pan_verified || false,
      pan_verified_at: userKYC.pan_verified_at || null,

      basic_info_verified: userKYC.basic_info_verified || false,
      basic_info_verified_at: userKYC.basic_info_verified_at || null,
    };

    res.json({ success: true, data: response });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});


userRouter.post("/activate", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { username , amount } = req.body;

    // 1. Fetch user
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.is_active) return res.status(404).json({ error: "Id Already Activated!" });


    // 2. fetch transaction

    const user_transaction = await Transaction.findOne({ user_id: user._id });
    if (!user_transaction)
      return res
        .status(404)
        .json({
          error:
            "No Transaction Found.. Please Purchase any Item then Activate Account",
        });

    // 2. Activate user
    user.is_active = true;
    const packageAmount = user.package;
    await user.save();
    const dp = Math.round(packageAmount * 0.8017);
    const bv = parseFloat((packageAmount * 0.0079).toFixed(2));

    // 3. updat transaction table where user_transaction._id
    await Transaction.updateOne(
      { user_id: user._id }, // Filter
      {
        $set: {
          dp,
          bv,
          status: "Success",
        },
      }
    );

    // 4. Find sponsor
    const sponsor = await User.findOne({
      my_sponsor_id: user.other_sponsor_id,
    });

    if (sponsor) {
      let sponsorChanged = false;
      d;
      // 6. Direct Income (10%)
      const directIncome = packageAmount * 0.1;
      sponsor.wallet_balance += directIncome;
      sponsor.direct_sponsor_income += directIncome;
      sponsor.income_logs.push({
        type: "Direct",
        amount: directIncome,
        from_user: user._id,
      });
      sponsorChanged = true;

      // 7. Fighter Income (5%)
      if (sponsor.left_user && sponsor.right_user) {
        const fighterIncome = packageAmount * 0.05;
        sponsor.wallet_balance += fighterIncome;
        sponsor.fighter_income += fighterIncome;
        sponsor.income_logs.push({
          type: "Fighter",
          amount: fighterIncome,
          from_user: user.other_sponsor_id,
        });
        sponsorChanged = true;
      }

      // 8. Update BV
      const side =
        String(sponsor.left_user) === String(user._id) ? "left_bv" : "right_bv";
      sponsor[side] += bv;
      sponsorChanged = true;

      // 9. Matching Income (30% of min BV)
      const pairBV = Math.min(sponsor.left_bv, sponsor.right_bv);
      if (pairBV > 0) {
        const matchIncome = pairBV * 0.3;
        sponsor.wallet_balance += matchIncome;
        sponsor.matching_income += matchIncome;
        sponsor.left_bv -= pairBV;
        sponsor.right_bv -= pairBV;
        sponsor.income_logs.push({
          type: "Matching",
          amount: matchIncome,
          from_user: sponsor._id, // from self
        });
        sponsorChanged = true;
      }

      if (sponsorChanged) await sponsor.save();
    }

    return res.json({
      success: true,
      message: "User activated and incomes distributed",
    });
  } catch (err) {
    console.error("Activation Error:", err);
    return await handleTransactionAbort(
      session,
      res,
      400,
      `Activation Error:", ${err}`
    );
  }
});

const getDownlineUsers = async (userId) => {
  const directReferrals = await User.find({ referred_by: userId });

  let allDownline = [...directReferrals];

  for (const user of directReferrals) {
    const subDownline = await getDownlineUsers(user._id);
    allDownline = allDownline.concat(subDownline);
  }

  return allDownline;
};

// GET /api/user/downline/:userId
userRouter.get("/get-downline-users", async (req, res) => {
  const userId = req.user.id;

  try {
    const downlineUsers = await getDownlineUsers(userId);

    res.status(200).json({ success: true, data: downlineUsers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// Update Users Profile

// Update section route
userRouter.put("/updateSection", async (req, res) => {
  try {
    const { section, data } = req.body;
    const userId = req.user.id;

    let updated;

    switch (section) {
      case "user":
        updated = await User.findByIdAndUpdate(userId, data, {
          new: true,
          runValidators: true,
        });
        return res.json({ user: updated });

      case "address":
        updated = await UserAddress.findOneAndUpdate(
          { user_id: userId },
          { ...data, user_id: userId },
          { upsert: true, new: true }
        );
        return res.json({ address: updated });

      case "bank":
        updated = await UserBankDetails.findOneAndUpdate(
          { user_id: userId },
          { ...data, user_id: userId },
          { upsert: true, new: true }
        );
        return res.json({ bank: updated });

      case "kyc":
        updated = await UserKYC.findOneAndUpdate(
          { user_id: userId },
          { ...data, user_id: userId },
          { upsert: true, new: true }
        );
        return res.json({ kyc: updated });

      case "nominee":
        updated = await UserNominee.findOneAndUpdate(
          { user_id: userId },
          { ...data, user_id: userId },
          { upsert: true, new: true }
        );
        return res.json({ nominee: updated });

      default:
        return res.status(400).json({ error: "Invalid section" });
    }
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

userRouter.put("/updateUser", async (req, res) => {
  try {
    const { full_name, email, mobile } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { full_name, email, mobile },
      { new: true }
    );
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

userRouter.put("/updateAddress", async (req, res) => {
  try {
    const { address_line, city, state, pin_code, country } = req.body;
    const updated = await UserAddress.findOneAndUpdate(
      { user_id: req.user._id },
      { address_line, city, state, pin_code, country },
      { upsert: true, new: true }
    );
    res.json({ success: true, address: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

userRouter.put("/updateBank", async (req, res) => {
  try {
    const { account_holder_name, account_number, ifsc_code, bank_name } =
      req.body;
    const updated = await UserBankDetails.findOneAndUpdate(
      { user_id: req.user._id },
      { account_holder_name, account_number, ifsc_code, bank_name },
      { upsert: true, new: true }
    );
    res.json({ success: true, bank: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

userRouter.put("/updateKyc", async (req, res) => {
  try {
    const { aadhaar_number, pan_number } = req.body;
    const updated = await UserKYC.findOneAndUpdate(
      { user_id: req.user._id },
      { aadhaar_number, pan_number },
      { upsert: true, new: true }
    );
    res.json({ success: true, kyc: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

userRouter.put("/updateNominee", async (req, res) => {
  try {
    const { nominee_name, relationship, mobile } = req.body;
    const updated = await UserNominee.findOneAndUpdate(
      { user_id: req.user._id },
      { nominee_name, relationship, mobile },
      { upsert: true, new: true }
    );
    res.json({ success: true, nominee: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = userRouter;
