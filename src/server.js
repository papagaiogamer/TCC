const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'sua_chave_secreta',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

const db = require('./models/db');

passport.serializeUser((user, done) => {
    done(null, user.id);
});
passport.deserializeUser((id, done) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
        done(err, user);
    });
});

io.on('connection', (socket) => {
    console.log('User connected');

    socket.on('register-user', (data) => {
        db.get('SELECT * FROM users WHERE cpf = ?', [data.cpf], (err, row) => {
            if (row) {
                socket.emit('user-register-error', { message: 'CPF já cadastrado!' });
                return;
            }
            db.run(
                'INSERT INTO users (name, cpf, password, entry_time, exit_time) VALUES (?, ?, ?, ?, ?)',
                [data.name, data.cpf, data.password, data.entryTime, data.exitTime],
                function (err) {
                    if (err) {
                        socket.emit('user-register-error', { message: 'Erro ao registrar usuário!' });
                    } else {
                        socket.emit('user-registered', { message: 'Usuário registrado com sucesso!' });
                        io.emit('get-missing-users');
                    }
                }
            );
        });
    });

    socket.on('register-time', (data) => {
        const date = new Date().toLocaleDateString('pt-BR');
        const time = new Date().toLocaleTimeString('pt-BR');

        db.get('SELECT * FROM users WHERE cpf = ? AND password = ?', [data.cpf, data.password], (err, user) => {
            if (!user) {
                socket.emit('auth-error', { message: 'CPF ou senha inválidos!' });
                return;
            }

            // Verifica quantos pontos já foram registrados no dia
            db.all('SELECT * FROM time_records WHERE user_id = ? AND date = ?', [user.id, date], (err, records) => {
                if (err) {
                    socket.emit('auth-error', { message: 'Erro ao consultar registros!' });
                    return;
                }

                if (records.length >= 2) {
                    socket.emit('auth-error', { message: 'Você já registrou seus dois pontos hoje!' });
                    return;
                }

                // Define o tipo automaticamente
                const type = records.length === 0 ? 'entrada' : 'saida';

                db.run(
                    'INSERT INTO time_records (user_id, date, time, type) VALUES (?, ?, ?, ?)',
                    [user.id, date, time, type],
                    function (err) {
                        if (err) {
                            socket.emit('auth-error', { message: 'Erro ao registrar ponto!' });
                            return;
                        }

                        // Atualiza registros do dia
                        db.all(
                            'SELECT tr.date, tr.time, tr.type, u.name as userId FROM time_records tr JOIN users u ON tr.user_id = u.id WHERE tr.date = ?',
                            [date],
                            (err, records) => {
                                io.emit('time-registered', records);
                                socket.emit('auth-success', { message: `Ponto de ${type} registrado com sucesso!` });
                            }
                        );

                        // Atualiza lista de usuários que não bateram ponto
                        db.all('SELECT id, name, entry_time, exit_time FROM users', (err, allUsers) => {
                            db.all('SELECT user_id FROM time_records WHERE date = ?', [date], (err, recs) => {
                                const usersWithRecords = new Set(recs.map(r => r.user_id));
                                const usersWithoutRecords = allUsers.filter(u => !usersWithRecords.has(u.id));
                                io.emit('missing-users', usersWithoutRecords);
                            });
                        });
                    }
                );
            });
        });
    });

    socket.on('get-records', () => {
        const date = new Date().toLocaleDateString('pt-BR');
        db.all(
            'SELECT tr.date, tr.time, tr.type, u.name as userId FROM time_records tr JOIN users u ON tr.user_id = u.id WHERE tr.date = ?',
            [date],
            (err, records) => {
                socket.emit('time-records', records);
            }
        );
    });

    socket.on('get-missing-users', () => {
        const date = new Date().toLocaleDateString('pt-BR');
        db.all('SELECT id, name, entry_time, exit_time FROM users', (err, allUsers) => {
            if (err) {
                console.error(err);
                return;
            }

            db.all('SELECT user_id FROM time_records WHERE date = ?', [date], (err, records) => {
                if (err) {
                    console.error(err);
                    return;
                }

                const usersWithRecords = new Set(records.map(r => r.user_id));
                const usersWithoutRecords = allUsers.filter(u => !usersWithRecords.has(u.id));
                socket.emit('missing-users', usersWithoutRecords);
            });
        });
    });
});

function ensureAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user && req.user.is_admin === 1) {
        return next();
    }
    res.redirect('/?auth=fail');
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
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
    console.log(`Server running on port ${PORT}`);
});
