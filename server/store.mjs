import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function openStore(directory=process.env.DATA_DIR||path.join(root,'var')){
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const file=path.join(directory,'rideram.sqlite'); const db=new DatabaseSync(file);fs.chmodSync(file,0o600);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS entities(kind TEXT NOT NULL,id INTEGER NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(kind,id));
 CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL,dealer_id INTEGER);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),expires INTEGER NOT NULL,csrf TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,model_id INTEGER,dealer_id INTEGER,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
 const store={db,all(kind){return db.prepare('SELECT payload FROM entities WHERE kind=? ORDER BY id').all(kind).map(x=>JSON.parse(x.payload));},get(kind,id){const r=db.prepare('SELECT payload FROM entities WHERE kind=? AND id=?').get(kind,Number(id));return r?JSON.parse(r.payload):null;},put(kind,obj){db.prepare('INSERT INTO entities(kind,id,payload) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload').run(kind,obj.id,JSON.stringify(obj));return obj;},add(kind,obj){db.exec('BEGIN IMMEDIATE');try{const id=Number(db.prepare('SELECT COALESCE(MAX(id),0)+1 AS id FROM entities WHERE kind=?').get(kind).id);store.put(kind,{...obj,id});db.exec('COMMIT');return {...obj,id};}catch(e){db.exec('ROLLBACK');throw e;}},event(kind,modelId=null,dealerId=null){db.prepare('INSERT INTO events(kind,model_id,dealer_id,created_at) VALUES(?,?,?,?)').run(kind,modelId,dealerId,new Date().toISOString());}};
 if(!db.prepare('SELECT value FROM meta WHERE key=?').get('seed-v1')){
  const seed=JSON.parse(fs.readFileSync(path.join(root,'data/seed.json'),'utf8'));db.exec('BEGIN IMMEDIATE');try{for(const [kind,rows] of Object.entries(seed))for(const row of rows)store.put(kind,row);db.prepare('INSERT INTO meta VALUES(?,?)').run('seed-v1',new Date().toISOString());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 }
 return store;
}
