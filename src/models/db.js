const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../database.sqlite');
const db = new sqlite3.Database(dbPath);

// Criação das tabelas
const createTables = () => {
    // Tabela de usuários
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        cpf TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        cargo TEXT,
        email TEXT,
        is_admin INTEGER DEFAULT 0
    )`);

    // NOVA TABELA: Horários dos usuários
    db.run(`CREATE TABLE IF NOT EXISTS user_schedules (
        user_id INTEGER NOT NULL,
        day_of_week INTEGER NOT NULL, -- 0=Domingo, 1=Segunda, ..., 6=Sábado
        entry_time TEXT,
        exit_time TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, day_of_week)
    )`);

    // Tabela de registros de ponto
    db.run(`CREATE TABLE IF NOT EXISTS time_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        type TEXT CHECK(type IN ('entrada', 'saida')) NOT NULL DEFAULT 'entrada',
        status TEXT DEFAULT NULL,
        work_duration INTEGER DEFAULT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`, (err) => {
        if (err) {
            console.error('Erro ao criar tabela time_records:', err);
        } else {
            console.log('Tabelas verificadas/criadas com sucesso.');
        }
    });
};

createTables();

module.exports = db;