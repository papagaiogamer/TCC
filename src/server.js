const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const passport = require('passport');
const session = require('express-session');
const bcrypt = require('bcrypt'); // Segurança de senha

const app = express();
const server = http.createServer(app);

// Configuração do CORS para aceitar o React
const io = socketIO(server, {
    cors: {
        origin: "http://localhost:5173", // URL do seu front-end Vite
        methods: ["GET", "POST"]
    }
});

// Middlewares
app.use(express.json());
// app.use(express.static(path.join(__dirname, 'public'))); // Opcional, já que estamos usando React separado
app.use(session({
    secret: 'sua_chave_secreta',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Banco de dados SQLite
const db = require('./models/db');

// Configuração do Passport (Serialização)
passport.serializeUser((user, done) => {
    done(null, user.id);
});
passport.deserializeUser((id, done) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
        done(err, user);
    });
});

/* Helper function para calcular minutos a partir de "HH:MM" */
function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60) + minutes;
}

/* Helper function para formatar data JS para DD/MM/AAAA */
const getFormattedDate = (dateObj) => {
    const d = dateObj || new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

// === SOCKET.IO ===
io.on('connection', (socket) => {
    console.log('🔗 Cliente conectado:', socket.id);

    // ===============================================
    // 1. REGISTRO DE USUÁRIO (COM BCRYPT)
    // ===============================================
    socket.on('register-user', async (data) => {
        db.get('SELECT * FROM users WHERE cpf = ?', [data.cpf], async (err, row) => {
            if (row) {
                socket.emit('user-register-error', { message: 'CPF já cadastrado!' });
                return;
            }

            try {
                // Criptografa a senha antes de salvar
                const hashedPassword = await bcrypt.hash(data.password, 10);

                db.run(
                    'INSERT INTO users (name, cpf, password, cargo) VALUES (?, ?, ?, ?)',
                    [data.name, data.cpf, hashedPassword, data.cargo],
                    function (err) {
                        if (err) {
                            socket.emit('user-register-error', { message: 'Erro ao registrar usuário!' });
                            return;
                        }
                        const newUserId = this.lastID;
                        const stmt = db.prepare('INSERT INTO user_schedules (user_id, day_of_week, entry_time, exit_time) VALUES (?, ?, ?, ?)');
                        
                        db.serialize(() => {
                            data.schedule.forEach(day => {
                                // Salva os horários (mesmo que vazios)
                                stmt.run(newUserId, day.day_of_week, day.entryTime, day.exitTime);
                            });
                            stmt.finalize();
                        });

                        socket.emit('user-registered', { message: 'Usuário registrado com sucesso!' });
                    }
                );
            } catch (error) {
                console.error(error);
                socket.emit('user-register-error', { message: 'Erro ao processar senha.' });
            }
        });
    });

    // ===============================================
    // 2. REGISTRO DE PONTO (LOGIN)
    // ===============================================
    socket.on('register-time', (data) => {
        const date = getFormattedDate(new Date()); // DD/MM/AAAA
        const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
        const dayOfWeek = new Date().getDay(); // 0 (Dom) a 6 (Sab)

        // Busca usuário pelo CPF
        db.get('SELECT * FROM users WHERE cpf = ?', [data.cpf], async (err, user) => {
            if (!user) {
                socket.emit('auth-error', { message: 'CPF não encontrado!' });
                return;
            }

            // Compara a senha enviada com o hash no banco
            const match = await bcrypt.compare(data.password, user.password);
            if (!match) {
                socket.emit('auth-error', { message: 'Senha incorreta!' });
                return;
            }

            // Verifica agendamento para hoje
            db.get('SELECT * FROM user_schedules WHERE user_id = ? AND day_of_week = ?', [user.id, dayOfWeek], (err, schedule) => {
                if (err || !schedule || !schedule.entry_time || schedule.entry_time.trim() === '') {
                    socket.emit('auth-error', { message: 'Você não está agendado para trabalhar hoje.' });
                    return;
                }

                // Verifica registros já existentes hoje
                db.all('SELECT * FROM time_records WHERE user_id = ? AND date = ?', [user.id, date], (err, records) => {
                    if (err) return socket.emit('auth-error', { message: 'Erro ao consultar registros!' });
                    
                    if (records.length >= 2) {
                        socket.emit('auth-error', { message: 'Você já registrou seus dois pontos hoje!' });
                        return;
                    }

                    const type = records.length === 0 ? 'entrada' : 'saida';
                    let status = null;
                    let workDuration = null;

                    // Lógica de Entrada (Atraso)
                    if (type === 'entrada') {
                        const entryTotal = parseTimeToMinutes(schedule.entry_time);
                        const currentTotal = parseTimeToMinutes(time);
                        status = currentTotal > entryTotal + 10 ? 'atraso' : 'no_horario';
                    } 
                    // Lógica de Saída (Cedo demais / Duração)
                    else if (type === 'saida') {
                        const currentTotal = parseTimeToMinutes(time);
                        const exitTotal = parseTimeToMinutes(schedule.exit_time);
                        
                        if (currentTotal < exitTotal - 10) {
                            return socket.emit('auth-error', { message: `Muito cedo! Saída apenas às ${schedule.exit_time}.` });
                        }
                        
                        const entryRecord = records[0];
                        if (entryRecord) {
                            workDuration = currentTotal - parseTimeToMinutes(entryRecord.time);
                        }
                    }

                    // Salva o registro
                    db.run(
                        'INSERT INTO time_records (user_id, date, time, type, status, work_duration) VALUES (?, ?, ?, ?, ?, ?)',
                        [user.id, date, time, type, status, workDuration],
                        function (err) {
                            if (err) return socket.emit('auth-error', { message: 'Erro ao salvar ponto!' });
                            
                            // Atualiza a tabela do Dashboard em tempo real
                            db.all('SELECT tr.*, u.name as userId FROM time_records tr JOIN users u ON tr.user_id = u.id WHERE tr.date = ?', [date], (err, recs) => {
                                io.emit('time-registered', recs);
                            });
                            // Força atualização da lista de ausentes
                            io.emit('get-missing-users-trigger');
                            
                            socket.emit('auth-success', { message: `Ponto de ${type} registrado com sucesso!` });
                        }
                    );
                });
            });
        });
    });

    // ===============================================
    // 3. DASHBOARD & DADOS
    // ===============================================

    // Lista de registros do dia
    socket.on('get-records', () => {
        const date = getFormattedDate(new Date());
        db.all('SELECT tr.*, u.name as userId FROM time_records tr JOIN users u ON tr.user_id = u.id WHERE tr.date = ?', [date], (err, records) => {
            socket.emit('time-records', records || []);
        });
    });

    // LISTA DE AUSENTES (Corrigido)
    const sendMissingUsers = (targetSocket, targetDateStr) => {
        let dateToCheck;
        let dayOfWeek;

        if (targetDateStr) {
            // Data do Histórico (YYYY-MM-DD -> DD/MM/AAAA)
            const [year, month, day] = targetDateStr.split('-');
            // Cria data ao meio-dia para pegar o dia da semana correto sem fuso horário
            const d = new Date(year, month - 1, day, 12, 0, 0); 
            dateToCheck = `${day}/${month}/${year}`;
            dayOfWeek = d.getDay();
        } else {
            // Data de Hoje
            dateToCheck = getFormattedDate(new Date());
            dayOfWeek = new Date().getDay();
        }

        console.log(`🔍 Buscando ausentes para: ${dateToCheck} (Dia: ${dayOfWeek})`);

        // 1. Pega todos os usuários e seus horários para ESSE dia da semana
        db.all(
            `SELECT u.id, u.name, s.entry_time, s.exit_time 
             FROM users u 
             LEFT JOIN user_schedules s ON u.id = s.user_id AND s.day_of_week = ?`, 
            [dayOfWeek], 
            (err, allUsers) => {
                if (err) return console.error(err);

                // 2. Filtra quem DEVERIA trabalhar (tem horário de entrada preenchido)
                const workingUsers = allUsers.filter(u => u.entry_time && u.entry_time.trim() !== '');

                // 3. Pega quem JÁ bateu ponto nessa data
                db.all('SELECT user_id FROM time_records WHERE date = ?', [dateToCheck], (err, records) => {
                    if (err) return console.error(err);
                    
                    const usersWithRecords = new Set(records.map(r => r.user_id));
                    
                    // 4. Quem deveria trabalhar - Quem já bateu ponto = Ausentes
                    const missingUsers = workingUsers.filter(u => !usersWithRecords.has(u.id));
                    
                    targetSocket.emit('missing-users', missingUsers);
                });
            }
        );
    };

    socket.on('get-missing-users', () => { sendMissingUsers(socket); });
    socket.on('get-missing-users-trigger', () => { sendMissingUsers(io); });

    // Histórico
    socket.on('get-history', (data) => {
        if (!data.date) return;
        const [year, month, day] = data.date.split('-');
        const formattedDate = `${day}/${month}/${year}`; // DD/MM/AAAA

        db.all(
            'SELECT tr.*, u.name as userId FROM time_records tr JOIN users u ON tr.user_id = u.id WHERE tr.date = ?',
            [formattedDate],
            (err, records) => {
                socket.emit('time-records', records || []);
            }
        );
        sendMissingUsers(socket, data.date); // Passa YYYY-MM-DD
    });

    // ===============================================
    // 4. FUNCIONÁRIOS
    // ===============================================
    socket.on('get-employees', () => {
        db.all('SELECT id, name, cpf, cargo FROM users', (err, rows) => socket.emit('employees-list', rows || []));
    });

    socket.on('get-employee-details', (data) => {
        const responseData = {};
        db.get('SELECT id, name, cpf, cargo FROM users WHERE id = ?', [data.id], (err, user) => {
            if (!user) return socket.emit('user-register-error', { message: 'Usuário não encontrado.' });
            
            responseData.user = user;
            db.all('SELECT * FROM user_schedules WHERE user_id = ? ORDER BY day_of_week ASC', [data.id], (err, sched) => {
                responseData.schedule = sched;
                socket.emit('employee-details', responseData);
            });
        });
    });

    socket.on('update-user', async (data) => {
        db.run('UPDATE users SET name = ?, cargo = ? WHERE id = ?', [data.name, data.cargo, data.id], async function(err) {
            if (err) return socket.emit('user-register-error', { message: 'Erro ao salvar.' });

            // Se enviou senha nova, atualiza com hash
            if (data.password && data.password.trim() !== '') {
                try {
                    const hashedPassword = await bcrypt.hash(data.password, 10);
                    db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, data.id]);
                } catch(e) { console.error(e); }
            }

            db.serialize(() => {
                const stmt = db.prepare('UPDATE user_schedules SET entry_time = ?, exit_time = ? WHERE user_id = ? AND day_of_week = ?');
                data.schedule.forEach(day => {
                    stmt.run(day.entryTime, day.exitTime, data.id, day.day_of_week);
                });
                stmt.finalize((err) => {
                    socket.emit('user-updated', { message: 'Funcionário atualizado com sucesso!' });
                });
            });
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor Seguro rodando na porta ${PORT}`);
});