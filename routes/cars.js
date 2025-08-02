const express = require("express");
const router = express.Router();
const carController = require("../controller/carController");

router.post("/soft-delete", carController.softDeleteCar);
router.get("/", carController.SearchAllCars);
router.post("/filter", carController.filterCars);
router.post("/view", carController.getCarById);

module.exports = router;
