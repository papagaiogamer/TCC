const socket = io();

// =====================
// Funções do Modal
// =====================
function openModal() {
    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById('registerModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.getElementById('registerModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    document.getElementById('registerForm').reset();
    document.getElementById('registerMessage').textContent = '';
    document.getElementById('registerMessage').className = '';
}

document.getElementById('modalOverlay').addEventListener('click', closeModal);

// =====================
// Registro de Usuário
// =====================
function submitForm() {
    const newUser = {
        name: document.getElementById('newName').value,
        cpf: document.getElementById('newCpf').value,
        password: document.getElementById('newPassword').value,
        entryTime: document.getElementById('entryTime').value,
        exitTime: document.getElementById('exitTime').value
    };

    if (!newUser.name || !newUser.cpf || !newUser.password || !newUser.entryTime || !newUser.exitTime) {
        const messageDiv = document.getElementById('registerMessage');
        messageDiv.textContent = 'Preencha todos os campos!';
        messageDiv.className = 'error';
        return;
    }
    
    socket.emit('register-user', newUser);
}

// ==========================================
// NOVO: Lógica de Navegação (Sidebar)
// ==========================================
const navDashboard = document.getElementById('nav-dashboard');
const navHistory = document.getElementById('nav-history');
const historyControlsBox = document.getElementById('history-controls-box');
const historyDateInput = document.getElementById('historyDate');
const headerTitle = document.querySelector('.header h1'); // Seleciona o H1 do header

// Função para mostrar a view do DASHBOARD (HOJE)
function showDashboardView() {
    historyControlsBox.style.display = 'none'; // Esconde o seletor de data
    headerTitle.textContent = 'Dashboard'; // Muda o título
    
    // Atualiza classes ativas
    navDashboard.classList.add('active');
    navHistory.classList.remove('active');
    
    // Carrega os dados de HOJE (null)
    loadDataForDate(null);
}

// Função para mostrar a view de HISTÓRICO
function showHistoryView() {
    historyControlsBox.style.display = 'block'; // Mostra o seletor de data
    headerTitle.textContent = 'Histórico'; // Muda o título
    
    // Atualiza classes ativas
    navDashboard.classList.remove('active');
    navHistory.classList.add('active');
    
    // Carrega os dados da data selecionada (ou hoje, se nada selecionado)
    const selectedDate = historyDateInput.value;
    loadDataForDate(selectedDate || getTodayYYYYMMDD()); // Carrega hoje se vazio
}

// Adiciona os cliques nos links da sidebar
navDashboard.addEventListener('click', (e) => {
    e.preventDefault();
    showDashboardView();
});

navHistory.addEventListener('click', (e) => {
    e.preventDefault();
    showHistoryView();
});

// =================================================
// Helpers de Data e Carregamento de Dados
// =================================================

// Retorna a data de hoje formatada como 'YYYY-MM-DD'
function getTodayYYYYMMDD() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Retorna a data formatada como 'DD/MM/YYYY'
function formatToDDMMYYYY(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

// Função central para carregar dados (Hoje ou Histórico)
// Esta função NÃO precisa de alterações.
function loadDataForDate(dateStr) {
    const recordsTitle = document.getElementById('recordsTitle');
    const missingTitle = document.getElementById('missingTitle');
    const btnReset = document.getElementById('btnResetDate');
    const dateInput = document.getElementById('historyDate');

    if (!dateStr || dateStr === getTodayYYYYMMDD()) {
        // Carrega dados de HOJE
        recordsTitle.textContent = 'Registros de Ponto (Hoje)';
        missingTitle.textContent = 'Usuários que ainda não bateram ponto (Hoje)';
        btnReset.style.display = 'none'; // Esconde o botão de resetar
        if (dateInput.value !== getTodayYYYYMMDD()) {
            dateInput.value = ''; // Limpa o input se estamos vendo hoje
        }
        
        socket.emit('get-records');
        socket.emit('get-missing-users');
    } else {
        // Carrega HISTÓRICO
        const displayDate = formatToDDMMYYYY(dateStr);
        recordsTitle.textContent = `Registros de Ponto (${displayDate})`;
        missingTitle.textContent = `Usuários que não bateram ponto (${displayDate})`;
        btnReset.style.display = 'inline-block'; // Mostra o botão de resetar
        
        socket.emit('get-history', { date: dateStr });
    }
}

// =====================
// Funções de Formatação e Atualização de Tabelas
// (Sem alterações aqui)
// =====================

function formatDuration(totalMinutes) {
    if (totalMinutes === null || totalMinutes === undefined) {
        return '—';
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const paddedMinutes = String(minutes).padStart(2, '0');
    return `${hours}h ${paddedMinutes}m`;
}

function updateRecordsList(records) {
    const tbody = document.getElementById('recordsList');
    tbody.innerHTML = '';

    if (!records || records.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="6" style="text-align:center; color:gray;">Nenhum ponto registrado na data selecionada.</td>`;
        tbody.appendChild(row);
        return;
    }

    records.forEach(record => {
        const row = document.createElement('tr');
        const typeClass = record.type === 'entrada' ? 'entrada' : 'saida';
        const typeLabel = record.type === 'entrada' ? 'Entrada' : 'Saída';

        let statusLabel = '—';
        let statusClass = 'na'; 
        if (record.type === 'entrada') {
            if (record.status === 'atraso') {
                statusLabel = 'Atraso';
                statusClass = 'atraso';
            } else if (record.status === 'no_horario') {
                statusLabel = 'No horário';
                statusClass = 'no-horario';
            }
        }
        
        const durationLabel = record.type === 'saida' ? formatDuration(record.work_duration) : '—';
        const durationClass = record.type === 'saida' ? 'duration' : 'na';

        row.innerHTML = `
            <td>${record.userId}</td>
            <td>${record.date}</td>
            <td>${record.time}</td>
            <td class="${typeClass}">${typeLabel}</td>
            <td class="${statusClass}">${statusLabel}</td> 
            <td class="${durationClass}">${durationLabel}</td>
        `;
        tbody.appendChild(row);
    });
}

function updateMissingUsersList(users) {
    const tbody = document.getElementById('missingUsersList');
    tbody.innerHTML = '';

    if (!users || users.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="3" style="text-align:center; color:gray;">Todos os usuários bateram ponto na data selecionada 🎉</td>`;
        tbody.appendChild(row);
        return;
    }

    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.name}</td>
            <td>${user.entry_time}</td>
            <td>${user.exit_time}</td>
        `;
        tbody.appendChild(row);
    });
}

// =====================
// Eventos Socket.IO
// =====================

// Conexão inicial
socket.on('connect', () => {
    // MODIFICADO: Carrega a view do Dashboard por padrão
    showDashboardView(); 
});

// Novo usuário cadastrado
socket.on('user-registered', (response) => {
    const messageDiv = document.getElementById('registerMessage');
    messageDiv.textContent = response.message;
    messageDiv.className = 'success';
    
    setTimeout(() => {
        document.getElementById('registerForm').reset();
        closeModal();
        // Recarrega os dados da view atual (seja hoje ou histórico)
        if (navDashboard.classList.contains('active')) {
            loadDataForDate(null);
        } else {
            loadDataForDate(historyDateInput.value);
        }
    }, 800);
});

socket.on('user-register-error', (response) => {
    const messageDiv = document.getElementById('registerMessage');
    messageDiv.textContent = response.message;
    messageDiv.className = 'error';
});

// Atualização em tempo real dos registros
socket.on('time-records', (records) => {
    // Este evento agora é usado tanto para 'hoje' quanto para 'histórico'
    updateRecordsList(records);
});

socket.on('time-registered', (records) => {
    // Este evento só dispara quando ALGUÉM BATE O PONTO (não no histórico)
    
    // Só atualiza em tempo real se o usuário estiver vendo o DASHBOARD (HOJE)
    if (navDashboard.classList.contains('active')) {
        updateRecordsList(records);
        socket.emit('get-missing-users'); // Atualiza lista de ausentes
    }
});

// Atualização da lista de ausentes
socket.on('missing-users', (users) => {
    // Este evento agora é usado tanto para 'hoje' quanto para 'histórico'
    updateMissingUsersList(users);
});

// ==========================================
// Event Listeners para Histórico (Sem alterações)
// ==========================================
document.getElementById('historyDate').addEventListener('change', (e) => {
    const selectedDate = e.target.value;
    if (selectedDate) {
        loadDataForDate(selectedDate);
    }
});

document.getElementById('btnResetDate').addEventListener('click', () => {
    // Carrega os dados de hoje
    loadDataForDate(null);
});

// =====================
// Estilos Visuais (Sem alterações)
// =====================
const style = document.createElement('style');
style.innerHTML = `
    td.entrada {
        color: green;
        font-weight: bold;
    }
    td.saida {
        color: red;
        font-weight: bold;
    }
    td.atraso {
        color: #b35900; /* Laranja escuro */
        font-weight: bold;
    }
    td.no-horario {
        color: #555;
    }
    td.na {
        color: #999;
    }
    td.duration {
        font-weight: bold;
        color: #0969da; /* Azul */
    }

    /* NOVO: Estilo para o input de data */
    .input-date {
        /* Reutiliza o estilo dos inputs normais */
        width: 100%;
        padding: 6px 12px;
        font-size: 14px;
        border: 1px solid var(--color-border-default);
        border-radius: 6px;
        background-color: var(--color-canvas-default);
        box-shadow: var(--color-primer-shadow-inset);
        transition: border-color 0.15s, box-shadow 0.15s;
    }
    .input-date:focus {
        border-color: var(--color-accent-fg);
        outline: none;
        box-shadow: 0 0 0 3px rgba(9,105,218,0.3);
    }
`;
document.head.appendChild(style);