const socket = io();

// Funções do Modal
function openModal() {
    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById('registerModal').style.display = 'block';
    document.body.style.overflow = 'hidden'; // Impede rolagem do body
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.getElementById('registerModal').style.display = 'none';
    document.body.style.overflow = 'auto'; // Restaura rolagem do body
    document.getElementById('registerForm').reset();
    document.getElementById('registerMessage').textContent = '';
    document.getElementById('registerMessage').className = '';
}

// Fecha o modal se clicar fora dele
document.getElementById('modalOverlay').addEventListener('click', closeModal);

function submitForm() {
    const newUser = {
        name: document.getElementById('newName').value,
        cpf: document.getElementById('newCpf').value,
        password: document.getElementById('newPassword').value,
        entryTime: document.getElementById('entryTime').value,
        exitTime: document.getElementById('exitTime').value
    };

    // Validação básica
    if (!newUser.name || !newUser.cpf || !newUser.password || !newUser.entryTime || !newUser.exitTime) {
        const messageDiv = document.getElementById('registerMessage');
        messageDiv.textContent = 'Preencha todos os campos!';
        messageDiv.className = 'error';
        return;
    }
    
    socket.emit('register-user', newUser);
}

function updateRecordsList(records) {
    const tbody = document.getElementById('recordsList');
    tbody.innerHTML = '';
    
    records.forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${record.userId}</td>
            <td>${record.date}</td>
            <td>${record.time}</td>
        `;
        tbody.appendChild(row);
    });
}

// Socket.IO event listeners
socket.on('user-registered', (response) => {
    const messageDiv = document.getElementById('registerMessage');
    messageDiv.textContent = response.message;
    messageDiv.className = 'success';
    
    // Limpa o formulário e fecha o modal após 1.5 segundos
    setTimeout(() => {
        document.getElementById('registerForm').reset();
        closeModal();
    }, 1500);
});

socket.on('user-register-error', (response) => {
    const messageDiv = document.getElementById('registerMessage');
    messageDiv.textContent = response.message;
    messageDiv.className = 'error';
});

// Carrega os registros iniciais
socket.emit('get-records');

// Atualiza registros em tempo real
socket.on('time-records', (records) => {
    updateRecordsList(records);
});

socket.on('time-registered', (records) => {
    updateRecordsList(records);
});