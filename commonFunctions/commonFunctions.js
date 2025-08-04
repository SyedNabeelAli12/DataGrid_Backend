
async function getGridFields(db) {
  try {
    let gridFields = "c.id";
    const sql = "SELECT * FROM grid_metadata";
    const [rows] = await db.query(sql);
    for (const row of rows) {
      // const safeColumn = formatColumnName(row.column_name);
      gridFields += `, c.${row.column_name.trim()}`;
    }
    return {fields:rows,gridFields};
  } catch (err) {
    console.error("Failed to get grid fields:", err);
    throw err;
  }
}

async function getCarColumns(db) {
  try {
    const sql = "SELECT column_name FROM table_metadata WHERE column_name NOT IN ('active', 'id')";
    const [rows] = await db.query(sql);

    const columns = rows.map(row => `c.${row.column_name.trim()}`).join(", ");
    return columns || "c.id"; // fallback
  } catch (err) {
    console.error("Failed to load column names:", err);
    throw err;
  }
}


module.exports = { getCarColumns,getGridFields}