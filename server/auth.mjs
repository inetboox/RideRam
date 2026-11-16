import {randomBytes,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
export const digest=s=>createHash('sha256').update(s).digest('hex');
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');return `${salt}:${(await scrypt(password,salt,64)).toString('hex')}`;}
export async function verifyPassword(password,encoded){try{const [salt,hex]=encoded.split(':');const expected=Buffer.from(hex,'hex');const actual=await scrypt(password,salt,64);return actual.length===expected.length&&timingSafeEqual(actual,expected);}catch{return false;}}
export async function bootstrapUsers(store){
 if(store.db.prepare('SELECT COUNT(*) AS n FROM users').get().n)return;
 for(const [role,dealerId,prefix] of [['dealer',1,'DEALER'],['admin',null,'ADMIN']]){
 const email=(process.env[`${prefix}_LOGIN`]||`${role}@rideram.local`).toLowerCase();const pass=process.env[`${prefix}_PASSWORD`]||randomBytes(15).toString('base64url');
 if(pass.length<12)throw new Error(`${prefix}_PASSWORD: минимум 12 символов`);
 store.db.prepare('INSERT INTO users(email,password_hash,role,dealer_id) VALUES(?,?,?,?)').run(email,await hashPassword(pass),role,dealerId);
 console.log(`\nПервый запуск: ${role}\nЛогин: ${email}\n${process.env[`${prefix}_PASSWORD`]?'Пароль: задан в окружении':`Временный пароль: ${pass}\nСохраните его: повторно он не показывается.`}\n`);
 }
}
export function createSession(store,userId){const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');store.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());store.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(token),userId,Date.now()+7*86400000,csrf);return {token,csrf};}
export function readSession(store,req){const token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('rideram_session='))?.slice(16);if(!token)return null;return store.db.prepare('SELECT users.id,users.email,users.role,users.dealer_id AS dealerId,sessions.csrf,sessions.token_hash AS tokenHash FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires>?').get(digest(token),Date.now())||null;}
export function sessionCookie(token,clear=false){return `rideram_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear?0:604800}${process.env.COOKIE_SECURE==='true'?'; Secure':''}`;}
