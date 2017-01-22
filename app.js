var http = require("http");
var mysql = require("mysql");

// connect to the mysql database

var pool = mysql.createPool({
  connectionLimit: 100, //important
  host: 'localhost',
  user: 'php-crud-api',
  password: 'php-crud-api',
  database: 'php-crud-api',
  charset: 'utf8',
  debug: false
});

// ensure request has database connection

var withDb = function (handler) {
  return function (req, resp) {
    pool.getConnection(function (err, connection) {
      if (err) {
        resp.writeHead(404)
        resp.end(err);
        return;
      }
      req.db = connection;
      handler(req, resp);
    });
  }
};

// ensure request has (post) body

var withBody = function (handler) {
  return function (req, resp) {
    var input = "";
    req.on("data", function (chunk) {
      input += chunk;
    });
    req.on("end", function () {
      req.body = input;
      handler(req, resp);
    });
  }
};

// main web handler

var server = http.createServer(withDb(withBody(function (req, resp) {

  // get the HTTP method, path and body of the request
  var method = req.method;
  var request = req.url.replace(/^[\/]+|[\/]+$/g, '').split('/');
  try {
    var input = JSON.parse(req.body);
  } catch (e) {
    var input = {};
  }

  // retrieve the table and key from the path
  var table = req.db.escapeId(request.shift());
  var key = req.db.escape(request.shift());

  // create SQL based on HTTP method
  var sql = '';
  switch (req.method) {
    case 'GET':
      sql = "select * from " + table + (key ? " where id=" + key : '');
      break;
    case 'PUT':
      sql = "update " + table + " set ? where id=" + key;
      break;
    case 'POST':
      sql = "insert into " + table + " set ?";
      break;
    case 'DELETE':
      sql = "delete " + table + " where id=" + key;
      break;
  }

  // execute SQL statement
  req.db.query(sql, input, function (err, result) {

    // stop using mysql connection
    req.db.release();

    // return if SQL statement failed
    if (err) {
      resp.writeHead(404)
      resp.end(err);
      return;
    }

    // print results, insert id or affected row count
    resp.writeHead(200, {
      "Content-Type": "application/json"
    })
    if (req.method == 'GET') {
      resp.end(JSON.stringify(result));
    } else if (method == 'POST') {
      resp.end(JSON.stringify(result.insertId));
    } else {
      resp.end(JSON.stringify(result.affectedRows));
    }

  });

})));

server.listen(8000);