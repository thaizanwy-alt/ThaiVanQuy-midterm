require('dotenv').config();

const { MongoClient } = require('mongodb');

const studentId = process.env.STUDENT_ID;
const readUri = process.env.MONGODB_READ_URI;
const writeUri = process.env.MONGODB_WRITE_URI;

if (!studentId || !readUri || !writeUri) {
  throw new Error(
    'Thiếu STUDENT_ID, MONGODB_READ_URI hoặc MONGODB_WRITE_URI trong .env'
  );
}

const databaseName = `DB_${studentId}`;

const readClient = new MongoClient(readUri);
const writeClient = new MongoClient(writeUri);

async function connectDatabase() {
  await Promise.all([
    readClient.connect(),
    writeClient.connect()
  ]);

  console.log(`Đã kết nối hai tài khoản tới ${databaseName}`);
}

async function closeDatabase() {
  await Promise.allSettled([
    readClient.close(),
    writeClient.close()
  ]);
}

module.exports = {
  connectDatabase,
  closeDatabase,
  readDb: readClient.db(databaseName),
  writeDb: writeClient.db(databaseName)
};