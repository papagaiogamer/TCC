const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const passport = require('passport');
const session = require('express-session');
const bcrypt = require('bcrypt');
const db = require('./models/db');

const app = express();
const server = http.createServer(app);

// Configuração do CORS para aceitar o React na porta 5173
const io = socketIO(server, {
    cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] }
});

app.use(express.json());
app.use(session({ secret: 'secret_key_segura', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// Helpers
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => done(err, user)));

const parseTime = (str) => { if(!str) return 0; const [h,m] = str.split(':').map(Number); return h*60+m; };
const getFmtDate = (d = new Date()) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;

// === BOOTSTRAP: CRIA ADMIN PADRÃO SE NÃO EXISTIR NINGUÉM ===
db.get("SELECT count(*) as count FROM users", async (err, row) => {
    if (row && row.count === 0) {
        const hash = await bcrypt.hash("admin", 10);
        db.run("INSERT INTO users (name, cpf, password, cargo, role) VALUES (?, ?, ?, ?, ?)", 
            ["Administrador Principal", "admin", hash, "Sistema", "admin"]);
        console.log("⚠️  BANCO VAZIO: Admin padrão criado (Login: admin / Senha: admin)");
    }
});

io.on('connection', (socket) => {
    console.log('🔗 Conectado:', socket.id);

    // ==========================================
    // 1. LOGIN DE ADMINISTRADOR
    // ==========================================
    socket.on('admin-login', (data) => {
        db.get('SELECT * FROM users WHERE cpf = ?', [data.cpf], async (err, user) => {
            if (!user) return socket.emit('admin-login-error', { message: 'Usuário não encontrado.' });
            
            const match = await bcrypt.compare(data.password, user.password);
            if (!match) return socket.emit('admin-login-error', { message: 'Senha incorreta.' });

            if (user.role !== 'admin') return socket.emit('admin-login-error', { message: 'Acesso negado: Apenas administradores.' });

            socket.emit('admin-login-success', { user: { name: user.name, role: user.role }, message: 'Bem-vindo!' });
        });
    });

    // ==========================================
    // 2. RELATÓRIOS MENSAIS (CORRIGIDO)
    // ==========================================
    socket.on('get-monthly-report', (data) => {
        if (!data.monthYear) return;
        
        console.log(`📊 Gerando relatório para: ${data.monthYear}`);

        // data.monthYear vem como "MM-YYYY" do front
        const [m, y] = data.monthYear.split('-');
        const pattern = `%/${m}/${y}`; // Busca datas que contenham "/MM/YYYY"

        // Query corrigida: Usa COALESCE para garantir que retorne 0 em vez de null
        const query = `
            SELECT 
                u.id, 
                u.name, 
                COALESCE(SUM(tr.work_duration), 0) as total_minutes,
                (SELECT COUNT(*) FROM certificates c WHERE c.user_id = u.id AND c.date LIKE ?) as certs_count
            FROM users u 
            LEFT JOIN time_records tr ON u.id = tr.user_id AND tr.date LIKE ?
            WHERE (u.role != 'visitor' OR u.role IS NULL)
            GROUP BY u.id
        `;
        
        db.all(query, [pattern, pattern], (err, rows) => {
            if (err) {
                console.error("❌ Erro no relatório:", err);
                return;
            }
            
            console.log(`✅ Relatório: ${rows.length} registros encontrados.`);

            const result = rows.map(r => ({ 
                ...r, 
                total_hours: r.total_minutes ? parseFloat((r.total_minutes/60).toFixed(2)) : 0 
            }));
            
            socket.emit('monthly-report-data', result);
        });
    });

    // ==========================================
    // 3. REGISTRO DE PONTO (COM VISITANTE)
    // ==========================================
    socket.on('register-time', (data) => {
        const date = getFmtDate();
        const time = new Date().toLocaleTimeString('pt-BR', {hour12: false});
        const dayWeek = new Date().getDay();

        db.get('SELECT * FROM users WHERE cpf = ?', [data.cpf], async (err, user) => {
            if (!user) return socket.emit('auth-error', { message: 'CPF não encontrado.' });
            
            const match = await bcrypt.compare(data.password, user.password);
            if (!match) return socket.emit('auth-error', { message: 'Senha incorreta.' });

            // Lógica de Agendamento
            if (user.role === 'employee' || user.role === 'admin') {
                db.get('SELECT * FROM user_schedules WHERE user_id = ? AND day_of_week = ?', [user.id, dayWeek], (err, sched) => {
                    if (!sched || !sched.entry_time) return socket.emit('auth-error', { message: 'Você não está agendado para hoje.' });
                    processPonto(user, sched);
                });
            } else {
                // Visitante: Ponto Livre
                processPonto(user, null); 
            }

            function processPonto(u, sched) {
                db.all('SELECT * FROM time_records WHERE user_id = ? AND date = ?', [u.id, date], (err, recs) => {
                    if (recs.length >= 2) return socket.emit('auth-error', { message: 'Ponto já fechado hoje.' });
                    
                    const type = recs.length === 0 ? 'entrada' : 'saida';
                    let status = u.role === 'visitor' ? 'visitante' : 'no_horario';
                    let duration = null;

                    if (sched) {
                        const now = parseTime(time);
                        if (type === 'entrada' && now > parseTime(sched.entry_time) + 10) status = 'atraso';
                        if (type === 'saida') {
                            if (now < parseTime(sched.exit_time) - 10) return socket.emit('auth-error', { message: `Muito cedo! Saída às ${sched.exit_time}.` });
                            duration = now - parseTime(recs[0].time);
                        }
                    } else if (type === 'saida' && recs[0]) {
                        duration = parseTime(time) - parseTime(recs[0].time);
                    }

                    db.run('INSERT INTO time_records (user_id, date, time, type, status, work_duration) VALUES (?,?,?,?,?,?)',
                        [u.id, date, time, type, status, duration], () => {
                            socket.emit('auth-success', { message: `Ponto de ${type} registrado!` });
                            io.emit('refresh-data'); // Manda todo mundo atualizar as telas
                        });
                });
            }
        });
    });

    // ==========================================
    // 4. CADASTRO DE USUÁRIOS
    // ==========================================
    socket.on('register-user', async (data) => {
        db.get('SELECT * FROM users WHERE cpf = ?', [data.cpf], async (err, row) => {
            if (row) return socket.emit('user-register-error', {message: 'CPF já existe.'});

            const pwd = data.role === 'visitor' ? data.cpf : data.password;
            const hash = await bcrypt.hash(pwd, 10);
            const role = data.role || 'employee';

            db.run('INSERT INTO users (name, cpf, password, cargo, role) VALUES (?,?,?,?,?)', 
                [data.name, data.cpf, hash, data.cargo, role], function(err) {
                    if(err) return socket.emit('user-register-error', {message: 'Erro no banco.'});
                    
                    if (role !== 'visitor' && data.schedule) {
                        const id = this.lastID;
                        const stmt = db.prepare('INSERT INTO user_schedules (user_id, day_of_week, entry_time, exit_time) VALUES (?,?,?,?)');
                        data.schedule.forEach(d => stmt.run(id, d.day_of_week, d.entryTime, d.exitTime));
                        stmt.finalize();
                    }
                    socket.emit('user-registered', { message: 'Cadastrado com sucesso!' });
                    io.emit('refresh-data');
            });
        });
    });

    // UPDATE USER
    socket.on('update-user', async (data) => {
        db.run('UPDATE users SET name = ?, cargo = ?, role = ? WHERE id = ?', 
            [data.name, data.cargo, data.role, data.id], 
            async function(err) {
            
            if (data.password && data.password.trim() !== '') {
                const hashedPassword = await bcrypt.hash(data.password, 10);
                db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, data.id]);
            }
            if (data.schedule) {
                db.serialize(() => {
                    const stmt = db.prepare('UPDATE user_schedules SET entry_time = ?, exit_time = ? WHERE user_id = ? AND day_of_week = ?');
                    data.schedule.forEach(day => stmt.run(day.entryTime, day.exitTime, data.id, day.day_of_week));
                    stmt.finalize(() => {
                        socket.emit('user-updated', { message: 'Atualizado!' });
                        io.emit('refresh-data');
                    });
                });
            } else {
                socket.emit('user-updated', { message: 'Atualizado!' });
                io.emit('refresh-data');
            }
        });
    });

    // ==========================================
    // 5. ATESTADOS
    // ==========================================
    socket.on('register-certificate', (data) => {
        db.run('INSERT INTO certificates (user_id, date, reason) VALUES (?,?,?)', [data.userId, data.date, data.reason], () => {
            socket.emit('certificate-registered', {message: 'Atestado salvo.'});
            io.emit('refresh-data'); // Atualiza a tela de faltas
        });
    });

    // ==========================================
    // 6. LISTA DE AUSENTES (GET MISSING USERS)
    // ==========================================
    socket.on('get-missing-users', () => {
        const today = getFmtDate();
        const dayWeek = new Date().getDay();
        
        // Pega usuários que são Employees/Admin E que têm horário hoje
        const query = `
            SELECT u.id, u.name, s.entry_time, s.exit_time 
            FROM users u 
            JOIN user_schedules s ON u.id = s.user_id 
            WHERE (u.role = 'employee' OR u.role = 'admin') 
            AND s.day_of_week = ? 
            AND s.entry_time != ''
        `;

        db.all(query, [dayWeek], (err, users) => {
            if(!users || users.length === 0) return socket.emit('missing-users', []);
            
            db.all("SELECT user_id FROM time_records WHERE date = ?", [today], (err, recs) => {
                const present = new Set(recs.map(r => r.user_id));
                
                db.all("SELECT user_id, reason FROM certificates WHERE date = ?", [today], (err, certs) => {
                    const certMap = {}; 
                    if(certs) certs.forEach(c => certMap[c.user_id] = c.reason);
                    
                    const missing = users
                        .filter(u => !present.has(u.id))
                        .map(u => ({
                            ...u, 
                            isJustified: !!certMap[u.id], 
                            reason: certMap[u.id]
                        }));
                        
                    socket.emit('missing-users', missing);
                });
            });
        });
    });

    // ==========================================
    // 7. LEITURAS GERAIS
    // ==========================================
    socket.on('get-records', () => {
        db.all('SELECT tr.*, u.name as userId, u.role FROM time_records tr JOIN users u ON tr.user_id = u.id WHERE tr.date = ?', [getFmtDate()], (err, r) => socket.emit('time-records', r||[]));
    });

    socket.on('get-employees', () => {
        db.all('SELECT id, name, cpf, cargo, role FROM users', (err, r) => socket.emit('employees-list', r||[]));
    });

    socket.on('get-employee-details', (data) => {
        db.get('SELECT * FROM users WHERE id = ?', [data.id], (err, user) => {
            if(user) {
                db.all('SELECT * FROM user_schedules WHERE user_id = ?', [data.id], (err, s) => socket.emit('employee-details', {user, schedule: s}));
            }
        });
    });

    socket.on('get-history', (data) => {
        if(!data.date) return;
        const [y, m, d] = data.date.split('-');
        const fmtDate = `${d}/${m}/${y}`;
        
        db.all('SELECT tr.*, u.name as userId, u.role FROM time_records tr JOIN users u ON tr.user_id = u.id WHERE tr.date = ?', [fmtDate], (err, r) => socket.emit('time-records', r||[]));
        
        // Lógica de Faltas no Histórico
        const targetDate = new Date(y, m-1, d, 12, 0, 0);
        const dayWeek = targetDate.getDay();

        const query = `
            SELECT u.id, u.name, s.entry_time, s.exit_time 
            FROM users u 
            JOIN user_schedules s ON u.id = s.user_id 
            WHERE (u.role = 'employee' OR u.role = 'admin') 
            AND s.day_of_week = ? 
            AND s.entry_time != ''
        `;

        db.all(query, [dayWeek], (err, users) => {
            if(!users) return;
            db.all("SELECT user_id FROM time_records WHERE date = ?", [fmtDate], (err, recs) => {
                const present = new Set(recs.map(r => r.user_id));
                db.all("SELECT user_id, reason FROM certificates WHERE date = ?", [fmtDate], (err, certs) => {
                    const certMap = {}; 
                    if(certs) certs.forEach(c => certMap[c.user_id] = c.reason);
                    
                    const missing = users
                        .filter(u => !present.has(u.id))
                        .map(u => ({...u, isJustified: !!certMap[u.id], reason: certMap[u.id]}));
                    
                    socket.emit('missing-users', missing);
                });
            });
        });
    });

    // Gatilho genérico para atualizar frontend
    socket.on('trigger-refresh', () => io.emit('refresh-data'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Servidor Final rodando na porta ${PORT}`));