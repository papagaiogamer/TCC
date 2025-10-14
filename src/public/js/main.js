const socket = io();

document.getElementById('timeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const cpf = document.getElementById('cpf').value;
    const password = document.getElementById('password').value;
    const type = document.getElementById('type').value;
    socket.emit('register-time', { cpf, password, type });
});

socket.on('auth-success', (data) => {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = data.message;
    messageDiv.className = 'success';
    document.getElementById('timeForm').reset();
});

socket.on('auth-error', (data) => {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = data.message;
    messageDiv.className = 'error';
});