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

passport.serializeUser((user, done) => {
    done(null, user.id);
});
passport.deserializeUser((id, done) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
        done(err, user);
    });
});


// Socket.IO connection
io.on('connection', (socket) => {
    console.log('User connected');

    socket.on('register-user', (data) => {
        db.get('SELECT * FROM users WHERE cpf = ?', [data.cpf], (err, row) => {
            if (row) {
                socket.emit('user-register-error', { message: 'CPF já cadastrado!' });
                return;
            }
            db.run('INSERT INTO users (name, cpf, password, entry_time, exit_time) VALUES (?, ?, ?, ?, ?)', [data.name, data.cpf, data.password, data.entryTime, data.exitTime], function(err) {
                if (err) {
                    socket.emit('user-register-error', { message: 'Erro ao registrar usuário!' });
                } else {
                    socket.emit('user-registered', { message: 'Usuário registrado com sucesso!' });
                }
            });
        });
    });

    socket.on('register-time', (data) => {
        db.get('SELECT * FROM users WHERE cpf = ? AND password = ?', [data.cpf, data.password], (err, user) => {
            if (user) {
                const date = new Date().toLocaleDateString();
                const time = new Date().toLocaleTimeString();
                // Verifica se é ponto de saída
                if (data.type === 'saida') {
                    // Compara horário atual com horário de saída cadastrado
                    if (time < user.exit_time) {
                        socket.emit('auth-error', { message: 'Horário de saída não permitido! Aguarde até ' + user.exit_time });
                        return;
                    }
                }
                db.run('INSERT INTO time_records (user_id, date, time) VALUES (?, ?, ?)', [user.id, date, time], function(err) {
                    if (err) {
                        socket.emit('auth-error', { message: 'Erro ao registrar ponto!' });
                        return;
                    }
                    // Buscar todos os registros do dia
                    db.all('SELECT tr.date, tr.time, u.name as userId FROM time_records tr JOIN users u ON tr.user_id = u.id WHERE tr.date = ?', [date], (err, records) => {
                        io.emit('time-registered', records);
                        socket.emit('auth-success', { message: 'Ponto registrado com sucesso!' });
                    });
                });
            } else {
                socket.emit('auth-error', { message: 'CPF ou senha inválidos!' });
            }
        });
    });

    socket.on('get-records', () => {
        const date = new Date().toLocaleDateString();
        db.all('SELECT tr.date, tr.time, u.name as userId FROM time_records tr JOIN users u ON tr.user_id = u.id WHERE tr.date = ?', [date], (err, records) => {
            socket.emit('time-records', records);
        });
    });
});

function ensureAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user && req.user.is_admin === 1) {
        return next();
    }
    res.redirect('/?auth=fail');
}

// Routes
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