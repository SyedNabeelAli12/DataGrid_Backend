const { getGridFields } = require("../commonFunctions/commonFunctions");
const db = require("../config/db");

// --gets all the list of values --
exports.getLOVs = async (req, res) => {
  try {
    const [table_metaData] = await db.query(
      `SELECT * FROM table_metadata WHERE column_name NOT IN ('id', 'active')`
    );
    const gridData = await getGridFields(db);
    if (!gridData || !gridData.fields) {
      return res.status(500).json({ error: "Failed to load grid fields" });
    }

    const columnNames = gridData.fields
      .map((field) => field.column_name)
      .filter((name) => !!name);

    if (columnNames.length === 0) {
      return res.json({ table_metaData, table_columns: [] });
    }
    const placeholders = columnNames.map(() => "?").join(", ");
    const [table_columns] = await db.query(
      `SELECT * FROM table_metadata WHERE column_name IN (${placeholders})`,
      columnNames
    );
    res.json({
      table_metaData,
      table_columns,
    });
  } catch (error) {
    console.error("Error fetching LOVs:", error);
    res.status(500).json({ error: "Failed to fetch list of values" });
  }
};
