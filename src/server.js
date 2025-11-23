const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const passport = require('passport');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);

const io = socketIO(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

app.use(express.json());
app.use(session({ secret: 'sua_chave_secreta', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

const db = require('./models/db');

// Helpers
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => done(err, user)));

function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60) + minutes;
}

const getFormattedDate = (dateObj) => {
    const d = dateObj || new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

io.on('connection', (socket) => {
    console.log('🔗 Cliente conectado:', socket.id);

    // ===============================================
    // 1. REGISTRO (FUNCIONÁRIO E VISITANTE)
    // ===============================================
    socket.on('register-user', async (data) => {
        db.get('SELECT * FROM users WHERE cpf = ?', [data.cpf], async (err, row) => {
            if (row) return socket.emit('user-register-error', { message: 'CPF já cadastrado!' });

            try {
                // Se for visitante, a senha é o próprio CPF (para facilitar)
                // Se for funcionário, usa a senha enviada
                const plainPassword = data.role === 'visitor' ? data.cpf : data.password;
                const hashedPassword = await bcrypt.hash(plainPassword, 10);

                const role = data.role || 'employee'; // Padrão é employee

                db.run(
                    'INSERT INTO users (name, cpf, password, cargo, role) VALUES (?, ?, ?, ?, ?)',
                    [data.name, data.cpf, hashedPassword, data.cargo, role],
                    function (err) {
                        if (err) return socket.emit('user-register-error', { message: 'Erro ao registrar!' });
                        
                        // Só cria agenda se for FUNCIONÁRIO
                        if (role === 'employee' && data.schedule) {
                            const newUserId = this.lastID;
                            const stmt = db.prepare('INSERT INTO user_schedules (user_id, day_of_week, entry_time, exit_time) VALUES (?, ?, ?, ?)');
                            db.serialize(() => {
                                data.schedule.forEach(day => stmt.run(newUserId, day.day_of_week, day.entryTime, day.exitTime));
                                stmt.finalize();
                            });
                        }
                        socket.emit('user-registered', { message: role === 'visitor' ? 'Visitante liberado!' : 'Funcionário registrado!' });
                    }
                );
            } catch (error) {
                console.error(error);
                socket.emit('user-register-error', { message: 'Erro interno.' });
            }
        });
    });

    // ===============================================
    // 2. REGISTRO DE PONTO (LOGIN)
    // ===============================================
    socket.on('register-time', (data) => {
        const date = getFormattedDate(new Date());
        const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
        const dayOfWeek = new Date().getDay();

        db.get('SELECT * FROM users WHERE cpf = ?', [data.cpf], async (err, user) => {
            if (!user) return socket.emit('auth-error', { message: 'CPF não encontrado!' });

            const match = await bcrypt.compare(data.password, user.password);
            if (!match) return socket.emit('auth-error', { message: 'Senha incorreta!' });

            // Lógica Diferente para VISITANTES vs FUNCIONÁRIOS
            if (user.role === 'visitor') {
                // === VISITANTE (Ponto Livre) ===
                registrarPonto(user, date, time, null); // Null = sem schedule para validar
            } else {
                // === FUNCIONÁRIO (Valida Horário) ===
                db.get('SELECT * FROM user_schedules WHERE user_id = ? AND day_of_week = ?', [user.id, dayOfWeek], (err, schedule) => {
                    if (err || !schedule || !schedule.entry_time || schedule.entry_time.trim() === '') {
                        return socket.emit('auth-error', { message: 'Você não está agendado para hoje.' });
                    }
                    registrarPonto(user, date, time, schedule);
                });
            }
        });

        function registrarPonto(user, date, time, schedule) {
            db.all('SELECT * FROM time_records WHERE user_id = ? AND date = ?', [user.id, date], (err, records) => {
                if (records.length >= 2) return socket.emit('auth-error', { message: 'Já registrou entrada e saída hoje!' });

                const type = records.length === 0 ? 'entrada' : 'saida';
                let status = 'visitante'; // Padrão para visitante
                let workDuration = null;

                // Se tiver schedule (Funcionário), calcula atrasos
                if (schedule) {
                    if (type === 'entrada') {
                        const entryTotal = parseTimeToMinutes(schedule.entry_time);
                        const currentTotal = parseTimeToMinutes(time);
                        status = currentTotal > entryTotal + 10 ? 'atraso' : 'no_horario';
                    } else if (type === 'saida') {
                        const currentTotal = parseTimeToMinutes(time);
                        const exitTotal = parseTimeToMinutes(schedule.exit_time);
                        if (currentTotal < exitTotal - 10) {
                            return socket.emit('auth-error', { message: `Muito cedo! Saída apenas às ${schedule.exit_time}.` });
                        }
                        const entryRecord = records[0];
                        if (entryRecord) workDuration = currentTotal - parseTimeToMinutes(entryRecord.time);
                    }
                } else if (type === 'saida' && records[0]) {
                     // Visitante calculando duração
                     const currentTotal = parseTimeToMinutes(time);
                     const entryRecord = records[0];
                     workDuration = currentTotal - parseTimeToMinutes(entryRecord.time);
                }

                db.run(
                    'INSERT INTO time_records (user_id, date, time, type, status, work_duration) VALUES (?, ?, ?, ?, ?, ?)',
                    [user.id, date, time, type, status, workDuration],
                    function (err) {
                        if (err) return socket.emit('auth-error', { message: 'Erro ao salvar.' });
                        
                        // Atualiza Dashboards
                        db.all('SELECT tr.*, u.name as userId FROM time_records tr JOIN users u ON tr.user_id = u.id WHERE tr.date = ?', [date], (err, recs) => {
                            io.emit('time-registered', recs);
                        });
                        io.emit('get-missing-users-trigger'); // Atualiza ausentes
                        
                        socket.emit('auth-success', { message: `Ponto de ${type} registrado! (${user.role === 'visitor' ? 'Visitante' : 'Funcionário'})` });
                    }
                );
            });
        }
    });

    // ===============================================
    // 3. ATESTADOS (JUSTIFICATIVA DE FALTA)
    // ===============================================
    socket.on('register-certificate', (data) => {
        // data = { userId, date, reason }
        db.run(
            'INSERT INTO certificates (user_id, date, reason) VALUES (?, ?, ?)',
            [data.userId, data.date, data.reason],
            function(err) {
                if (err) return socket.emit('user-register-error', { message: 'Erro ao salvar atestado.' });
                
                // Avisa sucesso e força atualização da lista de ausentes
                socket.emit('certificate-registered', { message: 'Atestado registrado com sucesso!' });
                
                // Se a data do atestado for a que está sendo vista, atualiza a lista
                io.emit('get-missing-users-trigger'); 
            }
        );
    });

    // ===============================================
    // 4. LISTA DE AUSENTES (Com Atestado)
    // ===============================================
    const sendMissingUsers = (targetSocket, targetDateStr) => {
        let dateToCheck, dayOfWeek;

        if (targetDateStr) {
            const [year, month, day] = targetDateStr.split('-');
            const d = new Date(year, month - 1, day, 12, 0, 0); 
            dateToCheck = `${day}/${month}/${year}`;
            dayOfWeek = d.getDay();
        } else {
            dateToCheck = getFormattedDate(new Date());
            dayOfWeek = new Date().getDay();
        }

        // 1. Busca Funcionários que trabalham nesse dia
        db.all(
            `SELECT u.id, u.name, s.entry_time, s.exit_time 
             FROM users u 
             LEFT JOIN user_schedules s ON u.id = s.user_id AND s.day_of_week = ?
             WHERE u.role = 'employee'`, // Apenas funcionários podem "faltar"
            [dayOfWeek], 
            (err, allUsers) => {
                if (err) return;
                const workingUsers = allUsers.filter(u => u.entry_time && u.entry_time.trim() !== '');

                // 2. Busca quem bateu ponto
                db.all('SELECT user_id FROM time_records WHERE date = ?', [dateToCheck], (err, records) => {
                    const usersWithRecords = new Set(records.map(r => r.user_id));

                    // 3. Busca quem tem ATESTADO
                    db.all('SELECT user_id, reason FROM certificates WHERE date = ?', [dateToCheck], (err, certs) => {
                        const certMap = {}; // Mapa ID -> Motivo
                        certs.forEach(c => certMap[c.user_id] = c.reason);

                        // 4. Monta a lista final
                        const missingList = workingUsers
                            .filter(u => !usersWithRecords.has(u.id)) // Quem não foi
                            .map(u => ({
                                ...u,
                                isJustified: !!certMap[u.id], // Tem atestado?
                                reason: certMap[u.id] || null
                            }));

                        targetSocket.emit('missing-users', missingList);
                    });
                });
            }
        );
    };

    socket.on('get-missing-users', () => { sendMissingUsers(socket); });
    socket.on('get-missing-users-trigger', () => { sendMissingUsers(io); });

    // ===============================================
    // 5. DEMAIS ROTAS (Histórico, Funcionários...)
    // ===============================================
    socket.on('get-records', () => {
        const date = getFormattedDate(new Date());
        db.all('SELECT tr.*, u.name as userId, u.role FROM time_records tr JOIN users u ON tr.user_id = u.id WHERE tr.date = ?', [date], (err, records) => {
            socket.emit('time-records', records || []);
        });
    });

    socket.on('get-history', (data) => {
        if (!data.date) return;
        const [year, month, day] = data.date.split('-');
        const formattedDate = `${day}/${month}/${year}`;
        db.all('SELECT tr.*, u.name as userId, u.role FROM time_records tr JOIN users u ON tr.user_id = u.id WHERE tr.date = ?', [formattedDate], (err, r) => socket.emit('time-records', r));
        sendMissingUsers(socket, data.date);
    });

    socket.on('get-employees', () => {
        db.all('SELECT id, name, cpf, cargo, role FROM users', (err, rows) => socket.emit('employees-list', rows || []));
    });

    socket.on('get-employee-details', (data) => {
        const responseData = {};
        db.get('SELECT * FROM users WHERE id = ?', [data.id], (err, user) => {
            if (!user) return;
            responseData.user = user;
            db.all('SELECT * FROM user_schedules WHERE user_id = ? ORDER BY day_of_week ASC', [data.id], (err, sched) => {
                responseData.schedule = sched;
                socket.emit('employee-details', responseData);
            });
        });
    });

    socket.on('update-user', async (data) => { /* Mesma lógica de atualização anterior */ 
        db.run('UPDATE users SET name = ?, cargo = ? WHERE id = ?', [data.name, data.cargo, data.id], async function(err) {
            if (data.password && data.password.trim() !== '') {
                const hashedPassword = await bcrypt.hash(data.password, 10);
                db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, data.id]);
            }
            if (data.schedule) { // Só atualiza schedule se vier no pacote
                db.serialize(() => {
                    const stmt = db.prepare('UPDATE user_schedules SET entry_time = ?, exit_time = ? WHERE user_id = ? AND day_of_week = ?');
                    data.schedule.forEach(day => stmt.run(day.entryTime, day.exitTime, data.id, day.day_of_week));
                    stmt.finalize(() => socket.emit('user-updated', { message: 'Atualizado!' }));
                });
            } else {
                socket.emit('user-updated', { message: 'Atualizado!' });
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor com Visitantes e Atestados na porta ${PORT}`);
});