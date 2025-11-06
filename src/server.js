const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const passport = require('passport');
// const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'sua_chave_secreta',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Banco de dados SQLite
const db = require('./models/db');

// Configuração do Passport (sem mudanças)
passport.serializeUser((user, done) => {
    done(null, user.id);
});
passport.deserializeUser((id, done) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
        done(err, user);
    });
});

/* Helper function para calcular tempo */
function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60) + minutes;
}

// === SOCKET.IO ===
io.on('connection', (socket) => {
    console.log('🔗 Cliente conectado');

    // ===================================
    // Registrar novo usuário (sem mudanças)
    // ===================================
    socket.on('register-user', (data) => {
        db.get('SELECT * FROM users WHERE cpf = ?', [data.cpf], (err, row) => {
            if (row) {
                socket.emit('user-register-error', { message: 'CPF já cadastrado!' });
                return;
            }

            db.run(
                'INSERT INTO users (name, cpf, password, cargo) VALUES (?, ?, ?, ?)',
                [data.name, data.cpf, data.password, data.cargo],
                function (err) {
                    if (err) {
                        socket.emit('user-register-error', { message: 'Erro ao registrar usuário!' });
                        return;
                    }
                    const newUserId = this.lastID;
                    const stmt = db.prepare('INSERT INTO user_schedules (user_id, day_of_week, entry_time, exit_time) VALUES (?, ?, ?, ?)');
                    
                    db.serialize(() => {
                        data.schedule.forEach(day => {
                            stmt.run(newUserId, day.day_of_week, day.entryTime, day.exitTime);
                        });
                        stmt.finalize();
                    });

                    socket.emit('user-registered', { message: 'Usuário registrado com sucesso!' });
                }
            );
        });
    });

    // ===================================
    // Registrar ponto (sem mudanças)
    // ===================================
    socket.on('register-time', (data) => {
        const date = new Date().toLocaleDateString('pt-BR');
        const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
        const dayOfWeek = new Date().getDay();

        db.get('SELECT * FROM users WHERE cpf = ? AND password = ?', [data.cpf, data.password], (err, user) => {
            if (!user) {
                socket.emit('auth-error', { message: 'CPF ou senha inválidos!' });
                return;
            }

            db.get('SELECT * FROM user_schedules WHERE user_id = ? AND day_of_week = ?', [user.id, dayOfWeek], (err, schedule) => {
                if (err || !schedule || !schedule.entry_time) {
                    socket.emit('auth-error', { message: 'Você não está agendado para trabalhar hoje.' });
                    return;
                }

                db.all('SELECT * FROM time_records WHERE user_id = ? AND date = ?', [user.id, date], (err, records) => {
                    if (err) {
                        socket.emit('auth-error', { message: 'Erro ao consultar registros!' });
                        return;
                    }
                    if (records.length >= 2) {
                        socket.emit('auth-error', { message: 'Você já registrou seus dois pontos hoje!' });
                        return;
                    }

                    const type = records.length === 0 ? 'entrada' : 'saida';
                    let status = null;
                    let workDuration = null;

                    if (type === 'entrada') {
                        const entryTotalMinutes = parseTimeToMinutes(schedule.entry_time);
                        const currentTotalMinutes = parseTimeToMinutes(time);
                        const tolerance = 10;
                        if (currentTotalMinutes > entryTotalMinutes + tolerance) {
                            status = 'atraso';
                        } else {
                            status = 'no_horario';
                        }
                    }

                    if (type === 'saida') {
                        const currentTotalMinutes = parseTimeToMinutes(time);
                        const exitTotalMinutes = parseTimeToMinutes(schedule.exit_time);
                        const tolerance = 10;
                        if (currentTotalMinutes < exitTotalMinutes - tolerance) {
                            socket.emit('auth-error', {
                                message: `⏰ Você só pode registrar saída a partir de ${schedule.exit_time} (tolerância de ${tolerance} minutos).`
                            });
                            return;
                        }
                        const entryRecord = records[0];
                        if (entryRecord && entryRecord.type === 'entrada') {
                            const entryTimeInMinutes = parseTimeToMinutes(entryRecord.time);
                            const exitTimeInMinutes = parseTimeToMinutes(time);
                            workDuration = exitTimeInMinutes - entryTimeInMinutes;
                        }
                    }

                    db.run(
                        'INSERT INTO time_records (user_id, date, time, type, status, work_duration) VALUES (?, ?, ?, ?, ?, ?)',
                        [user.id, date, time, type, status, workDuration],
                        function (err) {
                            if (err) {
                                socket.emit('auth-error', { message: 'Erro ao registrar ponto!' });
                                return;
                            }
                            db.all(
                                'SELECT tr.date, tr.time, tr.type, tr.status, tr.work_duration, u.name as userId FROM time_records tr JOIN users u ON tr.user_id = u.id WHERE tr.date = ?',
                                [date],
                                (err, records) => {
                                    io.emit('time-registered', records);
                                    socket.emit('auth-success', { message: `Ponto de ${type} registrado com sucesso!` });
                                }
                            );
                            io.emit('get-missing-users-trigger');
                        }
                    );
                });
            });
        });
    });

    // ===================================
    // Handlers de dados (sem mudanças)
    // ===================================
    socket.on('get-records', () => {
        const date = new Date().toLocaleDateString('pt-BR');
        db.all(
            'SELECT tr.date, tr.time, tr.type, tr.status, tr.work_duration, u.name as userId FROM time_records tr JOIN users u ON tr.user_id = u.id WHERE tr.date = ?',
            [date],
            (err, records) => {
                socket.emit('time-records', records);
            }
        );
    });

    const sendMissingUsers = (targetSocket, targetDate) => {
        const isToday = !targetDate || targetDate === new Date().toLocaleDateString('pt-BR');
        let dayOfWeek;
        if (isToday) {
            dayOfWeek = new Date().getDay();
        } else {
            const [day, month, year] = targetDate.split('/');
            const histDate = new Date(`${year}-${month}-${day}T12:00:00`);
            dayOfWeek = histDate.getDay();
        }
        const date = targetDate || new Date().toLocaleDateString('pt-BR');

        db.all(
            'SELECT u.id, u.name, s.entry_time, s.exit_time FROM users u LEFT JOIN user_schedules s ON u.id = s.user_id AND s.day_of_week = ?', 
            [dayOfWeek], 
            (err, allUsers) => {
            if (err) return console.error(err);
            const workingUsers = allUsers.filter(u => u.entry_time);
            db.all('SELECT user_id FROM time_records WHERE date = ?', [date], (err, records) => {
                if (err) return console.error(err);
                const usersWithRecords = new Set(records.map(r => r.user_id));
                const usersWithoutRecords = workingUsers.filter(u => !usersWithRecords.has(u.id));
                targetSocket.emit('missing-users', usersWithoutRecords);
            });
        });
    };
    socket.on('get-missing-users', () => { sendMissingUsers(socket); });
    socket.on('get-missing-users-trigger', () => { sendMissingUsers(io); });

    socket.on('get-history', (data) => {
        if (!data.date) return;
        const [year, month, day] = data.date.split('-');
        const formattedDate = `${day}/${month}/${year}`;
        db.all(
            'SELECT tr.date, tr.time, tr.type, tr.status, tr.work_duration, u.name as userId FROM time_records tr JOIN users u ON tr.user_id = u.id WHERE tr.date = ?',
            [formattedDate],
            (err, records) => {
                if (err) return;
                socket.emit('time-records', records);
            }
        );
        sendMissingUsers(socket, formattedDate);
    });

    socket.on('get-employees', () => {
        db.all('SELECT id, name, cpf, cargo FROM users', (err, employees) => {
            if (err) return console.error("Erro ao buscar funcionários:", err);
            socket.emit('employees-list', employees);
        });
    });

    // ===================================
    // NOVO: Handlers de Edição
    // ===================================

    // 1. Busca os dados de um funcionário para o modal
    socket.on('get-employee-details', (data) => {
        const responseData = {};
        
        // Query 1: Pega dados do usuário
        db.get('SELECT id, name, cpf, cargo FROM users WHERE id = ?', [data.id], (err, user) => {
            if (err || !user) {
                console.error("Erro ao buscar usuário para edição:", err);
                return socket.emit('user-register-error', { message: 'Erro ao carregar dados.' });
            }
            responseData.user = user;

            // Query 2: Pega a jornada de trabalho
            db.all('SELECT * FROM user_schedules WHERE user_id = ? ORDER BY day_of_week ASC', [data.id], (err, schedule) => {
                if (err) {
                    console.error("Erro ao buscar jornada:", err);
                    return socket.emit('user-register-error', { message: 'Erro ao carregar dados.' });
                }
                responseData.schedule = schedule;
                
                // Envia a resposta completa
                socket.emit('employee-details', responseData);
            });
        });
    });

    // 2. Salva os dados atualizados do funcionário
    socket.on('update-user', (data) => {
        // 'data' contém: id, name, cargo, password, schedule[]
        
        // 1. Atualiza a tabela 'users' (Nome e Cargo)
        db.run(
            'UPDATE users SET name = ?, cargo = ? WHERE id = ?',
            [data.name, data.cargo, data.id],
            function(err) {
                if (err) return socket.emit('user-register-error', { message: 'Erro ao salvar (etapa 1).' });

                // 2. Atualiza a senha (SÓ SE uma nova foi digitada)
                if (data.password && data.password.trim() !== '') {
                    db.run('UPDATE users SET password = ? WHERE id = ?', [data.password, data.id], (err) => {
                       if (err) return socket.emit('user-register-error', { message: 'Erro ao salvar senha.' });
                    });
                }
                
                // 3. Atualiza a tabela 'user_schedules'
                db.serialize(() => {
                    const stmt = db.prepare(
                        'UPDATE user_schedules SET entry_time = ?, exit_time = ? WHERE user_id = ? AND day_of_week = ?'
                    );
                    data.schedule.forEach(day => {
                        stmt.run(day.entryTime, day.exitTime, data.id, day.day_of_week);
                    });
                    
                    // 4. Finaliza e envia feedback
                    stmt.finalize((err) => {
                        if (err) return socket.emit('user-register-error', { message: 'Erro ao salvar jornada.' });
                        
                        socket.emit('user-updated', { message: 'Funcionário atualizado com sucesso!' });
                    });
                });
            }
        );
    });

});

// Rotas (sem mudanças)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    // AQUI DEVERIA IR A SUA LÓGICA DE AUTENTICAÇÃO
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', {
    failureRedirect: '/?auth=fail'
}), (req, res) => {
    res.redirect('/dashboard');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});