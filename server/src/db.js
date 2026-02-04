require("dotenv").config();
const { Sequelize } = require("sequelize");
const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = parseInt(process.env.DB_PORT || "5432", 10);
const DB_USER = process.env.DB_USER || "postgres";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "eventure";

let sequelize;
if (DATABASE_URL) {
  sequelize = new Sequelize(DATABASE_URL, {
    dialect: "postgres",
    logging: false,
    dialectOptions: {
      ssl: process.env.DATABASE_SSL !== "false" ? { rejectUnauthorized: false } : false,
    },
  });
} else {
  sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
    host: DB_HOST,
    port: DB_PORT,
    dialect: "postgres",
    logging: false,
    dialectOptions: process.env.NODE_ENV === "production"
      ? { ssl: { rejectUnauthorized: false } }
      : {},
  });
}

const pgPool = new Pool(
  DATABASE_URL
    ? { connectionString: DATABASE_URL, ssl: process.env.DATABASE_SSL !== "false" ? { rejectUnauthorized: false } : false }
    : {
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        max: 10,
        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      }
);

function toPgPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function execute(sql, params = []) {
  const pgSql = toPgPlaceholders(sql);
  const result = await pgPool.query(pgSql, params);
  const upper = sql.trim().toUpperCase();
  const isSelect = upper.startsWith("SELECT");
  const isInsert = upper.startsWith("INSERT");
  const isUpdate = upper.startsWith("UPDATE");
  const isDelete = upper.startsWith("DELETE");

  if (isSelect) {
    return [result.rows, []];
  }
  if (isInsert && result.rows && result.rows[0] && "id" in result.rows[0]) {
    return [{ insertId: result.rows[0].id, affectedRows: result.rowCount ?? 0 }, []];
  }
  if (isUpdate || isDelete) {
    return [{ affectedRows: result.rowCount ?? 0 }, []];
  }
  if (isInsert) {
    return [{ insertId: undefined, affectedRows: result.rowCount ?? 0 }, []];
  }
  return [result.rows, []];
}

const pool = { execute };

module.exports = sequelize;
module.exports.pool = pool;
module.exports.pgPool = pgPool;
