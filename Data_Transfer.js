const fs = require('fs');
const csv = require('csv-parser');
const mysql = require('mysql2/promise');

async function importCSVtoMySQL() {
  // MySQL connection config
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Nabeel',
    database: 'bmw',
  });

  const results = [];

  fs.createReadStream('./BMW_Aptitude_Test_Test_Data_ElectricCarData.csv')
  .pipe(csv())
  .on('data', (data) => {
    results.push({
      brand: (data.Brand || '').trim(),
      model: (data.Model || '').trim(),
      accel_sec: data.AccelSec === '-' ? 0 : parseFloat(data.AccelSec),
      top_speed_kmh: data.TopSpeed_KmH === '-' ? 0 : parseInt(data.TopSpeed_KmH, 10),
      range_km: data.Range_Km === '-' ? 0 : parseInt(data.Range_Km, 10),
      efficiency_whkm: data.Efficiency_WhKm === '-' ? 0 : parseInt(data.Efficiency_WhKm, 10),
      fast_charge_kmh: data.FastCharge_KmH === '-' ? 0 : parseInt(data.FastCharge_KmH, 10),
      rapid_charge: (data.RapidCharge || '').toLowerCase().trim() === 'yes' ? 1 : 0,
      powertrain: (data.PowerTrain || '').trim(),
      plug_type: (data.PlugType || '').trim(),
      body_style: (data.BodyStyle || '').trim(),
      segment: (data.Segment || '').trim(),
      seats: data.Seats === '-' ? 0 : parseInt(data.Seats, 10),
      price_euro: data.PriceEuro === '-' ? 0 : parseFloat(data.PriceEuro),
      launch_date: formatDate(data.Date), // same as before
    });
  })
    .on('end', async () => {
      console.log('CSV file read completed. Inserting into database...');

      // Insert row by row
      for (const row of results) {
        await connection.execute(
          `INSERT INTO cars
          (brand, model, accel_sec, top_speed_kmh, range_km, efficiency_whkm, fast_charge_kmh, rapid_charge, powertrain, plug_type, body_style, segment, seats, price_euro, launch_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.brand,
            row.model,
            row.accel_sec,
            row.top_speed_kmh,
            row.range_km,
            row.efficiency_whkm,
            row.fast_charge_kmh,
            row.rapid_charge,
            row.powertrain,
            row.plug_type,
            row.body_style,
            row.segment,
            row.seats,
            row.price_euro,
            row.launch_date,
          ]
        );
      }

      console.log('All rows inserted successfully!');
      await connection.end();
    });
}

// Helper to convert date formats like "8/24/2016" → "2016-08-24"
function formatDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const [month, day, year] = parts;
  return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

importCSVtoMySQL().catch(console.error);
