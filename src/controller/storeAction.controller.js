const StoreActionModel = require("../model/storeAction.model");

const trackStoreAction = async (req, res) => {
  try {
    const { storeId, actionType } = req.body;

    await StoreActionModel.create({
      storeId,
      userId: req.user.id,
      actionType,
    });

    return res.status(200).json({
      message: "Action tracked successfully",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  trackStoreAction,
};
