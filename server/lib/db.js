const mysql = require('mysql');
const debug = require('debug')('db');
const uuidParse = require('uuid-parse');
const transaction = require('./transaction');

const q = require('q');

class DatabaseConnector {

  
  constructor() {
    const params = {
      host     : process.env.DB_HOST,
      user     : process.env.DB_USER,
      password : process.env.DB_PASS,
      database : process.env.DB_NAME,
      charset  : 'utf8_unicode_ci',
    };

    this.pool = mysql.createPool(params);

    debug('#constructor(): Initialized database connector.');
  }

  exec(sql, params){
    const deferred = q.defer();
    this.pool.getConnection((error, connection) => {
      if (error) {
        debug('#exec(): An error occurred getting a connection.');
        deferred.reject(error);
        return;
      }

      // format the SQL statement using MySQL's escapes
      const statement = mysql.format(sql.trim(), params);

      connection.query(statement, (err, rows) => {
        connection.release();
        return (err) ? deferred.reject(err) : deferred.resolve(rows);
      });

      debug(`#exec(): ${statement}`);
    });

    return deferred.promise;
  }

   /**
   * @method one
   *
   * @description
   * A simply wrapper to make controllers DRY.  It wraps the exec() method in a
   * rejection if the returned value is not exactly 1.
   *
   * @param {String} sql - the SQL template query to call the database with
   * @param {Object|Array|Undefined} params - the parameter object to be
   *   combined with the SQL statement before calling the database driver
   * @param {String} id - the unique id sought
   * @param {String|Undefined} entity - the entity targeted for pretty printing.
   * @returns {Promise} the result of the database query
   */
  one(sql, params, id, entity = 'record') {
    return this.exec(sql, params)
      .then(rows => {
        // eslint-disable-next-line max-len
        const errorMessage = `Expected ${entity} to contain a single record with id ${id}, but ${rows.length} were found!`;

        if (rows.length < 1) {
          debug(`#one(): Found too few records!  Expected 1 but ${rows.length} found.`);
          throw  errorMessage;
        }

        if (rows.length > 1) {
          debug(`#one(): Found too many records!  Expected 1 but ${rows.length} found.`);
          throw new BadRequest(errorMessage);
        }

        return rows[0];
      });
  }

   /**
   * @function uuid
   * generates a uuid(buffer)
   */
  uuid() {
    return this.bid(uuid());
  }

  bid(hexUuid) {
    // if already a buffer, no need to convert
    if (hexUuid instanceof Buffer) {
      return hexUuid;
    }

    return Buffer.from(uuidParse.parse(hexUuid));
  }


  transaction() {
    return new transaction(this);
  }
}

module.exports = new DatabaseConnector(); 