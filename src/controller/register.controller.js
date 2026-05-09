const mongoose = require("mongoose");
const UserModel = require("../model/user.model.js")
const StoreModel = require("../model/store.model.js")
const StoreViewModel = require("../model/StoreViewModel.js");
const ProductModel = require("../model/product.model.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { passwordGenerator } = require("../helper/PasswordGenerator.js")
const { createUserSchema, updateUserSchema } = require("../schema/user.schema.js");
const uploadSingleImage = require("../helper/upload.js");
const sendPasswordEmail = require("../helper/mail.service.js")
const sendStoreVerifyEmail = require("../helper/sendStoreVerifyEmail");
const { sendPasswordSMS } = require("../helper/sendPasswordSMS.js");
const sendEmailVerificationOTP = require('../helper/sendEmailVerificationOTP.js');
const EmailVerifyModel = require('../model/otpverify.js')


const registerAdmin = async (req, res) => {
  try {
    const parsedData = createUserSchema.parse(req.body);

    const existingEmail = await UserModel.findOne({ email: parsedData.email });
    if (existingEmail) {
      return res.status(409).json({
        message: "Email already in use",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(parsedData.password, salt);

    const user = new UserModel({
      ...parsedData,
      password: hashedPassword
    });

    await user.save();

    const userId = user._id; // ⭐ newly created user id

    await sendPasswordEmail(parsedData.email, parsedData.password);
    // await sendPasswordSMS(parsedData.phone, parsedData.email, parsedData.password);

    const defaultHeads = [
      {
        userId: userId,
        name: "Fuel Purchase",
        type: "EXPENSE"
      },
      {
        userId: userId,
        name: "Fuel Sales",
        type: "INCOME"
      },
      {
        userId: userId,
        name: "Accessory Expenses",
        type: "EXPENSE"
      },
      {
        userId: userId,
        name: "Accessory Sales",
        type: "INCOME"
      }
    ];

    // Check existing heads to avoid duplicates
    const existingHeads = await AccountHead.find({
      userId: userId,
      name: { $in: defaultHeads.map(h => h.name) }
    });

    const existingNames = existingHeads.map(h => h.name);

    const headsToInsert = defaultHeads.filter(
      head => !existingNames.includes(head.name)
    );

    if (headsToInsert.length > 0) {
      await AccountHead.insertMany(headsToInsert);
    }

    return res.status(201).json({
      message: "Petrol Pump registered successfully",
      user
    });

  } catch (error) {

    if (error.code === 11000 && error.keyPattern?.email) {
      return res.status(409).json({
        message: "Email already in use",
      });
    }

    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
    }

    console.error("Admin registration error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const registerOwner = async (req, res) => {
  try {
    const parsedData = createUserSchema.parse(req.body);
    const existingEmail = await UserModel.findOne({ email: parsedData.email });
    if (existingEmail) {
      return res.status(409).json({
        message: "Email already in use",
      });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(parsedData.password, salt);
    const user = new UserModel({
      ...parsedData,
      password: hashedPassword,
      role: "STORE"
    });
    await user.save();
    const userId = user._id;
    sendEmailVerificationOTP(req, user)
    return res.status(201).json({
      message: "Store owner registered and verification email sent successfully !",
      user
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.email) {
      return res.status(409).json({
        message: "Email already in use",
      });
    }
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
    }
    console.error("Store owner registration error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const verifyEmailOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ status: false, message: "All fields are required" });
    }
    const existingUser = await UserModel.findOne({ email });
    if (!existingUser) {
      return res.status(404).json({ status: "failed", message: "Email doesn't exists" });
    }
    if (existingUser.isVerified) {
      return res.status(400).json({ status: false, message: "Email is already verified" });
    }
    const emailVerification = await EmailVerifyModel.findOne({ userId: existingUser._id, otp });
    if (!emailVerification) {
      if (!existingUser.isVerified) {
        await sendEmailVerificationOTP(req, existingUser);
        return res.status(400).json({ status: false, message: "Invalid OTP, new OTP sent to your email" });
      }
      return res.status(400).json({ status: false, message: "Invalid OTP" });
    }
    const currentTime = new Date();
    const expirationTime = new Date(emailVerification.createdAt.getTime() + 15 * 60 * 1000);
    if (currentTime > expirationTime) {
      await sendEmailVerificationOTP(req, existingUser);
      return res.status(400).json({ status: "failed", message: "OTP expired, new OTP sent to your email" });
    }
    existingUser.isVerified = true;
    await existingUser.save();
    await EmailVerifyModel.deleteMany({ userId: existingUser._id });
    return res.status(200).json({ status: true, message: "Email verified successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Unable to verify email, please try again later" });
  }
}

// Register Store Owner with Store Details
const registerStoreOwner = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      storeName,
      storeType,
      description,
      contactNo,
      whatsappNo,
      website,
      gstin,
      lat,
      long
    } = req.body;

    const existingUser = await UserModel.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists with this email"
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password.trim(), salt);

    const user = await UserModel.create({
      name: name?.trim(),
      email: email?.trim(),
      phone: phone?.trim(),
      password: hashedPassword,
      role: "STORE"
    });

    /* IMAGE UPLOAD */

    let images = [];

    if (req.files?.length) {
      for (const file of req.files) {
        if (file.fieldname.startsWith("image")) {
          const url = await uploadSingleImage(file);
          images.push(url);
        }
      }
    }

    const store = await StoreModel.create({

      storeName: storeName?.trim(),
      storeType: storeType?.trim(),
      description: description?.trim(),

      contactNo: contactNo?.trim(),
      whatsappNo: whatsappNo?.trim(),

      email: email?.trim(),
      website: website?.trim(),

      gstin: gstin?.trim(),

      lat: Number(lat),
      long: Number(long),

      images,

      address: {
        area: req.body?.address?.area,
        state: req.body?.address?.state,
        country: req.body?.address?.country
      },

      timing: {
        open: req.body?.timing?.open,
        close: req.body?.timing?.close
      },

      timingByDay: {
        sunday: req.body?.timingByDay?.sunday,
        monday: req.body?.timingByDay?.monday,
        tuesday: req.body?.timingByDay?.tuesday,
        wednesday: req.body?.timingByDay?.wednesday,
        thursday: req.body?.timingByDay?.thursday,
        friday: req.body?.timingByDay?.friday,
        saturday: req.body?.timingByDay?.saturday
      },

      imageSeo: req.body.imageSeo,

      userId: user._id

    });

    await sendPasswordEmail(req.body.email, req.body.password);

    return res.status(201).json({
      message: "Your store registration is successful. Please wait for admin verification.",
      user: {
        ...user.toObject(),
        password: undefined
      },
      store
    });

  } catch (error) {

    console.error("User creation error:", error);

    return res.status(500).json({
      message: "Internal server error"
    });

  }
};

// We create Store Store owner 
const createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      storeName,
      storeType,
      description,
      contactNo,
      whatsappNo,
      website,
      gstin,
      lat,
      long,
    } = req.body;

    const existingUser = await UserModel.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists with this email"
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password.trim(), salt);

    const user = await UserModel.create({
      name: name?.trim(),
      email: email?.trim(),
      phone: phone?.trim(),
      password: hashedPassword,
      role: "STORE"
    });

    /* IMAGE UPLOAD */

    let images = [];

    if (req.files?.length) {
      for (const file of req.files) {
        if (file.fieldname.startsWith("image")) {
          const url = await uploadSingleImage(file);
          images.push(url);
        }
      }
    }

    const store = await StoreModel.create({

      storeName: storeName?.trim(),
      storeType: storeType?.trim(),
      description: description?.trim(),

      contactNo: contactNo?.trim(),
      whatsappNo: whatsappNo?.trim(),

      email: email?.trim(),
      website: website?.trim(),

      gstin: gstin?.trim(),

      lat: Number(lat),
      long: Number(long),

      images,

      address: {
        area: req.body?.address?.area,
        state: req.body?.address?.state,
        country: req.body?.address?.country
      },

      timing: {
        open: req.body?.timing?.open,
        close: req.body?.timing?.close
      },

      timingByDay: {
        sunday: req.body?.timingByDay?.sunday,
        monday: req.body?.timingByDay?.monday,
        tuesday: req.body?.timingByDay?.tuesday,
        wednesday: req.body?.timingByDay?.wednesday,
        thursday: req.body?.timingByDay?.thursday,
        friday: req.body?.timingByDay?.friday,
        saturday: req.body?.timingByDay?.saturday
      },

      imageSeo: req.body.imageSeo,

      userId: user._id,
      isVerify: true,

    });

    return res.status(201).json({
      message: "User and store created successfully",
      user: {
        ...user.toObject(),
        password: undefined
      },
      store
    });

  } catch (error) {

    console.error("User creation error:", error);

    return res.status(500).json({
      message: "Internal server error"
    });

  }
};

const createStore = async (req, res) => {
  try {
    const {
      storeName,
      storeType,
      description,
      contactNo,
      whatsappNo,
      website,
      gstin,
      lat,
      long,
    } = req.body;

    const userId = req.user.id;

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    let images = [];

    if (req.files?.length) {
      for (const file of req.files) {
        if (file.fieldname.startsWith("image")) {
          const url = await uploadSingleImage(file);
          images.push(url);
        }
      }
    }

    const store = await StoreModel.create({
      storeName: storeName?.trim(),
      storeType: storeType?.trim(),
      description: description?.trim(),

      contactNo: contactNo?.trim(),
      whatsappNo: whatsappNo?.trim(),

      email: user.email,
      website: website?.trim(),

      gstin: gstin?.trim(),

      lat: Number(lat),
      long: Number(long),

      images,

      address: {
        area: req.body?.address?.area,
        state: req.body?.address?.state,
        country: req.body?.address?.country
      },

      timing: {
        open: req.body?.timing?.open,
        close: req.body?.timing?.close
      },

      timingByDay: {
        sunday: req.body?.timingByDay?.sunday,
        monday: req.body?.timingByDay?.monday,
        tuesday: req.body?.timingByDay?.tuesday,
        wednesday: req.body?.timingByDay?.wednesday,
        thursday: req.body?.timingByDay?.thursday,
        friday: req.body?.timingByDay?.friday,
        saturday: req.body?.timingByDay?.saturday
      },

      imageSeo: req.body.imageSeo,

      userId: userId,

      isVerify: false
    });

    return res.status(201).json({
      message: "Store created successfully",
      store
    });

  } catch (error) {
    console.error("Store creation error:", error);

    return res.status(500).json({
      message: "Internal server error"
    });
  }
};


const allStores = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || parseInt(process.env.DEFAULT_PAGE_SIZE) || 10;
    const search = req.query.search || "";

    const skip = (page - 1) * limit;

    const pipeline = [
      {
        $match: {
          storeName: { $regex: search, $options: "i" }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "owner"
        }
      },

      {
        $unwind: {
          path: "$owner",
          preserveNullAndEmptyArrays: true
        }
      },

      {
        $addFields: {
          ownerName: "$owner.name",
          ownerEmail: "$owner.email",
          ownerPhone: "$owner.phone"
        }
      },

      {
        $project: {
          owner: 0
        }
      },

      {
        $sort: { createdAt: -1 }
      },

      {
        $skip: skip
      },

      {
        $limit: limit
      }
    ];

    const stores = await StoreModel.aggregate(pipeline);

    const totalStores = await StoreModel.countDocuments({
      storeName: { $regex: search, $options: "i" }
    });

    const totalPages = Math.ceil(totalStores / limit);

    return res.status(200).json({
      page,
      totalPages,
      totalStores,
      stores
    });

  } catch (error) {
    console.error("Error fetching stores:", error);

    return res.status(500).json({
      message: "Internal server error"
    });
  }
};


const singleStore = async (req, res) => {
  try {
    const storeId = req.params.storeId;

    const store = await StoreModel.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(storeId)
        }
      },

      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "owner"
        }
      },

      {
        $unwind: "$owner"
      },

      {
        $project: {
          storeName: 1,
          storeType: 1,
          storeUniqueId: 1,
          description: 1,
          images: 1,
          contactNo: 1,
          whatsappNo: 1,
          website: 1,
          gstin: 1,
          lat: 1,
          long: 1,
          address: 1,
          timing: 1,
          timingByDay: 1,
          imageSeo: 1,
          reviews: 1,
          createdAt: 1,
          isVerify: 1,
          isActive: 1,

          owner: {
            _id: "$owner._id",
            name: "$owner.name",
            email: "$owner.email",
            phone: "$owner.phone"
          }
        }
      }
    ]);

    if (!store.length) {
      return res.status(404).json({
        message: "Store not found"
      });
    }

    return res.status(200).json({
      store: store[0]
    });

  } catch (error) {
    console.error("Error fetching store:", error);

    return res.status(500).json({
      message: "Internal server error"
    });
  }
};

const updateStoreAndUser = async (req, res) => {
  try {

    const { storeId } = req.params;

    const store = await StoreModel.findById(storeId);

    if (!store) {
      return res.status(404).json({
        message: "Store not found"
      });
    }

    const user = await UserModel.findById(store.userId);

    /* PASSWORD UPDATE */

    let password = user.password;

    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      password = await bcrypt.hash(req.body.password.trim(), salt);
    }

    await UserModel.findByIdAndUpdate(user._id, {
      name: req.body.name || user.name,
      email: req.body.email || user.email,
      phone: req.body.phone || user.phone,
      password
    });

    /* ==============================
       🖼 IMAGE HANDLE (IMPORTANT FIX)
    ============================== */

    let images = [];

    // 1️⃣ If client sends existing images list (remaining images)
    if (req.body.images) {
      if (Array.isArray(req.body.images)) {
        images = req.body.images;
      } else {
        images = [req.body.images];
      }
    }

    // 2️⃣ Upload new images & add
    if (req.files?.length) {
      for (const file of req.files) {
        if (file.fieldname.startsWith("image")) {
          const url = await uploadSingleImage(file);
          images.push(url);
        }
      }
    }

    // 3️⃣ If nothing sent → keep old images
    if (!req.body.images && !req.files?.length) {
      images = store.images;
    }

    /* ============================== */

    const updatedStore = await StoreModel.findByIdAndUpdate(
      storeId,
      {

        storeName: req.body.storeName || store.storeName,
        storeType: req.body.storeType || store.storeType,
        description: req.body.description || store.description,

        contactNo: req.body.contactNo || store.contactNo,
        whatsappNo: req.body.whatsappNo || store.whatsappNo,

        website: req.body.website || store.website,
        gstin: req.body.gstin || store.gstin,

        lat: req.body.lat ? Number(req.body.lat) : store.lat,
        long: req.body.long ? Number(req.body.long) : store.long,

        images,

        address: {
          area: req.body?.address?.area || store.address?.area,
          state: req.body?.address?.state || store.address?.state,
          country: req.body?.address?.country || store.address?.country
        },

        timing: {
          open: req.body?.timing?.open || store.timing?.open,
          close: req.body?.timing?.close || store.timing?.close
        },

        timingByDay: {
          sunday: req.body?.timingByDay?.sunday || store.timingByDay?.sunday,
          monday: req.body?.timingByDay?.monday || store.timingByDay?.monday,
          tuesday: req.body?.timingByDay?.tuesday || store.timingByDay?.tuesday,
          wednesday: req.body?.timingByDay?.wednesday || store.timingByDay?.wednesday,
          thursday: req.body?.timingByDay?.thursday || store.timingByDay?.thursday,
          friday: req.body?.timingByDay?.friday || store.timingByDay?.friday,
          saturday: req.body?.timingByDay?.saturday || store.timingByDay?.saturday
        },

        imageSeo: req.body.imageSeo || store.imageSeo,

        isVerify: req.body.isVerify ?? store.isVerify,
        isActive: req.body.isActive ?? store.isActive

      },
      { new: true }
    );

    return res.status(200).json({
      message: "User and store updated successfully",
      store: updatedStore
    });

  } catch (error) {

    console.error("Update error:", error);

    return res.status(500).json({
      message: "Internal server error"
    });

  }
};

const deleteStoreAndUser = async (req, res) => {
  try {

    const { storeId } = req.params;

    const store = await StoreModel.findById(storeId);

    if (!store) {
      return res.status(404).json({
        message: "Store not found"
      });
    }

    const userId = store.userId;

    /* DELETE STORE */

    await StoreModel.findByIdAndDelete(storeId);

    /* DELETE USER */

    await UserModel.findByIdAndDelete(userId);

    return res.status(200).json({
      message: "Store and related user deleted successfully"
    });

  } catch (error) {

    console.error("Delete error:", error);

    return res.status(500).json({
      message: "Internal server error"
    });

  }
};

const userBasedStores = async (req, res) => {
  try {

    const userId = req.user._id || req.user.id;

    const stores = await StoreModel.find({
      userId: userId
    })
      .populate({
        path: "userId",
        select: "name email phone"
      })
      .sort({ createdAt: -1 });

    const totalStores = stores.length;

    return res.status(200).json({
      totalStores,
      stores
    });

  } catch (error) {

    console.error("Error fetching stores:", error);

    return res.status(500).json({
      message: "Internal server error"
    });

  }
};

const publicAllStores = async (req, res) => {
  try {

    const search = req.query.search || "";

    const stores = await StoreModel.find({
      $and: [
        { isVerify: true },
        { isActive: true },
        {
          $or: [
            { storeName: { $regex: search, $options: "i" } },
            { "address.area": { $regex: search, $options: "i" } },
            { "address.state": { $regex: search, $options: "i" } },
            { "address.country": { $regex: search, $options: "i" } }
          ]
        }
      ]
    })
      .populate({
        path: "userId",
        select: "name email phone"
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      totalStores: stores.length,
      stores
    });

  } catch (error) {

    console.error("Error fetching public stores:", error);

    return res.status(500).json({
      message: "Internal server error"
    });

  }
};

const storeWithProducts = async (req, res) => {

  try {

    const { storeId } = req.params;

    if (
      req.user &&
      req.user.role === "USER"
    ) {

      const existingView =
        await StoreViewModel.findOne({
          storeId,
          userId: req.user.id
        });

      if (!existingView) {

        await StoreViewModel.create({
          storeId,
          userId: req.user.id
        });

        await StoreModel.findByIdAndUpdate(
          storeId,
          {
            $inc: {
              viewCount: 1
            }
          }
        );

      }

    }

    const store = await StoreModel.findById(
      storeId
    ).populate({
      path: "userId",
      select: "name email phone"
    });

    if (!store) {

      return res.status(404).json({
        message: "Store not found"
      });

    }

    const products =
      await ProductModel.find({
        storeId: storeId,
        isActive: true,
        isVerified: true
      }).sort({
        createdAt: -1
      });

    return res.status(200).json({

      store,

      totalProducts:
        products.length,

      products

    });

  } catch (error) {

    console.error(
      "Error fetching store with products:",
      error
    );

    return res.status(500).json({
      message:
        "Internal server error"
    });

  }

};

const verifyStoreStatus = async (req, res) => {
  try {

    const { storeId } = req.params;
    const { isVerify } = req.body;

    if (!storeId) {
      return res.status(400).json({
        message: "Store ID is required"
      });
    }

    /* ============================
       GET STORE
    ============================ */
    const store = await StoreModel.findById(storeId);

    if (!store) {
      return res.status(404).json({
        message: "Store not found"
      });
    }

    /* ============================
       UPDATE VERIFY STATUS
    ============================ */
    store.isVerify = isVerify;
    await store.save();

    /* ============================
       GET USER (OWNER)
    ============================ */
    const user = await UserModel.findById(store.userId);

    /* ============================
       SEND MAIL ONLY IF VERIFIED
    ============================ */
    if (isVerify && user?.email) {
      await sendStoreVerifyEmail(
        user.email,
        store.storeName,
        store.storeUniqueId
      );
    }

    return res.status(200).json({
      success: true,
      message:
        "Store is " +
        (isVerify ? "verified" : "not verified") +
        " successfully"
    });

  } catch (error) {

    console.error("Store verify error:", error);

    return res.status(500).json({
      message: "Internal server error"
    });

  }
};

const updateStoreFeatured = async (req, res) => {
  try {

    const { storeId } = req.params;
    const store = await StoreModel.findById(storeId);
    if (!store) {

      return res.status(404).json({
        message: "Store not found"
      });

    }
    store.isFeatured = !store.isFeatured;
    await store.save();
    return res.status(200).json({
      message: `Store ${store.isFeatured
        ? "featured"
        : "removed from featured"
        } successfully`,
      store
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error"
    });

  }
};

module.exports = { registerAdmin, registerOwner, createUser, allStores, singleStore, updateStoreAndUser, deleteStoreAndUser, userBasedStores, publicAllStores, storeWithProducts, registerStoreOwner, verifyStoreStatus, createStore, updateStoreFeatured, verifyEmailOTP };

