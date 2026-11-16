import 'dotenv/config';
import {openStore} from './store.mjs';
import {hashPassword} from './auth.mjs';
const [email,role='dealer',dealerId]=process.argv.slice(2);const password=process.env.NEW_USER_PASSWORD;
if(!email||!['dealer','admin'].includes(role)||!password||password.length<12){console.error('NEW_USER_PASSWORD="сильный-пароль" npm run create-user -- email dealer ID_ДИЛЕРА (или email admin). Минимум 12 символов. Существующий пароль будет сброшен.');process.exit(1);}
const store=openStore();if(role==='dealer'&&!store.get('dealers',Number(dealerId))){console.error('Дилер не найден. Сначала создайте дилера через администратора.');process.exit(1);}
store.db.prepare('INSERT INTO users(email,password_hash,role,dealer_id) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash,role=excluded.role,dealer_id=excluded.dealer_id').run(email.toLowerCase(),await hashPassword(password),role,role==='dealer'?Number(dealerId):null);
const u=store.db.prepare('SELECT id FROM users WHERE email=?').get(email.toLowerCase());store.db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id);store.db.close();console.log('Учётная запись сохранена, старые сессии закрыты.');
