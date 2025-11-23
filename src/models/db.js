const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Ajuste o caminho conforme sua estrutura. 
// Se este arquivo está em 'models/db.js', ele salva na raiz do projeto.
const dbPath = path.resolve(__dirname, '../database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err.message);
    } else {
        console.log('✅ Conectado ao banco de dados SQLite.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // 1. Tabela de Usuários (Com coluna 'role' para Admin/Visitante)
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                cpf TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                cargo TEXT,
                role TEXT DEFAULT 'employee' -- Pode ser: 'admin', 'employee', 'visitor'
            )
        `);

        // 2. Tabela de Horários (Apenas para Funcionários)
        db.run(`
            CREATE TABLE IF NOT EXISTS user_schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                day_of_week INTEGER, -- 0=Dom, 1=Seg...
                entry_time TEXT,
                exit_time TEXT,
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
                type TEXT,     -- 'entrada' ou 'saida'
                status TEXT,   -- 'no_horario', 'atraso', 'visitante'
                work_duration INTEGER, -- em minutos
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `);

        // 4. NOVO: Tabela de Atestados
        db.run(`
            CREATE TABLE IF NOT EXISTS certificates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                date TEXT,      -- DD/MM/AAAA
                reason TEXT,    -- Motivo
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `);
    });
}

module.exports = db;