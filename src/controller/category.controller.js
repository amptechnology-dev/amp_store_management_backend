const mongoose = require("mongoose");
const CategoryModel = require("../model/category.model.js");
const { uploadToR2 } = require("../helper/upload");

const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    const exists = await CategoryModel.findOne({
      name: name.trim(),
    });

    if (exists) {
      return res.status(400).json({
        message: "Category already exists",
      });
    }

    let categoryImage = "";

    const imageFile = req.files?.find((file) => file.fieldname === "image");

    if (imageFile) {
      const fileName = `amp-category/${Date.now()}-${imageFile.originalname}`;

      categoryImage = await uploadToR2(
        imageFile.buffer,
        fileName,
        imageFile.mimetype,
      );
    }

    let subCategories = [];

    if (req.body.subCategories) {
      subCategories =
        typeof req.body.subCategories === "string"
          ? JSON.parse(req.body.subCategories)
          : req.body.subCategories;
    }

    const processedSubCategories = [];

    for (let i = 0; i < subCategories.length; i++) {
      let image = "";

      const subImage = req.files?.find(
        (file) => file.fieldname === `subCategoryImage_${i}`,
      );

      if (subImage) {
        const fileName = `amp-sub-category/${Date.now()}-${subImage.originalname}`;

        image = await uploadToR2(subImage.buffer, fileName, subImage.mimetype);
      }

      processedSubCategories.push({
        name: subCategories[i].name,
        image,
      });
    }

    const category = await CategoryModel.create({
      name,
      description,
      image: categoryImage,
      subCategories: processedSubCategories,
    });

    return res.status(201).json({
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// ALL CATEGORY

const allCategories = async (req, res) => {
  try {
    const categories = await CategoryModel.find().sort({ createdAt: -1 });

    return res.status(200).json({
      total: categories.length,
      categories,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// SINGLE CATEGORY

const singleCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await CategoryModel.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    return res.status(200).json({
      category,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// UPDATE CATEGORY

const updateCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await CategoryModel.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    // ==========================
    // Category Image
    // ==========================

    let categoryImage = category.image;

    const imageFile = req.files?.find(
      (file) => file.fieldname === "image"
    );

    if (imageFile) {
      const fileName = `amp-category/${Date.now()}-${imageFile.originalname}`;

      categoryImage = await uploadToR2(
        imageFile.buffer,
        fileName,
        imageFile.mimetype
      );
    }

    // ==========================
    // Sub Categories
    // ==========================

    let subCategories = [];

    if (req.body.subCategories) {
      subCategories =
        typeof req.body.subCategories === "string"
          ? JSON.parse(req.body.subCategories)
          : req.body.subCategories;
    }

    const processedSubCategories = [];

    for (let i = 0; i < subCategories.length; i++) {
      const subCategory = subCategories[i];

      // Existing SubCategory খুঁজে বের কর
      const existingSubCategory =
        category.subCategories.find(
          (item) =>
            item._id?.toString() ===
            subCategory._id
        );

      // Default old image use হবে
      let image =
        existingSubCategory?.image || "";

      // New image upload হলে replace হবে
      const subImage = req.files?.find(
        (file) =>
          file.fieldname ===
          `subCategoryImage_${i}`
      );

      if (subImage) {
        const fileName = `amp-sub-category/${Date.now()}-${subImage.originalname}`;

        image = await uploadToR2(
          subImage.buffer,
          fileName,
          subImage.mimetype
        );
      }

      processedSubCategories.push({
        _id: subCategory._id,
        name: subCategory.name,
        image,
        isActive:
          subCategory.isActive ?? true,
      });
    }

    // ==========================
    // Update Category
    // ==========================

    category.name =
      req.body.name || category.name;

    category.description =
      req.body.description ||
      category.description;

    category.image = categoryImage;

    category.subCategories =
      processedSubCategories;

    category.isActive =
      req.body.isActive ??
      category.isActive;

    await category.save();

    return res.status(200).json({
      success: true,
      message:
        "Category updated successfully",
      category,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// DELETE CATEGORY

const deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    await CategoryModel.findByIdAndDelete(categoryId);

    return res.status(200).json({
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// ADD SUB CATEGORY

module.exports = {
  createCategory,
  allCategories,
  singleCategory,
  updateCategory,
  deleteCategory,
};
