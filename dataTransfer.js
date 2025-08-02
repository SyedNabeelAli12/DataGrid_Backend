const fs = require('fs');
const csv = require('csv-parser');
const connection = require('./config/db');

const brands = new Set();
const powertrains = new Set();
const plugTypes = new Set();
const bodyStyles = new Set();

const electricCarRows = [];

fs.createReadStream('./BMW_Aptitude_Test_Test_Data_ElectricCarData.csv')
  .pipe(csv())
  .on('data', (row) => {
    brands.add(row['Brand']?.trim());
    powertrains.add(row['PowerTrain']?.trim());
    plugTypes.add(row['PlugType']?.trim());
    bodyStyles.add(row['BodyStyle']?.trim());

    electricCarRows.push(row);
  })
  .on('end', async () => {
    console.log('Distinct Brands:', Array.from(brands));
    console.log('Distinct PowerTrains:', Array.from(powertrains));
    console.log('Distinct PlugTypes:', Array.from(plugTypes));
    console.log('Distinct BodyStyles:', Array.from(bodyStyles));

    try {
    //   await insertDistinctValues();
    //   await insertElectricCars();
    await alter()
    } catch (err) {
      console.error('❌ Error:', err);
    } finally {
      connection.end();
    }
  })
  .on('error', (err) => {
    console.error('❌ Error reading CSV:', err);
  });

function insertIfNotExists(table, valuesSet) {
  return new Promise((resolve, reject) => {
    const values = Array.from(valuesSet);
    if (values.length === 0) return resolve();

    const sql = `INSERT IGNORE INTO \`${table}\` (name) VALUES ?`;
    const valuesArr = values.map(val => [val]);

    connection.query(sql, [valuesArr], (err, results) => {
      if (err) return reject(err);
      console.log(`✅ Inserted/Skipped ${results.affectedRows} rows into ${table}`);
      resolve();
    });
  });
}

async function insertDistinctValues() {
  await insertIfNotExists('Brands', brands);
  await insertIfNotExists('PowerTrains', powertrains);
  await insertIfNotExists('PlugTypes', plugTypes);
  await insertIfNotExists('BodyStyles', bodyStyles);
}

function getIdByName(table, name) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT id FROM \`${table}\` WHERE name = ? LIMIT 1`;
    connection.query(sql, [name], (err, results) => {
      if (err) return reject(err);
      if (results.length === 0) return reject(new Error(`${table} not found for name: ${name}`));
      resolve(results[0].id);
    });
  });
}

const alter = ()=>{
    const sqlAlter = `
  ALTER TABLE ElectricCars
  ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE
`;

const sqlUpdate = `
  UPDATE ElectricCars SET active = TRUE
`;

connection.query(sqlUpdate, (err2, results2) => {
    if (err2) {
      console.error('❌ Error updating active column:', err2);
    } else {
      console.log('✅ All rows set active = true');
    }
    connection.end();
  });

// connection.query(sqlAlter, (err, results) => {
//   if (err) {
//     console.error('❌ Error adding column active:', err);
//     return connection.end();
//   }
//   console.log('✅ Column active added');

  
// });
}

async function insertElectricCars() {
  for (const row of electricCarRows) {
    try {
      const brand_id = await getIdByName('Brands', row['Brand']?.trim());
      const powertrain_id = await getIdByName('PowerTrains', row['PowerTrain']?.trim());
      const plug_type_id = await getIdByName('PlugTypes', row['PlugType']?.trim());
      const body_style_id = await getIdByName('BodyStyles', row['BodyStyle']?.trim());

      // Convert rapid_charge 'Yes'/'No' to boolean
      const rapid_charge = (row['RapidCharge']?.toLowerCase() === 'yes') ? 1 : 0;

      // Parse date to YYYY-MM-DD
      const launch_date = new Date(row['Date']);
      const launch_date_sql = launch_date.toISOString().split('T')[0]; // yyyy-mm-dd

      const sql = `
        INSERT INTO ElectricCars (
          brand_id, model, accel_sec, top_speed_kmh, range_km, efficiency_whkm,
          fast_charge_kmh, rapid_charge, powertrain_id, plug_type_id, body_style_id,
          segment, seats, price_euro, launch_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const fastChargeKmH = row['FastCharge_KmH'] === '-' ? null : parseInt(row['FastCharge_KmH']);

      const values = [
        brand_id,
        row['Model']?.trim(),
        parseFloat(row['AccelSec']),
        parseInt(row['TopSpeed_KmH']),
        parseInt(row['Range_Km']),
        parseInt(row['Efficiency_WhKm']),
        fastChargeKmH,
        rapid_charge,
        powertrain_id,
        plug_type_id,
        body_style_id,
        row['Segment']?.trim(),
        parseInt(row['Seats']),
        parseInt(row['PriceEuro']),
        launch_date_sql
      ];

      await new Promise((resolve, reject) => {
        connection.query(sql, values, (err, results) => {
          if (err) return reject(err);
          console.log(`✅ Inserted model: ${row['Model']}`);
          resolve();
        });
      });
    } catch (err) {
      console.error('❌ Error inserting row:', row, err);
    }
  }
}


