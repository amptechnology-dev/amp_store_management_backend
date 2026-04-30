const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      uppercase: true,
    },
    images: [
      {
        type: String
      }
    ],
    description: {
      type: String,
      required: [true, "Product description is required"],
      trim: true,
      uppercase: true,
    },
    sellingPrice: {
      type: Number,
      required: [true, "Selling price is required"],
      min: [0, "Selling price must be >= 0"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified:{
      type: Boolean,
      default: false,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    userId:{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }
  },
  { timestamps: true }
);

const ProductModel = mongoose.model("Product", productSchema);

module.exports = ProductModel;