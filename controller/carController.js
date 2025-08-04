const commonFunc = require("../commonFunctions/commonFunctions");
const db = require("../config/db");

//  --- Search all active cars with optional search keyword and pagination. ---
exports.SearchAllCars = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const search = req.query.search?.trim() || "";

  let gridData;
  try {
    gridData = await commonFunc.getGridFields(db);
  } catch {
    return res.status(500).json({ error: "Could not load fields" });
  }

  const { fields, gridFields } = gridData;

  let sql = `SELECT ${gridFields} FROM cars c WHERE c.active = TRUE`;
  let countSql = `SELECT COUNT(*) as count FROM cars c WHERE c.active = TRUE`;
  const params = [];

  if (search) {
    const searchParts = [
      `LOWER(CAST(c.id AS CHAR)) LIKE LOWER(CONCAT('%', ?, '%'))`,
    ];

    for (const field of fields) {
      const col = field.column_name.trim();
      searchParts.push(
        `LOWER(CAST(c.${col} AS CHAR)) LIKE LOWER(CONCAT('%', ?, '%'))`
      );
    }

    const searchClause = ` AND (${searchParts.join(" OR ")})`;
    sql += searchClause;
    countSql += searchClause;

    for (let i = 0; i < fields.length + 1; i++) {
      params.push(search);
    }
  }
  sql += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  try {
    const [rows] = await db.query(sql, params);
    const countParams = params.slice(0, -2);
    const [[{ count }]] = await db.query(countSql, countParams);

    res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error("Query error:", err);
    res.status(500).json({ error: "Failed to fetch cars" });
  }
};

// --- Filter cars based on multiple column conditions and operators. ---
exports.filterCars = async (req, res) => {
  const filters = req.body.filters || [];
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  let gridData;
  try {
    gridData = await commonFunc.getGridFields(db);
  } catch {
    return res.status(500).json({ error: "Could not load grid fields" });
  }

  const { fields, gridFields } = gridData;

  let sql = `SELECT ${gridFields} FROM cars c WHERE c.active = TRUE`;
  let countSql = `SELECT COUNT(*) as count FROM cars c WHERE c.active = TRUE`;

  const params = [];
  const countParams = [];

  const allowedCols = new Set(fields.map((f) => f.column_name.trim()));

  function getCondition(filter) {
    const col = filter.column?.trim();
    if (!allowedCols.has(col)) return null;

    const op = filter.operator.toLowerCase();
    const val = filter.value;

    switch (op) {
      case "contains":
        return {
          clause: `LOWER(c.${col}) LIKE LOWER(CONCAT('%', ?, '%'))`,
          param: val,
        };
      case "equals":
        return { clause: `c.${col} = ?`, param: val };
      case "starts with":
        return {
          clause: `LOWER(c.${col}) LIKE LOWER(CONCAT(?, '%'))`,
          param: val,
        };
      case "ends with":
        return {
          clause: `LOWER(c.${col}) LIKE LOWER(CONCAT('%', ?))`,
          param: val,
        };
      case "is empty":
        return { clause: `(c.${col} IS NULL OR c.${col} = '')`, param: null };
      case "greater than":
        return { clause: `c.${col} > ?`, param: val };
      case "less than":
        return { clause: `c.${col} < ?`, param: val };
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
    const [rows, rawFields] = await db.query(sql, params);
    const [[{ count }]] = await db.query(countSql, countParams);

    res.json({
      data: rows,
      fields: rawFields,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error("Filter query error:", err);
    res.status(500).json({ error: "Failed to fetch filtered cars" });
  }
};

// --- Soft delete a car by setting its active field to FALSE. ---
exports.softDeleteCar = async (req, res) => {
  const { id: carId } = req.body;

  if (!carId) {
    return res
      .status(400)
      .json({ error: "Car ID is required in the request body" });
  }

  try {
    const [result] = await db.query(
      "UPDATE cars SET active = FALSE WHERE id = ?",
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

// --- Search car by ID ---
exports.getCarById = async (req, res) => {
  const carId = req.body.id;

  if (!carId) {
    return res.status(400).json({ error: "Car ID is required" });
  }

  let selectedColumns;
  try {
    selectedColumns = await commonFunc.getCarColumns(db);
  } catch {
    return res.status(500).json({ error: "Could not load metadata columns" });
  }

  try {
    const sql = `
      SELECT ${selectedColumns}
      FROM cars c
      WHERE c.active = TRUE AND c.id = ?
    `;

    const [rows] = await db.query(sql, [carId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Car not found" });
    }

    const car = rows[0];

    if (car.launch_date && car.launch_date.toISOString) {
      car.launch_date = car.launch_date.toISOString().split("T")[0];
    }

    res.json({ car });
  } catch (err) {
    console.error("Query error:", err);
    res.status(500).json({ error: "Failed to fetch car" });
  }
};
