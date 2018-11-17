require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const api = require('./api');

const app = express();

// Parse body to json
app.use(bodyParser.json({ type: 'application/json' }));

// Set up error handling middleware
app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({ error });
});

app.use('/api', api);

app.listen(process.env.PORT, process.env.HOST, () => {
  console.log(`Server started at ${process.env.HOST}:${process.env.PORT}/`);
});
