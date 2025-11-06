const socket = io();

// NOVO: Variável global para rastrear a edição
let currentEditUserId = null; 

// =====================
// Funções do Modal (MODIFICADAS)
// =====================
function openModal() {
    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById('registerModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.getElementById('registerModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    document.getElementById('registerForm').reset();
    document.getElementById('registerMessage').textContent = '';
    document.getElementById('registerMessage').className = '';

    // NOVO: Reseta o modo de edição ao fechar
    currentEditUserId = null;
    document.querySelector('.modal-title').textContent = 'Registrar Novo Funcionário';
    document.querySelector('.modal-footer .primary').textContent = 'Registrar';
    
    // Habilita campos de CPF/Senha (caso tenham sido desabilitados na edição)
    document.getElementById('newCpf').disabled = false;
    document.getElementById('newPassword').disabled = false;
}

document.getElementById('modalOverlay').addEventListener('click', closeModal);

// =====================
// Registro e Edição (MODIFICADO)
// =====================
function submitForm() {
    // 1. Coleta dados básicos
    const userData = {
        name: document.getElementById('newName').value,
        cpf: document.getElementById('newCpf').value,
        password: document.getElementById('newPassword').value,
        cargo: document.getElementById('newCargo').value
    };

    // 2. Validação
    if (!userData.name || !userData.cpf) {
        const messageDiv = document.getElementById('registerMessage');
        messageDiv.textContent = 'Nome e CPF são obrigatórios!';
        messageDiv.className = 'error';
        return;
    }
    // Validação de senha SÓ no cadastro
    if (!currentEditUserId && !userData.password) {
         const messageDiv = document.getElementById('registerMessage');
        messageDiv.textContent = 'A senha é obrigatória para novos cadastros!';
        messageDiv.className = 'error';
        return;
    }

    // 3. Coleta a jornada de trabalho
    const schedule = [];
    for (let i = 0; i < 7; i++) {
        const entryTime = document.getElementById(`entry-${i}`).value;
        const exitTime = document.getElementById(`exit-${i}`).value;
        schedule.push({
            day_of_week: i,
            entryTime: entryTime || null,
            exitTime: exitTime || null
        });
    }

    // 4. Monta o objeto final
    const dataToSend = {
        ...userData,
        schedule: schedule
    };

    // 5. Decide se é CADASTRO ou EDIÇÃO
    if (currentEditUserId) {
        // --- MODO EDIÇÃO ---
        dataToSend.id = currentEditUserId; // Adiciona o ID para o servidor saber quem atualizar
        socket.emit('update-user', dataToSend);
    } else {
        // --- MODO CADASTRO ---
        socket.emit('register-user', dataToSend);
    }
}

// ==========================================
// Lógica de Navegação (Sidebar) (Sem mudanças)
// ==========================================
const navDashboard = document.getElementById('nav-dashboard');
// ... (todo o resto da lógica de navegação 'showDashboardView', 'showHistoryView', etc. continua igual) ...
const navHistory = document.getElementById('nav-history');
const navEmployees = document.getElementById('nav-employees');
const dashboardView = document.getElementById('dashboard-view');
const employeesView = document.getElementById('employees-view');
const historyControlsBox = document.getElementById('history-controls-box');
const headerTitle = document.querySelector('.header h1');

function showDashboardView() {
    dashboardView.style.display = 'block';
    employeesView.style.display = 'none';
    historyControlsBox.style.display = 'none';
    headerTitle.textContent = 'Dashboard';
    navDashboard.classList.add('active');
    navHistory.classList.remove('active');
    navEmployees.classList.remove('active');
    loadDataForDate(null);
}
function showHistoryView() {
    dashboardView.style.display = 'block';
    employeesView.style.display = 'none';
    historyControlsBox.style.display = 'block';
    headerTitle.textContent = 'Histórico';
    navDashboard.classList.remove('active');
    navHistory.classList.add('active');
    navEmployees.classList.remove('active');
    const selectedDate = document.getElementById('historyDate').value;
    loadDataForDate(selectedDate || getTodayYYYYMMDD());
}
function showEmployeesView() {
    dashboardView.style.display = 'none';
    employeesView.style.display = 'block';
    headerTitle.textContent = 'Funcionários';
    navDashboard.classList.remove('active');
    navHistory.classList.remove('active');
    navEmployees.classList.add('active');
    loadEmployees();
}
navDashboard.addEventListener('click', (e) => { e.preventDefault(); showDashboardView(); });
navHistory.addEventListener('click', (e) => { e.preventDefault(); showHistoryView(); });
navEmployees.addEventListener('click', (e) => { e.preventDefault(); showEmployeesView(); });

// =================================================
// Helpers de Data e Carregamento (Sem mudanças)
// =================================================
function getTodayYYYYMMDD() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
function formatToDDMMYYYY(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}
function loadDataForDate(dateStr) {
    // ... (código idêntico) ...
    const recordsTitle = document.getElementById('recordsTitle');
    const missingTitle = document.getElementById('missingTitle');
    const btnReset = document.getElementById('btnResetDate');
    const dateInput = document.getElementById('historyDate');
    if (!dateStr || dateStr === getTodayYYYYMMDD()) {
        recordsTitle.textContent = 'Registros de Ponto (Hoje)';
        missingTitle.textContent = 'Usuários que ainda não bateram ponto (Hoje)';
        btnReset.style.display = 'none';
        if (dateInput.value !== getTodayYYYYMMDD()) { dateInput.value = ''; }
        socket.emit('get-records');
        socket.emit('get-missing-users');
    } else {
        const displayDate = formatToDDMMYYYY(dateStr);
        recordsTitle.textContent = `Registros de Ponto (${displayDate})`;
        missingTitle.textContent = `Usuários que não bateram ponto (${displayDate})`;
        btnReset.style.display = 'inline-block';
        socket.emit('get-history', { date: dateStr });
    }
}

// =====================
// Funções de Formatação de Tabelas (Sem mudanças)
// =====================
function formatDuration(totalMinutes) {
    // ... (código idêntico) ...
    if (totalMinutes === null || totalMinutes === undefined) { return '—'; }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const paddedMinutes = String(minutes).padStart(2, '0');
    return `${hours}h ${paddedMinutes}m`;
}
function updateRecordsList(records) {
    // ... (código idêntico) ...
    const tbody = document.getElementById('recordsList');
    tbody.innerHTML = '';
    if (!records || records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:gray;">Nenhum ponto registrado na data selecionada.</td></tr>';
        return;
    }
    records.forEach(record => {
        const row = document.createElement('tr');
        const typeClass = record.type === 'entrada' ? 'entrada' : 'saida';
        const typeLabel = record.type === 'entrada' ? 'Entrada' : 'Saída';
        let statusLabel = '—', statusClass = 'na';
        if (record.type === 'entrada') {
            if (record.status === 'atraso') { statusLabel = 'Atraso'; statusClass = 'atraso'; }
            else if (record.status === 'no_horario') { statusLabel = 'No horário'; statusClass = 'no-horario'; }
        }
        const durationLabel = record.type === 'saida' ? formatDuration(record.work_duration) : '—';
        const durationClass = record.type === 'saida' ? 'duration' : 'na';
        row.innerHTML = `<td>${record.userId}</td> <td>${record.date}</td> <td>${record.time}</td> <td class="${typeClass}">${typeLabel}</td> <td class="${statusClass}">${statusLabel}</td> <td class="${durationClass}">${durationLabel}</td>`;
        tbody.appendChild(row);
    });
}
function updateMissingUsersList(users) {
    // ... (código idêntico) ...
    const tbody = document.getElementById('missingUsersList');
    tbody.innerHTML = '';
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:gray;">Todos os usuários bateram ponto na data selecionada 🎉</td></tr>';
        return;
    }
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${user.name}</td> <td>${user.entry_time}</td> <td>${user.exit_time}</td>`;
        tbody.appendChild(row);
    });
}

// ==========================================
// Funções da View de Funcionários (MODIFICADO)
// ==========================================
function loadEmployees() {
    socket.emit('get-employees');
}
function updateEmployeesList(employees) {
    // ... (código idêntico) ...
    const tbody = document.getElementById('employeesList');
    tbody.innerHTML = '';
    if (!employees || employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:gray;">Nenhum funcionário cadastrado.</td></tr>';
        return;
    }
    employees.forEach(emp => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${emp.name}</td>
            <td>${emp.cpf}</td>
            <td>${emp.cargo || '—'}</td>
            <td>
                <button class="secondary small" onclick="editEmployee(${emp.id})">Editar</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// NOVO: Função chamada pelo botão "Editar"
function editEmployee(id) {
    if (!id) return;
    // Pede ao servidor os dados completos deste usuário
    socket.emit('get-employee-details', { id });
}

// =====================
// Eventos Socket.IO (MODIFICADOS)
// =====================
socket.on('connect', () => { showDashboardView(); });

socket.on('user-registered', (response) => {
    const messageDiv = document.getElementById('registerMessage');
    messageDiv.textContent = response.message;
    messageDiv.className = 'success';
    setTimeout(() => {
        closeModal();
        loadEmployees(); // Recarrega a lista de funcionários
    }, 800);
});

socket.on('user-register-error', (response) => {
    // ... (código idêntico) ...
    const messageDiv = document.getElementById('registerMessage');
    messageDiv.textContent = response.message;
    messageDiv.className = 'error';
});

// NOVO: Feedback da atualização (edição)
socket.on('user-updated', (response) => {
    // Usa o mesmo 'registerMessage' para feedback
    const messageDiv = document.getElementById('registerMessage'); 
    messageDiv.textContent = response.message;
    messageDiv.className = 'success';
    setTimeout(() => {
        closeModal();
        loadEmployees(); // Recarrega a lista
    }, 800);
});

socket.on('time-records', (records) => { updateRecordsList(records); });
socket.on('time-registered', (records) => {
    if (dashboardView.style.display === 'block') {
        updateRecordsList(records);
        socket.emit('get-missing-users');
    }
});
socket.on('missing-users', (users) => { updateMissingUsersList(users); });
socket.on('employees-list', (employees) => { updateEmployeesList(employees); });


// NOVO: Recebe os dados do funcionário para editar
socket.on('employee-details', (data) => {
    if (!data.user) {
        alert('Erro: Não foi possível carregar os dados deste funcionário.');
        return;
    }

    const { user, schedule } = data;

    // 1. Preenche os dados básicos
    document.getElementById('newName').value = user.name;
    document.getElementById('newCpf').value = user.cpf;
    document.getElementById('newCpf').disabled = true; // CPF não pode ser editado
    document.getElementById('newPassword').value = ''; // Senha fica vazia
    document.getElementById('newPassword').placeholder = 'Deixe em branco para não alterar'; // Dica
    document.getElementById('newCargo').value = user.cargo || '';

    // 2. Preenche a jornada de trabalho
    schedule.forEach(day => {
        // Garante que 'null' vire uma string vazia '' para o input
        document.getElementById(`entry-${day.day_of_week}`).value = day.entry_time || '';
        document.getElementById(`exit-${day.day_of_week}`).value = day.exit_time || '';
    });

    // 3. Configura o modal para o "Modo de Edição"
    currentEditUserId = user.id; // Define o ID global
    document.querySelector('.modal-title').textContent = `Editar: ${user.name}`;
    document.querySelector('.modal-footer .primary').textContent = 'Salvar Alterações';

    // 4. Abre o modal
    openModal();
});


// ==========================================
// Event Listeners (Sem mudanças)
// ==========================================
document.getElementById('historyDate').addEventListener('change', (e) => {
    const selectedDate = e.target.value;
    if (selectedDate) { loadDataForDate(selectedDate); }
});
document.getElementById('btnResetDate').addEventListener('click', () => { loadDataForDate(null); });

// =====================
// Estilos Visuais (Sem mudanças)
// =====================
const style = document.createElement('style');
style.innerHTML = `
    td.entrada { color: green; font-weight: bold; }
    td.saida { color: red; font-weight: bold; }
    td.atraso { color: #b35900; font-weight: bold; }
    td.no-horario { color: #555; }
    td.na { color: #999; }
    td.duration { font-weight: bold; color: #0969da; }
    .input-date {
        width: 100%; padding: 6px 12px; font-size: 14px;
        border: 1px solid var(--color-border-default); border-radius: 6px;
        background-color: var(--color-canvas-default);
        box-shadow: var(--color-primer-shadow-inset);
        transition: border-color 0.15s, box-shadow 0.15s;
    }
    .input-date:focus {
        border-color: var(--color-accent-fg); outline: none;
        box-shadow: 0 0 0 3px rgba(9,105,218,0.3);
    }
`;
document.head.appendChild(style);