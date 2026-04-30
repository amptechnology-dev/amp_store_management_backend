const { z } = require("zod");

const createProductSchema = z.object({

  name: z
    .string({ required_error: "Product name is required" })
    .trim()
    .min(1, "Product name cannot be empty"),

  images: z
    .array(z.string().url("Image must be a valid URL"))
    .optional(),

  description: z
    .string({ required_error: "Product description is required" })
    .trim()
    .min(1, "Description cannot be empty"),

  sellingPrice: z
    .coerce.number({ required_error: "Selling price is required" })
    .nonnegative("Selling price must be >= 0"),

  storeId: z
    .string({ required_error: "Store ID is required" })
    .min(1, "Store ID is required")

});

const updateProductSchema = z.object({

  name: z
    .string()
    .trim()
    .min(1, "Product name cannot be empty")
    .optional(),

  images: z
    .array(z.string().url("Image must be a valid URL"))
    .optional(),

  description: z
    .string()
    .trim()
    .optional(),

  sellingPrice: z
    .coerce.number()
    .nonnegative("Selling price must be >= 0")
    .optional(),

  isActive: z.boolean().optional(),

});


module.exports = {
  createProductSchema,
  updateProductSchema
};