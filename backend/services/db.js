const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: '127.0.0.1',
    port: 3306,             
    user: 'root',
    password: 'rubi12345678', 
    database: 'ql_ao_nuoi',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;