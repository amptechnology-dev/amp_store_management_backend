const mongoose = require("mongoose");
const { model } = mongoose;

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },

    phone: { type: String },

    password: {
        type: String,
        required: true
    },

    role: {
        type: String,
        enum: ["ADMIN", "STORE"],
        default: "ADMIN"
    },

    isActive: {
        type: Boolean,
        default: true
    },

}, { timestamps: true });

const UserModel = model("User", userSchema);

module.exports = UserModel;