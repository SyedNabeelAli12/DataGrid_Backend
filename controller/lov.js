const db = require("../config/db");

// --gets all the list of values --
exports.getLOVs = async (req, res) => {
  try {
    const [powertrains] = await db.query('SELECT * FROM PowerTrains');
    const [bodyStyles] = await db.query('SELECT * FROM BodyStyles');
    const [plugTypes] = await db.query('SELECT * FROM PlugTypes');

    res.json({
      powertrains,
      bodyStyles,
      plugTypes,
    });
  } catch (err) {
    console.error('Failed to fetch LOVs:', err);
    res.status(500).json({ error: 'Failed to fetch list of values' });
  }
};