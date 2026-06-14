const mongoose = require("mongoose");
const { model } = mongoose;

const adsSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      required: true,
    },
    redirectUrl: {
      type: String,
      default: "",
    },
    rank: {
      type: Number,
      required: true,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

const AdsModel = model("Ads", adsSchema);

module.exports = AdsModel;
