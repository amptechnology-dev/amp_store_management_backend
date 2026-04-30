const mongoose = require("mongoose");
const ProductModel = require("../model/product.model.js")
const UserModel = require("../model/user.model.js")
const StoreModel = require("../model/store.model.js")
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createProductSchema, updateProductSchema } = require("../schema/product.schema.js");
const { ZodError } = require("zod");
const uploadSingleImage = require("../helper/upload.js");
const sendProductVerifyEmail = require("../helper/sendProductVerifyEmail.js");


const createProduct = async (req, res) => {
    try {
        const parsedData = createProductSchema.parse(req.body);
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }
        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        if (user.role !== "STORE") {
            return res.status(403).json({
                success: false,
                message: "Only STORE can create product"
            });
        }

        let images = [];

        if (req.files?.length > 0) {
            for (const file of req.files) {
                if (file.fieldname.startsWith("image")) {
                    const url = await uploadSingleImage(file);
                    images.push(url);
                }
            }
        }

        const product = await ProductModel.create({
            ...parsedData,
            images,
            storeId: parsedData.storeId,
            userId
        });

        return res.status(201).json({
            success: true,
            message: "Product created successfully",
            data: product
        });

    } catch (error) {

        console.log(error);

        if (error.name === "ZodError") {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: error.issues.map((err) => ({
                    field: err.path.join("."),
                    message: err.message
                }))
            });
        }

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "Product with this name already exists"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const getAllProducts = async (req, res) => {
    try {

        const userId = req.user._id || req.user.id;

        let page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || "";

        const matchStage = {
            userId: new mongoose.Types.ObjectId(userId)
        };

        /* =========================
           SEARCH FILTER (OPTIONAL)
        ========================= */
        if (search) {
            matchStage.name = { $regex: search, $options: "i" };
        }

        const pipeline = [

            /* =========================
               MATCH USER PRODUCTS
            ========================= */
            {
                $match: matchStage
            },

            /* =========================
               JOIN STORE
            ========================= */
            {
                $lookup: {
                    from: "stores",
                    localField: "storeId",
                    foreignField: "_id",
                    as: "store"
                }
            },

            {
                $unwind: {
                    path: "$store",
                    preserveNullAndEmptyArrays: true
                }
            },

            /* =========================
               FINAL CLEAN PRODUCT MODEL
            ========================= */
            {
                $project: {

                    name: 1,
                    images: 1,
                    description: 1,
                    sellingPrice: 1,

                    isActive: 1,
                    isVerified: 1,

                    storeId: 1,
                    userId: 1,

                    createdAt: 1,

                    /* STORE INFO (optional but useful) */
                    store: {
                        _id: "$store._id",
                        storeName: "$store.storeName",
                        storeUniqueId: "$store.storeUniqueId",
                        contactNo: "$store.contactNo",
                        whatsappNo: "$store.whatsappNo",
                        email: "$store.email",
                        isActive: "$store.isActive",
                        isVerify: "$store.isVerify"
                    }
                }
            },

            {
                $sort: { createdAt: -1 }
            },

            /* =========================
               PAGINATION
            ========================= */
            {
                $facet: {
                    data: [
                        { $skip: (page - 1) * limit },
                        { $limit: limit }
                    ],
                    totalCount: [
                        { $count: "count" }
                    ]
                }
            }

        ];

        const result = await ProductModel.aggregate(pipeline);

        const products = result[0]?.data || [];
        const totalProducts = result[0]?.totalCount[0]?.count || 0;
        const totalPages = Math.ceil(totalProducts / limit);

        return res.status(200).json({
            success: true,
            page,
            limit,
            totalPages,
            totalProducts,
            products
        });

    } catch (error) {

        console.error("Error fetching products:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


const updateProduct = async (req, res) => {
    try {

        const { id } = req.params;
        const userId = req.user?._id || req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (user.role !== "STORE") {
            return res.status(403).json({
                success: false,
                message: "Only STORE can update product"
            });
        }

        const existingProduct = await ProductModel.findOne({
            _id: id,
            userId: userId
        });

        if (!existingProduct) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        const parsedData = updateProductSchema.parse(req.body);

        /* ==============================
           🔁 DUPLICATE NAME CHECK
        ============================== */

        if (parsedData.name) {
            const duplicate = await ProductModel.findOne({
                name: { $regex: `^${parsedData.name}$`, $options: "i" },
                userId,
                _id: { $ne: id }
            });

            if (duplicate) {
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors: [{
                        field: "name",
                        message: "Product name already exists"
                    }]
                });
            }
        }

        /* ==============================
           🖼 IMAGE FIX (IMPORTANT)
        ============================== */

        let images = [];

        // 1️⃣ frontend sends remaining images
        if (req.body.images) {
            if (Array.isArray(req.body.images)) {
                images = req.body.images;
            } else {
                images = [req.body.images];
            }
        }

        // 2️⃣ new upload
        if (req.files?.length > 0) {
            for (const file of req.files) {
                if (file.fieldname.startsWith("image")) {
                    const url = await uploadSingleImage(file);
                    images.push(url);
                }
            }
        }

        // 3️⃣ nothing sent → keep old
        if (!req.body.images && !req.files?.length) {
            images = existingProduct.images;
        }

        /* ============================== */

        const updateData = {
            ...parsedData,
            images
        };

        const updatedProduct = await ProductModel.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        return res.status(200).json({
            success: true,
            message: "Product updated successfully",
            data: updatedProduct
        });

    } catch (error) {

        console.log(error);

        if (error.name === "ZodError") {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: error.issues.map((err) => ({
                    field: err.path.join("."),
                    message: err.message
                }))
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


const deleteProduct = async (req, res) => {
    try {

        const { id } = req.params;

        const product = await ProductModel.findById(id);

        if (!product) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        await ProductModel.findByIdAndDelete(id);

        return res.status(200).json({
            message: "Product deleted permanently"
        });

    } catch (error) {

        console.error("Delete Product Error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

const getSingleProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await ProductModel.findOne({
            _id: id,
            isActive: true
        });
        console.log("==>", product)
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        return res.status(200).json({
            message: "Product get successfully",
            product
        });
    } catch (error) {
        console.error("Get Single Product Error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const verifyStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isVerify } = req.body;
        if (!id) {
            return res.status(400).json({
                message: "Product ID is required"
            });
        }
        const product = await ProductModel.findById(id);

        if (!product) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        product.isVerified = isVerify;
        await product.save();

        const store = await StoreModel.findById(product.storeId);

        const user = await UserModel.findById(product.userId);

        if (isVerify && user?.email && store) {
            await sendProductVerifyEmail(
                user.email,
                product.name,
                store.storeName,
                store.storeUniqueId
            );
        }
        return res.json({
            success: true,
            message:
                "Product is " +
                (isVerify ? "verified" : "not verified") +
                " successfully"
        });

    } catch (error) {
        console.error("Verify error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });

    }
};

const allProductWithStore = async (req, res) => {
    try {

        const products = await ProductModel.aggregate([

            {
                $match: {}
            },

            {
                $lookup: {
                    from: "stores",
                    localField: "storeId",
                    foreignField: "_id",
                    as: "store"
                }
            },

            {
                $unwind: {
                    path: "$store",
                    preserveNullAndEmptyArrays: true
                }
            },

            {
                $project: {

                    name: 1,
                    images: 1,
                    description: 1,
                    sellingPrice: 1,

                    isActive: 1,
                    isVerified: 1,

                    storeId: 1,
                    userId: 1,

                    createdAt: 1,
                    updatedAt: 1,

                    /* STORE DETAILS */
                    store: {
                        _id: "$store._id",
                        storeName: "$store.storeName",
                        storeUniqueId: "$store.storeUniqueId",
                        contactNo: "$store.contactNo",
                        whatsappNo: "$store.whatsappNo",
                        email: "$store.email",
                        website: "$store.website",
                        isActive: "$store.isActive",
                        isVerify: "$store.isVerify"
                    }
                }
            },

            {
                $sort: { createdAt: -1 }
            }

        ]);

        return res.json({
            success: true,
            count: products.length,
            products
        });

    } catch (error) {

        console.error("Dropdown Products Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

module.exports = {
    createProduct,
    getAllProducts,
    getSingleProduct,
    updateProduct,
    deleteProduct,
    allProductWithStore,
    verifyStatus
};