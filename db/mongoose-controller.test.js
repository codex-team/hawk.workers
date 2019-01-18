/*
 * @todo must have tests
 */

const db = require('./mongoose-controller');

console.log(db);

db.connect('mongodb://localhost:27017');

db.close();