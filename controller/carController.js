const convertDbFieldsToSchema = require("../commonFunctions/commonFunctions");
const db = require("../config/db");

//  --- Search all active cars with optional search keyword and pagination. ---
//
exports.SearchAllCars = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const search = req.query.search ? req.query.search.trim() : "";

  const gridFields = `
    c.id,
    b.name AS brand,
    c.model,
    c.accel_sec,
    c.top_speed_kmh,
    c.range_km,
    c.segment,
    c.price_euro
  `;

  // base query
  let sql = `
    SELECT ${gridFields}
    FROM ElectricCars c
    JOIN Brands b ON c.brand_id = b.id
    WHERE c.active = TRUE
  `;

  // count
  let countSql = `
    SELECT COUNT(*) AS count
    FROM ElectricCars c
    JOIN Brands b ON c.brand_id = b.id
    WHERE c.active = TRUE
  `;

  const params = [];

  if (search) {
    const searchCondition = `
      AND (
        LOWER(CAST(c.id AS CHAR)) LIKE LOWER(CONCAT('%', ?, '%'))
        OR LOWER(CAST(b.name AS CHAR)) LIKE LOWER(CONCAT('%', ?, '%'))
        OR LOWER(CAST(c.model AS CHAR)) LIKE LOWER(CONCAT('%', ?, '%'))
        OR LOWER(CAST(c.accel_sec AS CHAR)) LIKE LOWER(CONCAT('%', ?, '%'))
        OR LOWER(CAST(c.top_speed_kmh AS CHAR)) LIKE LOWER(CONCAT('%', ?, '%'))
        OR LOWER(CAST(c.range_km AS CHAR)) LIKE LOWER(CONCAT('%', ?, '%'))
        OR LOWER(CAST(c.segment AS CHAR)) LIKE LOWER(CONCAT('%', ?, '%'))
        OR LOWER(CAST(c.price_euro AS CHAR)) LIKE LOWER(CONCAT('%', ?, '%'))
      )
    `;

    sql += searchCondition;
    countSql += searchCondition;

    for (let i = 0; i < 8; i++) {
      params.push(search);
    }
  }

  sql += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  try {
    const [rows, fields] = await db.query(sql, params);

    const countParams = search ? params.slice(0, 8) : [];
    const [[{ count }]] = await db.query(countSql, countParams);

    let fieldConv = convertDbFieldsToSchema(fields);

    res.json({
      data: rows,
      fields: fieldConv,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch cars" });
  }
};

// --- Filter cars based on multiple column conditions and operators. ---
exports.filterCars = async (req, res) => {
  const filters = req.body.filters || [];
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const gridFields = `
    c.id,
    b.name AS brand,
    c.model,
    c.accel_sec,
    c.top_speed_kmh,
    c.range_km,
    c.segment,
    c.price_euro
  `;

  let sql = `
    SELECT ${gridFields}
    FROM ElectricCars c
    JOIN Brands b ON c.brand_id = b.id
    WHERE c.active = TRUE
  `;

  let countSql = `
    SELECT COUNT(*) AS count
    FROM ElectricCars c
    JOIN Brands b ON c.brand_id = b.id
    WHERE c.active = TRUE
  `;

  const params = [];
  const countParams = [];
  function getCondition(filter) {
    const colMap = {
      brand: "b.name",
      model: "c.model",
      accel_sec: "c.accel_sec",
      top_speed_kmh: "c.top_speed_kmh",
      range_km: "c.range_km",
      segment: "c.segment",
      price_euro: "c.price_euro",
      id: "c.id",
    };

    const col = colMap[filter.column];
    if (!col) return null;

    const op = filter.operator.toLowerCase();
    const val = filter.value;

    switch (op) {
      case "contains":
        return {
          clause: `LOWER(${col}) LIKE LOWER(CONCAT('%', ?, '%'))`,
          param: val,
        };
      case "equals":
        return { clause: `${col} = ?`, param: val };
      case "starts with":
        return {
          clause: `LOWER(${col}) LIKE LOWER(CONCAT(?, '%'))`,
          param: val,
        };
      case "ends with":
        return {
          clause: `LOWER(${col}) LIKE LOWER(CONCAT('%', ?))`,
          param: val,
        };
      case "is empty":
        return { clause: `(${col} IS NULL OR ${col} = '')`, param: null };
      case "greater than":
        return { clause: `${col} > ?`, param: val };
      case "less than":
        return { clause: `${col} < ?`, param: val };
      default:
        return null;
    }
  }

  const filterClauses = [];

  filters.forEach((filter) => {
    const cond = getCondition(filter);
    if (cond) {
      filterClauses.push(cond.clause);
      if (cond.param !== null) {
        params.push(cond.param);
        countParams.push(cond.param);
      }
    }
  });

  if (filterClauses.length > 0) {
    const whereClause = " AND " + filterClauses.join(" AND ");
    sql += whereClause;
    countSql += whereClause;
  }

  sql += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  try {
    const [rows, fields] = await db.query(sql, params);
    const [[{ count }]] = await db.query(countSql, countParams);
    let fieldConv = convertDbFieldsToSchema(fields);
    res.json({
      data: rows,
      fields: fieldConv,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch filtered cars" });
  }
};

// --- Soft delete a car by setting its active field to FALSE. ---
exports.softDeleteCar = async (req, res) => {
  const { id: carId } = req.body;
  //console.log(carId);

  if (!carId) {
    return res
      .status(400)
      .json({ error: "Car ID is required in the request body" });
  }

  try {
    const [result] = await db.query(
      "UPDATE ElectricCars SET active = FALSE WHERE id = ?",
      [carId]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: "Car not found or already inactive" });
    }

    res.json({ message: `Car with ID ${carId} marked as deleted` });
  } catch (err) {
    console.error("Error updating car active status:", err);
    res.status(500).json({ error: "Failed to update car status" });
  }
};

//   --- Search car by ID
// Returns brand, performance, specs, and other key details if the car is active. ---
exports.getCarById = async (req, res) => {
  const carId = req.body.id;

  if (!carId) {
    return res.status(400).json({ error: "Car ID is required" });
  }

  try {
    const sql = `
    SELECT 
  b.name AS brand,
  c.accel_sec,
  c.body_style_id,
  c.efficiency_whkm,
  c.fast_charge_kmh,
  DATE(c.launch_date) AS launch_date,
  c.model,
  c.plug_type_id,
  c.powertrain_id,
  c.price_euro,
  c.range_km,
  c.rapid_charge,
  c.seats,
  c.segment,
  c.top_speed_kmh
FROM ElectricCars c
JOIN Brands b ON c.brand_id = b.id
WHERE c.active = TRUE
  AND c.id = ?

    `;

    const [rows, fields] = await db.query(sql, [carId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Car not found" });
    }
    let car = rows[0];
    if (car.launch_date) {
      car.launch_date = car.launch_date.toISOString().split("T")[0];
    }
    let fieldConv = convertDbFieldsToSchema(fields);

    res.json({ fieldConv, car });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch car" });
  }
};
