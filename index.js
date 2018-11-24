const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const api = require('./api');

const app = express();

// Parse body to json
app.use(bodyParser.json({ type: 'application/json' }));

// Set up error handling middleware
app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({ error });
});

// Serve frontend if working in dev environment and set up logging
if (process.env.NODE_ENV === 'dev') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

app.use('/api', api);

app.listen(process.env.PORT, process.env.HOST, () => {
  console.log(`Server started at ${process.env.HOST}:${process.env.PORT}/`);
});
