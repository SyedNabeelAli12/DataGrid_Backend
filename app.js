const express = require('express');
const cors = require('cors');
const carRoutes = require('./routes/cars');
const lovRoutes = require('./routes/lov');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/cars', carRoutes);
app.use('/api/lovs', lovRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
