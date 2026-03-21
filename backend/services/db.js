const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: '127.0.0.1',
    port: 3306,               // Added port to match default Python behavior
    user: 'root',
    password: '', // Ensure your password is typed exactly like this
    database: '',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;