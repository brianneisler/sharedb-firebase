import { DB } from 'sharedb';
import _ from 'lodash';

export default class FirebaseDB extends DB {
  constructor(options) {
    super();
    this.database = options.database;
    this.closed = false;
  }

  close(callback) {
    this.closed = true;
    if (callback) {
      callback();
    }
  }

  async commit(collection, id, op, snapshot, callback) {
    console.log('commit - collection:', collection, ' id:', id, ' op:', op, ' snapshot:', snapshot);
    // const version = await this.getVersion(collection, id);
    // console.log('commit version:', version, ' collection:', collection, ' id:', id, ' op:', op, ' snapshot:', snapshot);
    // if (snapshot.v !== version + 1) {
    //   return callback(null, false);
    // }
    try {
      console.log('commit about to update - collection:', collection, ' id:', id, ' op:', op, ' snapshot:', snapshot);
      if (!snapshot.type) {
        snapshot = null;
      }
      let success = false;
      await this.database.ref(`ops/${collection}/${id}/${op.v}`).transaction((data) => {
        if (!data) {
          success = true;
          return op;
        }
        return undefined;
      });
      if (!success) {
        console.log('transaction failed, aborting commit - collection:', collection, ' id:', id, ' op:', op, ' snapshot:', snapshot);
        return callback(null, false);
      }
      await this.database.ref(`docs/${collection}/${id}`).set(snapshot);
      // await this.database.ref().update({
      //   [`ops/${collection}/${id}/${op.v}`]: op,
      //   [`docs/${collection}/${id}`]: snapshot
      // });
    } catch(error) {
      return callback(error);
    }
    callback(null, true);
  }

  async getSnapshot(collection, id, fields, callback) {
    const doc = await this.getSnapshotDoc(collection, id);
    if (doc) {
      return callback(null, doc);
    }
    const version = await this.getVersion(collection, id);
    return callback(null, {
      id,
      v: version,
      type: null,
      data: undefined
    });
  }

  async getSnapshotDoc(collection, id) {
    const snapshot  = await this.database.ref(`docs/${collection}/${id}`).once('value');
    return snapshot.val();
  }

  async getOps(collection, id, from, to, callback) {
    console.log('getOps - collection:', collection, ' id:', id, ' from:', from, ' to:', to);
    //TODO BRN: instead of getting the entire op log, perform a query using Promise.all and retrieve each op individually through the range
    const opLog   = await this.getOpLog(collection, id);
    if (to == null) {
      to = _.size(opLog);
    }
    const ops = _.slice(opLog, from, to);
    return callback(null, ops);
  }

  async getOpLog(collection, id) {
    const snap = await this.database.ref(`ops/${collection}/${id}`).once('value');
    return snap.val();
  }

  async query(collection, query, fields, options, callback) {
    //TODO BRN:
    try {
      console.log('query - collection:', collection, ' query:', query, ' fields:', fields, ' options:', options);
      const snapshot  = await this.database.ref(`docs/${collection}`).once('value');

      const snapshots = _.map(snapshot.val(), (snap) => {
        return snap;
      });
      console.log('snapshots:', snapshots);
      return callback(null, snapshots);
    } catch(error) {
      callback(error);
    }
  }

//TODO BRN: This is potentiall a giant load
  async getVersion(collection, id) {
    const opLog   = await this.getOpLog(collection, id);
    return _.size(opLog);
  }
}
