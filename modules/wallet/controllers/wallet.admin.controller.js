import mongoose from "mongoose";
import express from 'express';
import { User } from "../../../models/User.js";
import { Transaction } from "../../../models/Transaction.js";
import { Artist } from "../../../models/Artist.js";

export const getAllUserTransactions = async (req, res) => {
  try {
    const { userId } = req.params;

  } catch (error) {

  }
}

export const getAllArtistTransactions = async (req, res) => {
  try {
    const { artistId } = req.params;

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit) || 20)
    );

    if (!mongoose.isValidObjectId(artistId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid artist ID",
      });
    }

    const artist = await Artist.findById(artistId);

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found",
      });
    }

    // IMPORTANT: Verify the authenticated user owns this artist
    // or has an authorized admin role before proceeding.
    // Replace this with your project's authorization middleware.

    const wallet = await Wallet.findOne({ artistId });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Artist wallet not found",
      });
    }

    const skip = (page - 1) * limit;

    const [transactions, totalTransactions] = await Promise.all([
      WalletTransaction.find({ walletId: wallet._id })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      WalletTransaction.countDocuments({
        walletId: wallet._id,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Transactions fetched successfully",
      data: {
        transactions,
        pagination: {
          page,
          limit,
          totalTransactions,
          totalPages: Math.ceil(totalTransactions / limit),
          hasNextPage: page * limit < totalTransactions,
        },
      },
    });
  } catch (error) {
    console.error("Get artist transactions error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getArtistBalance = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Assumption: Artist.userId references User._id
    const artist = await Artist.findOne({
      userId: user._id,
    });

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist profile not found",
      });
    }

    const wallet = await Wallet.findOne({
      artistId: artist._id,
    }).lean();

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Wallet balance fetched successfully",
      data: {
        artistId: artist._id,
        walletId: wallet._id,
        balance: wallet.balance,
        currency: wallet.currency,
      },
    });
  } catch (error) {
    console.error("Get artist balance error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getBlanceSnapshot = async (req, res) => {
  try {
    const { artistId } = req.body;
    if (!artistId)
      return res.status(400).json({ success: false, message: "Artist id is required", status: 400 });

    const wallet = await Wallet.findOne({ artistId }).lean();

    if (!wallet) return res.status(404).json({ success: false, message: "Wallet not found", status: 404 });

    const recentTransactions = await WalletTransaction.find({ walletId: wallet._id })
      .sort({ createdAt: -1, _id: -1 })
      .limit(10)
      .lean();

    const balanceHistory = await WalletBalanceSnapshot.find({ walletId: wallet._id })
      .sort({ date: -1, _id: -1 })
      .limit(10)
      .lean();

    return res.status(200).json({
      success: true,
      message: "Balance snapshot fetched successfully",
      data: {
        walletId: wallet._id,
        artistId: wallet.artistId,
        balance: wallet.balance,
        currency: wallet.currency,
        recentTransactions,
        balanceHistory,
      },
    });

  }
  catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error", status: 500 });
  }
}

export const withdrawRequest = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ artistId: req.body.artistId });

    if (!wallet) {
      return res.status(400).json({ success: false, messsage: "Wallet not found" })
    }
  }
  catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error", status: 500 });
  }
}