const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const passport = require('passport');
const session = require('express-session');
const bcrypt = require('bcrypt');
const db = require('./models/db');

const app = express();
const server = http.createServer(app);

// Configuração do CORS
const io = socketIO(server, {
    cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] }
});

app.use(express.json());
app.use(session({ secret: 'secret_key', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// Helpers
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => done(err, user)));

const parseTime = (str) => { if(!str) return 0; const [h,m] = str.split(':').map(Number); return h*60+m; };
const getFmtDate = (d = new Date()) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;

// Bootstrap Admin
db.get("SELECT count(*) as count FROM users", async (err, row) => {
    if (row && row.count === 0) {
        const hash = await bcrypt.hash("admin", 10);
        db.run("INSERT INTO users (name, cpf, password, cargo, role) VALUES (?, ?, ?, ?, ?)", 
            ["Administrador Principal", "admin", hash, "Sistema", "admin"]);
        console.log("⚠️ BANCO VAZIO: Admin criado (Login: admin / Senha: admin)");
    }
});

io.on('connection', (socket) => {
    console.log('🔗 Conectado:', socket.id);

    // --- FUNÇÕES DE ENVIO ---
    const sendTodayRecords = () => {
        const today = getFmtDate();
        db.all('SELECT tr.*, u.name as userId, u.role FROM time_records tr JOIN users u ON tr.user_id = u.id WHERE tr.date = ?', [today], (err, r) => io.emit('time-records', r || []));
    };

    // --- REGISTRO DE PONTO (4 BATIDAS) ---
    socket.on('register-time', (data) => {
        const date = getFmtDate();
        const nowObj = new Date();
        const time = nowObj.toLocaleTimeString('pt-BR', {hour12: false});
        const dayWeek = nowObj.getDay();

        db.get('SELECT * FROM users WHERE cpf = ?', [data.cpf], async (err, user) => {
            if (!user) return socket.emit('auth-error', { message: 'CPF não encontrado.' });
            
            const match = await bcrypt.compare(data.password, user.password);
            if (!match) return socket.emit('auth-error', { message: 'Senha incorreta.' });

            if (user.role !== 'visitor') {
                db.get('SELECT * FROM user_schedules WHERE user_id = ? AND day_of_week = ?', [user.id, dayWeek], (err, sched) => {
                    if (!sched || !sched.entry_time) return socket.emit('auth-error', { message: 'Você não trabalha hoje.' });
                    processPonto(user, sched);
                });
            } else {
                processPonto(user, null);
            }

            function processPonto(u, sched) {
                db.all('SELECT * FROM time_records WHERE user_id = ? AND date = ? ORDER BY id ASC', [u.id, date], (err, recs) => {
                    const count = recs.length;
                    let type, status = 'no_horario', duration = null;

                    // Lógica 4 Pontos
                    if (count === 0) {
                        type = 'entrada';
                        if (sched && parseTime(time) > parseTime(sched.entry_time) + 10) status = 'atraso';
                    } else if (count === 1) {
                        type = 'saida_almoco';
                    } else if (count === 2) {
                        type = 'volta_almoco';
                        const saidaAlmoco = recs[1];
                        const diff = parseTime(time) - parseTime(saidaAlmoco.time);
                        if (diff > 65) status = 'atraso_almoco';
                    } else if (count === 3) {
                        type = 'saida';
                        if (sched && parseTime(time) < parseTime(sched.exit_time) - 10) return socket.emit('auth-error', {message: 'Saída antecipada.'});
                        const entrada = recs[0];
                        const almocoTime = parseTime(recs[2].time) - parseTime(recs[1].time);
                        duration = (parseTime(time) - parseTime(entrada.time)) - almocoTime;
                    } else {
                        return socket.emit('auth-error', { message: 'Ponto fechado.' });
                    }

                    if (u.role === 'visitor') status = 'visitante';

                    db.run('INSERT INTO time_records (user_id, date, time, type, status, work_duration) VALUES (?,?,?,?,?,?)',
                        [u.id, date, time, type, status, duration], () => {
                            socket.emit('auth-success', { message: `Registrado: ${type.toUpperCase()}` });
                            sendTodayRecords();
                            io.emit('refresh-data');
                        });
                });
            }
        });
    });

    // --- CADASTRO & UPDATE ---
    socket.on('register-user', async (data) => {
        db.get('SELECT * FROM users WHERE cpf = ?', [data.cpf], async (err, row) => {
            if (row) return socket.emit('user-register-error', {message: 'CPF já existe.'});
            const pwd = data.role === 'visitor' ? data.cpf : data.password;
            const hash = await bcrypt.hash(pwd, 10);
            const role = data.role || 'employee';

            db.run('INSERT INTO users (name, cpf, password, cargo, role) VALUES (?,?,?,?,?)', 
                [data.name, data.cpf, hash, data.cargo, role], function(err) {
                    if(err) return socket.emit('user-register-error', {message: 'Erro BD'});
                    if (role !== 'visitor' && data.schedule) {
                        const id = this.lastID;
                        const stmt = db.prepare('INSERT INTO user_schedules (user_id, day_of_week, entry_time, lunch_start, lunch_end, exit_time) VALUES (?,?,?,?,?,?)');
                        data.schedule.forEach(d => stmt.run(id, d.day_of_week, d.entryTime, d.lunchStart, d.lunchEnd, d.exitTime));
                        stmt.finalize();
                    }
                    socket.emit('user-registered', { message: 'Cadastrado!' });
                    io.emit('employees-list-update');
            });
        });
    });

    socket.on('update-user', async (data) => {
        db.run('UPDATE users SET name = ?, cargo = ?, role = ? WHERE id = ?', [data.name, data.cargo, data.role, data.id], async function(err) {
            if (data.password) {
                const h = await bcrypt.hash(data.password, 10);
                db.run('UPDATE users SET password = ? WHERE id = ?', [h, data.id]);
            }
            if (data.schedule) {
                db.serialize(() => {
                    const stmt = db.prepare('UPDATE user_schedules SET entry_time = ?, lunch_start = ?, lunch_end = ?, exit_time = ? WHERE user_id = ? AND day_of_week = ?');
                    data.schedule.forEach(d => stmt.run(d.entryTime, d.lunchStart, d.lunchEnd, d.exitTime, data.id, d.day_of_week));
                    stmt.finalize(() => { socket.emit('user-updated', { message: 'Atualizado!' }); io.emit('employees-list-update'); });
                });
            } else { socket.emit('user-updated', { message: 'Atualizado!' }); }
        });
    });

    // --- LEITURAS & HISTÓRICO COM DEBUG ---
    socket.on('get-records', sendTodayRecords);

    socket.on('get-employees', () => db.all('SELECT id,name,cpf,cargo,role FROM users', (err,r)=>socket.emit('employees-list', r||[])));

    socket.on('get-employee-details', (d) => {
        db.get('SELECT * FROM users WHERE id=?',[d.id],(e,u)=>{
            if(u) db.all('SELECT * FROM user_schedules WHERE user_id=?',[d.id],(e,s)=>socket.emit('employee-details',{user:u, schedule:s}));
        });
    });

    // 1. DASHBOARD (HOJE) - FALTAS
    socket.on('get-missing-users', () => {
        const today = getFmtDate();
        const dayWeek = new Date().getDay();
        
        console.log(`🔎 Dashboard: Buscando faltas para HOJE (${today}), Dia da semana: ${dayWeek}`);

        const q = `SELECT u.id, u.name, s.entry_time, s.exit_time 
                   FROM users u 
                   JOIN user_schedules s ON u.id = s.user_id 
                   WHERE (u.role='employee' OR u.role='admin') 
                   AND s.day_of_week=? 
                   AND s.entry_time != ''`; // Só busca quem tem horário de entrada preenchido

        db.all(q, [dayWeek], (err, users) => {
            console.log(`   -> Funcionários agendados para hoje: ${users ? users.length : 0}`);
            if(!users || users.length === 0) return io.emit('missing-users', []);

            db.all("SELECT user_id FROM time_records WHERE date = ?", [today], (err, recs) => {
                const present = new Set(recs.map(r => r.user_id));
                db.all("SELECT user_id, reason FROM certificates WHERE date = ?", [today], (err, certs) => {
                    const certMap = {}; if(certs) certs.forEach(c => certMap[c.user_id] = c.reason);
                    
                    const missing = users.filter(u => !present.has(u.id)).map(u => ({...u, isJustified: !!certMap[u.id], reason: certMap[u.id]}));
                    console.log(`   -> Faltantes encontrados: ${missing.length}`);
                    io.emit('missing-users', missing);
                });
            });
        });
    });

    // 2. HISTÓRICO - FALTAS
    socket.on('get-history', (data) => {
        if(!data.date) return;
        const [y, m, d] = data.date.split('-');
        const fmtDate = `${d}/${m}/${y}`;
        
        // Envia registros normais
        db.all('SELECT tr.*, u.name as userId, u.role FROM time_records tr JOIN users u ON tr.user_id = u.id WHERE tr.date = ?', [fmtDate], (err, r) => socket.emit('time-records', r||[]));
        
        // Calcula dia da semana da data histórica
        const targetDate = new Date(y, m-1, d, 12, 0, 0);
        const dayWeek = targetDate.getDay();

        console.log(`📜 Histórico: Buscando faltas para ${fmtDate} (Dia ${dayWeek})`);

        const query = `
            SELECT u.id, u.name, s.entry_time, s.exit_time 
            FROM users u 
            JOIN user_schedules s ON u.id = s.user_id 
            WHERE (u.role = 'employee' OR u.role = 'admin') 
            AND s.day_of_week = ? 
            AND s.entry_time != ''
        `;

        db.all(query, [dayWeek], (err, users) => {
            console.log(`   -> Funcionários agendados neste dia: ${users ? users.length : 0}`);
            if(!users || users.length === 0) {
                // Importante: Se ninguém trabalha nesse dia, manda lista vazia para limpar a tela
                socket.emit('missing-users', []); 
                return;
            }

            db.all("SELECT user_id FROM time_records WHERE date = ?", [fmtDate], (err, recs) => {
                const present = new Set(recs.map(r => r.user_id));
                db.all("SELECT user_id, reason FROM certificates WHERE date = ?", [fmtDate], (err, certs) => {
                    const certMap = {}; if(certs) certs.forEach(c => certMap[c.user_id] = c.reason);
                    
                    const missing = users.filter(u => !present.has(u.id)).map(u => ({...u, isJustified: !!certMap[u.id], reason: certMap[u.id]}));
                    socket.emit('missing-users', missing);
                });
            });
        });
    });

    // Login Admin
    socket.on('admin-login', (d) => {
        db.get('SELECT * FROM users WHERE cpf = ?', [d.cpf], async (err, u) => {
             if(u && await bcrypt.compare(d.password, u.password) && u.role === 'admin') 
                socket.emit('admin-login-success', { user: {name: u.name}, message: 'OK' });
             else socket.emit('admin-login-error', {message: 'Login inválido'});
        });
    });

    // Relatórios
    socket.on('get-monthly-report', (d) => {
         if(!d.monthYear) return;
         const [m,y] = d.monthYear.split('-'); const pat = `%/${m}/${y}`;
         const q = `SELECT u.id, u.name, COALESCE(SUM(tr.work_duration),0) as total_minutes, (SELECT COUNT(*) FROM certificates c WHERE c.user_id=u.id AND c.date LIKE ?) as certs_count FROM users u LEFT JOIN time_records tr ON u.id=tr.user_id AND tr.date LIKE ? WHERE (u.role!='visitor' OR u.role IS NULL) GROUP BY u.id`;
         db.all(q,[pat,pat],(e,r)=> socket.emit('monthly-report-data', r ? r.map(x=>({...x, total_hours: x.total_minutes?(x.total_minutes/60).toFixed(2):0})) : []));
    });

    socket.on('register-certificate', (d) => {
        db.run('INSERT INTO certificates (user_id,date,reason) VALUES (?,?,?)',[d.userId,d.date,d.reason],()=>{
            socket.emit('certificate-registered',{message:'OK'}); io.emit('refresh-data');
        });
    });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`🚀 Servidor com Logs rodando na porta ${PORT}`));