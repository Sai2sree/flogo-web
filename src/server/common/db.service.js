import _ from 'lodash';
import Pouchdb from 'pouchdb';

const PREFIX_AUTO_GENERATE = 'auto-generate-id';
const FLOW = 'flows';
const DIAGRAM = 'diagram';
const DELIMITER = ":";
const DEFAULT_USER_ID = 'flogoweb-admin';

// TODO need to research how to implement private property and function on ES6
export class DBService{

  constructor(name, options){
    console.log("DBService initial, name: ", name);
    this.options = options;
    this._db = this._initDB(name, options);
    this._sync = null;
  }

  getIdentifier(identifier){
    identifier&&(identifier=identifier.toUpperCase());
    if(identifier == 'PREFIX_AUTO_GENERATE'){
      return PREFIX_AUTO_GENERATE;
    }else if(identifier == 'FLOW'){
      return FLOW;
    }else if(identifier == 'DIAGRAM'){
      return DIAGRAM;
    }else if(identifier == 'DELIMITER'){
      return DELIMITER;
    }else if(identifier == 'DEFAULT_USER_ID'){
      return DEFAULT_USER_ID;
    }else{
      return undefined;
    }
  }

  /**
   * generate a unique id
   */
  generateID(userID){
    // if userID isn't passed, then use default 'flogoweb'
    if(!userID){
      // TODO for now, is optional. When we implement user login, then this is required
      userID = DEFAULT_USER_ID;
    }
    let timestamp = new Date().toISOString();
    let random = Math.random();
    let id = `${PREFIX_AUTO_GENERATE}${DELIMITER}${userID}${DELIMITER}${timestamp}${DELIMITER}${random}`;

    return id;
  }

  /**
   * generate an id of flow
   * @param {string} [userID] - the id of currently user.
   */
  generateFlowID(userID){
    // if userID isn't passed, then use default 'flogoweb'
    if(!userID){
      // TODO for now, is optional. When we implement user login, then this is required
      userID = DEFAULT_USER_ID;
    }

    let timestamp = new Date().toISOString();
    let id = `${FLOW}${DELIMITER}${userID}${DELIMITER}${timestamp}`;

    console.log("[info]flowID: ", id);
    return id;
  }

  /**
   * create a doc to db
   * @param {Object} doc
   */
  create(doc){
    return new Promise((resolve, reject)=>{
      if(!doc) reject("Please pass doc");

      if(!doc.$table){
        console.error("[Error]doc.$table is required. You must pass. ", doc);
        reject("[Error]doc.$table is required.");
      }

      // if this doc don't have id, generate an id for it
      if(!doc._id){
        doc._id = this.generateID();
        console.log("[warning]We generate an id for you, but suggest you give a meaningful id to this document.");
      }

      if(!doc['created_at']){
        doc['created_at'] = new Date().toISOString();
      }
      this._db.put(doc).then((response)=>{
        console.log("response: ", response);
        resolve(response);
      }).catch((err)=>{
        console.error(err);
        reject(err);
      });
    });
  }

  /**
   * update a doc
   * @param {Object} doc
   */
  update(doc){
    return new Promise((resolve, reject)=>{
      if(!doc) reject("Please pass doc");

      // if this doc don't have id, generate an id for it
      if(!doc._id){
        console.error("[Error] Your doc don't have a valid _id");
        reject("[Error] Your doc don't have a valid _id");
      }

      if(!doc._rev){
        console.error("[Error] Your doc don't have valid _rev");
        reject("[Error] Your doc don't have valid _rev");
      }

      if(!doc.$table){
        console.error("[Error]doc.$table is required. You must pass. ", doc);
        reject("[Error]doc.$table is required.");
      }

      if(!doc['updated_at']){
        doc['updated_at'] = new Date().toISOString();
      }
      this._db.get(doc._id).then(
        ( dbDoc )=> {

          doc = _.cloneDeep( doc );
          delete doc[ '_rev' ];
          _.assign( dbDoc, doc );

          return this._db.put( dbDoc ).then((response)=>{
            console.log("response: ", response);
            resolve(response);
          }).catch((err)=>{
            console.error(err);
            reject(err);
          });
      });
    });
  }

  allDocs(options){
    let defaultOptions = {
      include_docs: true
    };
    return new Promise((resolve, reject)=>{
      let ops = _.merge({}, defaultOptions, options||{});
      this._db.allDocs(ops).then((response)=>{
        //console.log("[allDocs]response: ", response);
        let res = [];
        if(ops.include_docs){
          let rows = response&&response.rows||[];
          rows.forEach((item)=>{
            res.push(item&&item.doc);
          });
        }else{
          res = response;
        }
        resolve(res);
      }).catch((err)=>{
        console.error(err);
        reject(err);
      });
    });
  }
  /**
   * remove doc. You can pass doc object or doc._id and doc._rev
   */
  remove(){
    let parameters = arguments;
    return new Promise((resolve, reject)=>{
      let doc, docId, docRev;
      // user pass doc
      if(parameters.length==1){
        doc = parameters[0];
        if(typeof doc != "object"){
          console.error("[error]Please pass correct doc object");
          reject("[error]Please pass correct doc object");
        }
        this._db.remove(doc).then((response)=>{
          resolve(response);
        }).catch((err)=>{
          reject(err);
        })
      }else if(parameters.length>1){ // remove by _id and _rev
        docId = parameters[0];
        docRev = parameters[1];

        if(!docId||!docRev){
          console.error("[error]Please pass correct doc._id and doc._rev");
          reject("[error]Please pass correct doc._id and doc._rev");
        }

        this._db.remove(docId, docRev).then((response)=>{
          resolve(response);
        }).catch((err)=>{
          reject(err);
        })
      }
    });
  }

  get db(){
    return this._db;
  }

  _initDB(name, options){
    let db = new Pouchdb(name);
    // PouchDB will be initialled when you call it. So this code is to make sure db is created
    db.info().then((response)=>{
      console.log("[_initDB][response]", response);
    }).catch((error)=>{
      console.log("[_initDB][error]", error);
    });
    return db;
  }
}