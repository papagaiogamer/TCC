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

/* ================================================= */
/* MODIFICADO: Função 'updateRecordsList' atualizada */
/* ================================================= */
function updateRecordsList(records) {
    const tbody = document.getElementById('recordsList');
    tbody.innerHTML = '';

    if (!records || records.length === 0) {
        const row = document.createElement('tr');
        /* MODIFICADO: colspan atualizado de 4 para 5 */
        row.innerHTML = `<td colspan="5" style="text-align:center; color:gray;">Nenhum ponto registrado hoje.</td>`;
        tbody.appendChild(row);
        return;
    }

    records.forEach(record => {
        const row = document.createElement('tr');
        const typeClass = record.type === 'entrada' ? 'entrada' : 'saida';
        const typeLabel = record.type === 'entrada' ? 'Entrada' : 'Saída';

        /* NOVO: Lógica para exibir o status */
        let statusLabel = '—'; // Padrão (para saídas)
        let statusClass = 'na'; // 'na' = Not Applicable

        if (record.type === 'entrada') {
            if (record.status === 'atraso') {
                statusLabel = 'Atraso';
                statusClass = 'atraso';
            } else if (record.status === 'no_horario') {
                statusLabel = 'No horário';
                statusClass = 'no-horario';
            }
        }
        /* FIM DA NOVA LÓGICA */

        /* MODIFICADO: Adicionada a nova célula de status */
        row.innerHTML = `
            <td>${record.userId}</td>
            <td>${record.date}</td>
            <td>${record.time}</td>
            <td class="${typeClass}">${typeLabel}</td>
            <td class="${statusClass}">${statusLabel}</td> 
        `;
        tbody.appendChild(row);
    });
}
/* ================================================= */
/* FIM DA MODIFICAÇÃO                                */
/* ================================================= */


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

/* MODIFICADO: Adicionados estilos para o status */
style.innerHTML = `
    td.entrada {
        color: green;
        font-weight: bold;
    }
    td.saida {
        color: red;
        font-weight: bold;
    }

    /* ================== */
    /* NOVOS ESTILOS      */
    /* ================== */
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
`;
document.head.appendChild(style);