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

// =====================
// Atualização das Tabelas
// =====================
function updateRecordsList(records) {
    const tbody = document.getElementById('recordsList');
    tbody.innerHTML = '';

    if (!records || records.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="4" style="text-align:center; color:gray;">Nenhum ponto registrado hoje.</td>`;
        tbody.appendChild(row);
        return;
    }

    records.forEach(record => {
        const row = document.createElement('tr');
        const typeClass = record.type === 'entrada' ? 'entrada' : 'saida';
        const typeLabel = record.type === 'entrada' ? 'Entrada' : 'Saída';

        row.innerHTML = `
            <td>${record.userId}</td>
            <td>${record.date}</td>
            <td>${record.time}</td>
            <td class="${typeClass}">${typeLabel}</td>
        `;
        tbody.appendChild(row);
    });
}

function updateMissingUsersList(users) {
    const tbody = document.getElementById('missingUsersList');
    tbody.innerHTML = '';

    if (!users || users.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="3" style="text-align:center; color:gray;">Todos os usuários bateram ponto hoje 🎉</td>`;
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
    socket.emit('get-records');
    socket.emit('get-missing-users');
});

// Novo usuário cadastrado
socket.on('user-registered', (response) => {
    const messageDiv = document.getElementById('registerMessage');
    messageDiv.textContent = response.message;
    messageDiv.className = 'success';
    
    setTimeout(() => {
        document.getElementById('registerForm').reset();
        closeModal();
        socket.emit('get-missing-users'); // atualiza lista
    }, 800);
});

socket.on('user-register-error', (response) => {
    const messageDiv = document.getElementById('registerMessage');
    messageDiv.textContent = response.message;
    messageDiv.className = 'error';
});

// Atualização em tempo real dos registros
socket.on('time-records', (records) => {
    updateRecordsList(records);
});

socket.on('time-registered', (records) => {
    updateRecordsList(records);
    socket.emit('get-missing-users'); // Atualiza lista de ausentes ao registrar ponto
});

// Atualização da lista de ausentes
socket.on('missing-users', (users) => {
    updateMissingUsersList(users);
});

// =====================
// Estilos Visuais
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
`;
document.head.appendChild(style);
