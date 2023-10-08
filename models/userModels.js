const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      index: true,
      unique: true,
      sparse: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    avatar: {
      type: String,
      default: "",
    },
    role: {
      type: Number,
      default: 0, // 0= user, 1 = admin
    },
    type: {
      type: String,
      default: "register", // login
    },
    rf_token: { type: String, select: false },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
