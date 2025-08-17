const User = require("../../models/Users/User.js");
const { Transaction } = require("../../models/Users/UserTransaction.js");

const mongoose = require("mongoose");
const handleTransactionAbort = require("../../utils/handleTransactionError.js"); // adjust path accordingly

const Pincode = require("../../models/PincodeSchema.js");

const express = require("express");
const router = express.Router();
const {
  loginAdmin,
  getAdminProfile,
  getAllOrders,
} = require("../../controllers/admin.controller.js");
const { authMiddleware } = require("../../middleware/auth.middleware.js");
const dashboard = require("../../controllers/admin.controller.js");
const txnCtrl = require("../../controllers/admin.controller.js");

const { checkRole } = require("../../middleware/roles.middleware.js");
const UserWalletRequest = require("../../models/Users/UserWalletRequest.js");
const UserWalletTransaction = require("../../models/Users/UserWalletTransaction.js");
router.use(authMiddleware, checkRole("admin")); // Protect entire admin route

router.get("/profile", getAdminProfile);
router.get("/order", getAllOrders);
router.get("/allusers", async (req, res) => {
  try {
    // 1. Fetch users (basic details)
    const users = await User.find(
      {},
      {
        username: 1,
        deactivate_reason : 1,
        is_Deactive : 1,
        full_name: 1,
        email: 1,
        mobile: 1,
        country_id: 1,
        crt_date: 1,
        is_active: 1,
        wallet_balance: 1,
        referred_by: 1,
        Activated_with: 1,
        direct_sponsor_income: 1,
        fighter_income: 1,
        matching_income: 1,
        income_logs: 1,
        my_mlm_network: 1,
      }
    )
      .populate("referred_by", "username full_name email") // show sponsor details
      .sort({ crt_date: -1 });

    // 2. Fetch all successful transactions
    const transactions = await Transaction.find({ status: "Success" }).sort({
      created_at: 1,
    });

    // Maps for quick lookup
    const firstTransactionMap = {};
    const userTransactions = {};
    const userPackageSums = {};
    let totalPackageSell = 0;

    for (const txn of transactions) {
      const userId = txn.user_id.toString();
      const amount = parseFloat(txn.package_amount?.toString() || "0");

      // Store transactions by user
      if (!userTransactions[userId]) userTransactions[userId] = [];
      userTransactions[userId].push(txn);

      // Sum packages
      userPackageSums[userId] = (userPackageSums[userId] || 0) + amount;
      totalPackageSell += amount;

      // Store first (oldest) transaction
      if (!firstTransactionMap[userId]) {
        firstTransactionMap[userId] = txn;
      }
    }
    console.log(users);
    

    // 3. Prepare response data
    const userData = users.map((user) => {
      const userId = user._id.toString();
      return {
        userId,
        deactivate_reason : user.deactivate_reason,
        is_Deactive : user.is_Deactive,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        mobile: user.mobile,
        country: user.country_id,
        joined_at: user.crt_date,
        active: user.is_active,
        balance: user.wallet_balance,
        referred_by: user.referred_by || null, // populated object
        activated_with: user.Activated_with || null,
        activated_amount: userPackageSums[userId] || 0,
        first_transaction: firstTransactionMap[userId] || null,
        transactions: userTransactions[userId] || [],
        incomes: {
          direct: user.direct_sponsor_income,
          fighter: user.fighter_income,
          matching: user.matching_income,
        },
        income_logs: user.income_logs || [],
        my_mlm_network: user.my_mlm_network || [],
      };
    });

    // 4. Final response
    return res.json({
      total_package_sell: totalPackageSell,
      withdrawals: 0, // (you can later add Withdrawal schema here)
      data: userData,
    });
  } catch (err) {
    console.error("User list error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});


// ✅ Update user by ID
router.put("/users/:id", authMiddleware, async (req, res) => {
  try {
    const updates = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


router.get("/users/:id", authMiddleware, async (req, res) => {

  console.log(req.params.id);
  
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});



router.post("/activate", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();


  try {
    const {MyuserId, Other_userId, quantity, name, mrp, dp, bv } = req.body;

    // 1. Fetch current user (activator)
    
    const user = await User.findById(MyuserId).session(session);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.wallet_balance <= 0) return res.status(400).json({ error: "Wallet is empty" });

    // 2. Fetch user to activate

    const Other_user = await User.findOne({ _id: Other_userId }).session(
      session
    );
    if (!Other_user)
      return res.status(404).json({ error: "User not found for activation!" });
    if (Other_user.is_active)
      return res.status(400).json({ error: "User is already activated!" });

    // 3. Calculate package total
    const packageAmount = quantity * parseFloat(dp);

    if (user.wallet_balance < packageAmount) {
      return res.status(400).json({
        error:
          "Insufficient wallet balance. Please add funds to your wallet to complete the purchase.",
      });
    }

    // 4. Activate user and store product info
    Other_user.is_active = true;
    Other_user.Activated_with = {
      product_name: name,
      product_mrp: parseFloat(mrp),
      product_dp: parseFloat(dp),
      product_bv: parseFloat(bv),
      total_activated_amount: packageAmount,
    };

    await Other_user.save({ session });

    // 5. Update matching Transaction for this user
    const generatedPaymentRef = `TXN_${Date.now()}_${Math.floor(
      Math.random() * 10000
    )}`;
    // OR use UUID: const generatedPaymentRef = uuidv4();

    const transaction = await Transaction.create(
      [
        {
          user_id: Other_user._id,
          payment_ref: generatedPaymentRef,
          dp: mongoose.Types.Decimal128.fromString(String(dp)),
          bv: mongoose.Types.Decimal128.fromString(String(bv)),
          package_amount: mongoose.Types.Decimal128.fromString(
            String(packageAmount)
          ),
          status: "Success",
        },
      ],
      { session }
    );

    // 6. Find Sponsor
    const sponsor = await User.findOne({
      MYsponsor_id: user.other_sponsor_id,
    }).session(session);

    if (sponsor) {
      let sponsorChanged = false;

      // A. Direct Sponsor Income - 10%
      const directIncome = packageAmount * 0.1;
      sponsor.wallet_balance += directIncome;
      sponsor.direct_sponsor_income += directIncome;
      sponsor.income_logs.push({
        type: "Direct",
        amount: directIncome,
        from_user: user._id,
        created_at: new Date(),
      });
      sponsorChanged = true;

      // B. Fighter Income - 5%
      // if (sponsor.left_user && sponsor.right_user) {
      //   const fighterIncome = packageAmount * 0.05;
      //   sponsor.wallet_balance += fighterIncome;
      //   sponsor.fighter_income += fighterIncome;
      //   sponsor.income_logs.push({
      //     type: "Fighter",
      //     amount: fighterIncome,
      //     from_user: user._id,
      //     created_at: new Date(),
      //   });
      //   sponsorChanged = true;
      // }

      // ✅ Apply Fighter Income Now if `fighter_user_id` Provided
      if (Other_user.fighter_user_id) {
        const fighter = await User.findOne({
          username: Other_user.fighter_user_id,
        }).session(session);
        if (fighter) {
          const fighterIncome = packageAmount * 0.05;
          fighter.wallet_balance =
            parseInt(fighter.wallet_balance ?? 0) + parseInt(fighterIncome);
          fighter.fighter_income =
            parseInt(fighter.fighter_income ?? 0) + parseInt(fighterIncome);

          console.log(fighter);

          fighter.income_logs.push({
            type: "Fighter",
            amount: fighterIncome,
            from_user: user._id,
          });

          await fighter.save({ session });
        }
      }

      // C. Add BV to left or right leg
      const side =
        String(sponsor.left_user) === String(user._id) ? "left_bv" : "right_bv";
      sponsor[side] = (sponsor[side] || 0) + parseFloat(bv);
      sponsorChanged = true;

      // D. Matching Income - 30% of minimum BV side
      const pairBV = Math.min(sponsor.left_bv, sponsor.right_bv);
      if (pairBV > 0) {
        const incomePerBV = 10; // 1 BV = ₹10
        const matchIncome = pairBV * incomePerBV * 0.3;

        sponsor.wallet_balance += matchIncome;
        sponsor.matching_income += matchIncome;
        sponsor.left_bv -= pairBV;
        sponsor.right_bv -= pairBV;

        sponsor.income_logs.push({
          type: "Matching",
          amount: matchIncome,
          from_user: user._id,
          created_at: new Date(),
        });

        sponsorChanged = true;
      }

      // Save if sponsor got any updates
      if (sponsorChanged) await sponsor.save({ session });
    }

    user.wallet_balance = user.wallet_balance - packageAmount;

    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json({
      success: true,
      message: "User activated and incomes distributed successfully.",
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error("Activation Error:", err);
    return res.status(500).json({ error: `Activation Error: ${err.message}` });
  }
});


router.post("/deactivate", async (req, res) => {
  try {
    const { userId, reason } = req.body;

    if (!userId || !reason) {
      return res.status(400).json({ message: "User ID and reason are required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

         if (!user.is_active) {
      return res.status(400).json({ message: "ID is Not Activated yet!! Please Purchase Product to Activate ID" });
    }


    if (user.is_Deactive) {
      return res.status(400).json({ message: "User already deactivated" });
    }


    user.is_Deactive = true;
    user.deactivate_reason = reason;
    user.is_active = false; // optional: mark inactive
    await user.save();

    return res.json({ success: true, message: "User deactivated successfully" });
  } catch (error) {
    console.error("Deactivate error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


router.post("/resume", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    
         if (!user.is_active) {
      return res.status(400).json({ message: "ID is Not Activated yet!! Please Purchase Product to Activate ID" });
    }

    if (!user.is_Deactive) {
      return res.status(400).json({ message: "User is not deactivated" });
    }

    user.is_Deactive = false;
    user.deactivate_reason = "";
    user.is_active = true;
    await user.save();

    return res.json({ success: true, message: "User resumed successfully" });
  } catch (error) {
    console.error("Resume error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});






router.post("/generate-pincode", async (req, res) => {
  const { username, pincode, status } = req.body;

  if (!username || !pincode) {
    return res
      .status(400)
      .json({ message: "Username and pincode are required" });
  }

  try {
    const existing = await Pincode.findOne({ pincode });

    if (existing) {
      return res.status(409).json({ message: "Pincode already exists" });
    }

    const newPincode = new Pincode({ username, pincode, status });
    await newPincode.save();

    res
      .status(201)
      .json({ message: "Pincode generated successfully", data: newPincode });
  } catch (error) {
    console.error("Error generating pincode:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all pincodes
router.get("/pincodes", async (req, res) => {
  try {
    const pincodes = await Pincode.find().sort({ createdAt: -1 }); // Optional: Sort by latest
    res.status(200).json({ success: true, data: pincodes });
  } catch (error) {
    console.error("Error fetching pincodes:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching pincodes",
    });
  }
});

// routes/admin.js
router.patch("/user/:id/status", async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  try {
    await User.updateOne({ _id: id }, { $set: { is_active } });
    console.log(is_active);

    res.json({
      success: true,
      message: `User ${is_active ? "activated" : "deactivated"}`,
      _id: id,
      is_active,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to update user status",
      error: err,
    });
  }
});

router.get("/total-users", dashboard.getTotalUsers);
router.get("/active-users", dashboard.getActiveUsers);
router.get("/total-income", dashboard.getTotalIncome);
router.get("/recent-signups", dashboard.getRecentSignups);
router.get("/top-earners", dashboard.getTopEarners);
router.get("/income-summary", dashboard.getIncomeSummary);
router.get("/bv-stats", dashboard.getBusinessVolumeStats);
router.get("/tree/:userId", dashboard.getTreeDataForUser); // optional

router.get("/allTxn", txnCtrl.getAllTransactions);
router.get("/total-volume", txnCtrl.getTotalTransactionVolume);
router.get("/recent", txnCtrl.getRecentTransactions);
router.get("/stats", txnCtrl.getTransactionStats);







// fund

// Admin Fund Requests View API
router.get("/all-fundRequests", async (req, res) => {
  try {
    // Optional: Check if the user is admin
    // if (!req.user.isAdmin) return res.status(403).json({ message: "Access denied" });

    const requests = await UserWalletRequest.find()
      .populate("user", "username full_name email mobile") // populate basic user info
      .sort({ requested_at: -1 }); // latest first

    res.status(200).json({
      message: "All wallet fund requests fetched successfully.",
      total: requests.length,
      requests,
    });
  } catch (error) {
    console.error("Admin fund request fetch error:", error);
    res.status(500).json({ message: "Server error" });
  }
});



// Approve or Reject Fund Request
// Approve or Reject Fund Request
router.patch("/update-fundRequest/:id", async (req, res) => {
  const { id } = req.params;
  const { status, approved_by = "Admin" } = req.body;

  if (!["Approved", "Rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid status value" });
  }

  try {
    const fundRequest = await UserWalletRequest.findById(id).populate("user");

    if (!fundRequest) {
      return res.status(404).json({ message: "Fund request not found" });
    }

    if (fundRequest.status !== "Pending") {
      return res.status(400).json({ message: "Request already processed" });
    }

    fundRequest.status = status;
    fundRequest.approved_by = approved_by;
    fundRequest.approved_at = new Date();

    await fundRequest.save();

    if (status === "Approved") {
      // Create transaction
      const transaction = await UserWalletTransaction.create({
        user_id: fundRequest.user._id,
        type: "AdminCredit",
        amount: fundRequest.amount,
        note: "Admin approved wallet fund request",
        created_at: new Date(),
      });

      // Add balance to user wallet
      fundRequest.user.wallet_balance += fundRequest.amount;
      await fundRequest.user.save(); // Save the updated user balance

      console.log("Wallet transaction created:", transaction);
    }

    return res.status(200).json({
      message: `Request ${status.toLowerCase()} successfully`,
      request: fundRequest,
    });
  } catch (error) {
    console.error("Update fund request error:", error.message);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});



router.post("/addbalance", async (req, res) => {
  try {
    const { userId, amount, note = "Admin balance top-up" } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ message: "User ID and amount are required" });
    }

    if (amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    // 1. Find user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // 2. Add balance
    user.wallet_balance = parseFloat(user.wallet_balance || 0) + parseFloat(amount);

    // 3. Save user
    await user.save();

    // 4. Create wallet transaction record
    const transaction = await UserWalletTransaction.create({
      user_id: user._id,
      type: "AdminCredit",
      amount: amount, // always positive here
      note,
      created_at: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: `₹${amount} added to ${user.username}'s wallet`,
      balance: user.wallet_balance,
      transaction,
    });
  } catch (error) {
    console.error("Add balance error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add balance",
      error: error.message,
    });
  }
});









module.exports = router;
