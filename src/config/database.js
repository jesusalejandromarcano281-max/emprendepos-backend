const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'database.sqlite');

async function initDatabase() {
  const SQL = await initSqlJs();
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    saveDatabase();
  }

  // Auto-save every minute
  setInterval(() => {
    saveDatabase();
  }, 60000);

  // Auto-save on exit
  process.on('exit', saveDatabase);
  process.on('SIGINT', () => { saveDatabase(); process.exit(); });
}

function getDb() {
  return db;
}

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function dbAll(sql, params = []) {
  const safeParams = params.map(p => p === undefined ? null : p);
  const stmt = db.prepare(sql);
  stmt.bind(safeParams);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function dbGet(sql, params = []) {
  const safeParams = params.map(p => p === undefined ? null : p);
  const stmt = db.prepare(sql);
  stmt.bind(safeParams);
  let result;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}

function dbRun(sql, params = []) {
  const safeParams = params.map(p => p === undefined ? null : p);
  db.run(sql, safeParams);
  const lastIdRes = dbGet('SELECT last_insert_rowid() as id');
  return {
    changes: db.getRowsModified(),
    lastId: lastIdRes ? lastIdRes.id : null
  };
}

module.exports = {
  initDatabase,
  getDb,
  saveDatabase,
  dbAll,
  dbGet,
  dbRun
};
