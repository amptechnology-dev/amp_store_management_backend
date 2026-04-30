const router = require("express").Router();

const verifyJwt = require("../middleware/verifiyUser.js");
const authorize = require("../middleware/authorize.js");
const { uploadMultiImages } = require("../middleware/multiMulter.js")

const { createProduct, getAllProducts, updateProduct, deleteProduct, getSingleProduct, allProductWithStore, verifyStatus } = require("../controller/product.controller.js")

router.post("/create-product", verifyJwt, authorize("STORE"),uploadMultiImages, createProduct)
router.put("/update-product/:id", verifyJwt, authorize("STORE"), uploadMultiImages, updateProduct)
router.get("/all-products", verifyJwt, authorize("STORE"), getAllProducts);
router.get("/single-product/:id", getSingleProduct);
router.get("/all-products-with-store", verifyJwt,authorize("ADMIN"), allProductWithStore);
router.delete("/delete-product/:id", deleteProduct);
router.patch("/verify-status/:id",verifyJwt, authorize("ADMIN"), verifyStatus)


module.exports = router
