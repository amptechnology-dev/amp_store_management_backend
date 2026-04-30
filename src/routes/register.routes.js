const router = require("express").Router();

const { registerAdmin, createUser, allStores, singleStore, updateStoreAndUser, deleteStoreAndUser, userBasedStores, publicAllStores, storeWithProducts,registerStoreOwner,verifyStoreStatus } = require("../controller/register.controller.js");
const verifyJwt = require("../middleware/verifiyUser.js");
const authorize = require("../middleware/authorize.js");
const { uploadMultiImages } = require("../middleware/multiMulter.js")

// router.post("/create-admin", registerAdmin);
// router.get("/all-admins", allAdmin);
router.post("/create-user", uploadMultiImages, createUser);
 router.post("/register-store-owner", uploadMultiImages, registerStoreOwner);
 router.get("/all-stores", allStores);
 router.get("/single-store/:storeId", singleStore);
 router.put("/update-store-and-user/:storeId", uploadMultiImages, updateStoreAndUser);
 router.delete("/delete-store-and-user/:storeId", deleteStoreAndUser);
router.get("/user-based-stores", verifyJwt, userBasedStores);
router.get("/public-all-stores", publicAllStores);
router.get("/store-with-products/:storeId", storeWithProducts);
router.patch("/verify-store-status/:storeId", verifyStoreStatus);

module.exports = router;