const session = require('express-session');
const { readDb, writeDb } = require('./db');

class AtlasSessionStore extends session.Store {
  constructor() {
    super();

    this.reader = readDb.collection('sessions');
    this.writer = writeDb.collection('sessions');
  }

  getExpiry(data) {
    if (data.cookie && data.cookie.expires) {
      return new Date(data.cookie.expires);
    }

    return new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  get(sid, callback) {
    this.reader.findOne({
      _id: sid,
      expires: { $gt: new Date() }
    })
      .then((document) => {
        const data = document
          ? JSON.parse(document.session)
          : null;

        callback(null, data);
      })
      .catch(callback);
  }

  set(sid, data, callback) {
    this.writer.updateOne(
      { _id: sid },
      {
        $set: {
          session: JSON.stringify(data),
          expires: this.getExpiry(data)
        }
      },
      { upsert: true }
    )
      .then((result) => {
        console.log(
          'Atlas lưu Session thành công.',
          `matched=${result.matchedCount},`,
          `upserted=${result.upsertedCount}`
        );

        callback(null);
      })
      .catch(callback);
  }

  destroy(sid, callback) {
    this.writer.deleteOne({ _id: sid })
      .then(() => callback(null))
      .catch(callback);
  }

  touch(sid, data, callback) {
    this.writer.updateOne(
      { _id: sid },
      {
        $set: {
          expires: this.getExpiry(data)
        }
      }
    )
      .then(() => callback(null))
      .catch(callback);
  }
}

module.exports = AtlasSessionStore;