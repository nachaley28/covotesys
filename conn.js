const mysql =require("mysql");
const conn =mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "voting_db",
});
    conn.connect((err) =>{
        if (err) throw err;
        console.log("Database is connected");
    });

    module.exports = conn;