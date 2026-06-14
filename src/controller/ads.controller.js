const AdsModel = require("../model/ads.model");
const { uploadToR2 } = require("../helper/upload");

// CREATE ADS

const createAds = async (req, res) => {
  try {
    const { title,description, redirectUrl, rank } = req.body;

    let image = "";

    const imageFile = req.files?.find((file) => file.fieldname === "image");

    if (imageFile) {
      const fileName = `amp-ads/${Date.now()}-${imageFile.originalname}`;

      image = await uploadToR2(imageFile.buffer, fileName, imageFile.mimetype);
    }

    const ads = await AdsModel.create({
      title,
      description,
      image,
      redirectUrl,
      rank: Number(rank),
    });

    return res.status(201).json({
      message: "Ads created successfully",
      ads,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// ALL ADS

const allAds = async (req, res) => {
  try {
    const ads = await AdsModel.find({
      isActive: true,
    }).sort({
      rank: 1,
    });

    return res.status(200).json({
      total: ads.length,
      ads,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// ADS BY RANK

const adsByRank = async (req, res) => {
  try {
    const { rank } = req.params;

    const ads = await AdsModel.find({
      rank: Number(rank),
      isActive: true,
    });

    return res.status(200).json({
      total: ads.length,
      ads,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// SINGLE ADS

const singleAds = async (req, res) => {
  try {
    const { adsId } = req.params;

    const ads = await AdsModel.findById(adsId);

    if (!ads) {
      return res.status(404).json({
        message: "Ads not found",
      });
    }

    return res.status(200).json({
      ads,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// UPDATE ADS

const updateAds = async (req, res) => {
  try {
    const { adsId } = req.params;

    const ads = await AdsModel.findById(adsId);

    if (!ads) {
      return res.status(404).json({
        message: "Ads not found",
      });
    }

    let image = ads.image;

    const imageFile = req.files?.find((file) => file.fieldname === "image");

    if (imageFile) {
      const fileName = `amp-ads/${Date.now()}-${imageFile.originalname}`;

      image = await uploadToR2(imageFile.buffer, fileName, imageFile.mimetype);
    }

    ads.title = req.body.title || ads.title;
    ads.description = req.body.description || ads.description;
    ads.redirectUrl = req.body.redirectUrl || ads.redirectUrl;

    ads.rank = req.body.rank || ads.rank;

    ads.image = image;

    ads.isActive = req.body.isActive ?? ads.isActive;

    await ads.save();

    return res.status(200).json({
      message: "Ads updated successfully",
      ads,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// DELETE ADS

const deleteAds = async (req, res) => {
  try {
    const { adsId } = req.params;

    await AdsModel.findByIdAndDelete(adsId);

    return res.status(200).json({
      message: "Ads deleted successfully",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  createAds,
  allAds,
  adsByRank,
  singleAds,
  updateAds,
  deleteAds,
};
