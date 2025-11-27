const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Caminho do banco de dados (salvo na raiz do projeto)
const dbPath = path.resolve(__dirname, '../database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err.message);
    } else {
        console.log('✅ Banco de Dados Conectado.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // 1. Tabela de Usuários
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                cpf TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                cargo TEXT,
                role TEXT DEFAULT 'employee'
            )
        `);

        // 2. Tabela de Horários (ATUALIZADA COM ALMOÇO)
        db.run(`
            CREATE TABLE IF NOT EXISTS user_schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                day_of_week INTEGER, -- 0=Dom, 1=Seg...
                entry_time TEXT,     -- Entrada
                lunch_start TEXT,    -- Ida Almoço (NOVO)
                lunch_end TEXT,      -- Volta Almoço (NOVO)
                exit_time TEXT,      -- Saída
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `);

        // 3. Tabela de Registros de Ponto
        db.run(`
            CREATE TABLE IF NOT EXISTS time_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                date TEXT,     -- DD/MM/AAAA
                time TEXT,     -- HH:MM:SS
                type TEXT,     -- 'entrada', 'saida_almoco', 'volta_almoco', 'saida'
                status TEXT,   -- 'no_horario', 'atraso', 'atraso_almoco'
                work_duration INTEGER, -- em minutos
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `);

        // 4. Tabela de Atestados
        db.run(`
            CREATE TABLE IF NOT EXISTS certificates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                date TEXT,
                reason TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `);
    });
}

module.exports = db;