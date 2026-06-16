const router = require("express").Router();

const {trackStoreAction} = require("../controller/storeAction.controller.js");
const verifyJwt = require("../middleware/verifiyUser.js");
const authorize = require("../middleware/authorize.js");

router.post("/", verifyJwt, trackStoreAction);

module.exports = router;