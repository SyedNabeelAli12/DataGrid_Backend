function convertDbFieldsToSchema(fields) {
  const typeMap = {
    0: 'number',   // DECIMAL
    1: 'boolean',   // TINY
    2: 'number',   // SHORT
    3: 'number',   // LONG
    4: 'number',   // FLOAT
    5: 'number',   // DOUBLE
    8: 'number',   // BIGINT
    9: 'number',   // MEDIUMINT
    10: 'string',  // DATE
    11: 'string',  // TIME
    12: 'string',  // DATETIME
    13: 'string',  // YEAR
    16: 'boolean', // BIT
    246: 'number', // NEWDECIMAL
    253: 'string', // VARCHAR, VARBINARY
    254: 'string', // CHAR, BINARY
    252: 'string'  // TEXT, BLOB
  };

  const schema = {};

  for (const field of fields) {
    // console.log(field.type)
    const jsType = typeMap[field.type] || 'unknown';
    schema[field.name] = jsType;
  }
  console.log(schema)

  return schema;
}


module.exports = convertDbFieldsToSchema