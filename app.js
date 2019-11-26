
require('use-strict');
const dotEnv = require('dotenv');
const express = require('express');
const app = express();

const bodyParser = require('body-parser');
app.use(bodyParser.json({ limit : '18mb' }));
// setup enviroment variable
configureEnvironmentVariables();

const router = require('./server/config/routes');

/**
 * @function configureEnvironmentVariables
 *
 * @description
 * Uses dotenv to add environmental variables from the .env.* file to the
 * process object.  If the NODE_ENV system variable is not set, the function
 * defaults to 'production'
 */
function configureEnvironmentVariables() {
  // if the process NODE_ENV is not set, default to production.
  process.env.NODE_ENV = process.env.NODE_ENV || 'production';

  // normalize the environmental variable name
  const env = process.env.NODE_ENV.toLowerCase();

  // decode the file path for the environmental variables.
  const dotfile = `.env.${env}`.trim();

  // load the environmental variables into process using the dotenv module
  dotEnv.config({ path : dotfile });
}

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// specification des differents api
app.use('/', router);

// demarrage du serveur

app.listen(process.env.PORT);

console.log('application runs on port '+ process.env.PORT);