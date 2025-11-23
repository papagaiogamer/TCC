import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

function Login() {
  const socket = useSocket();
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [type, setType] = useState('entrada');
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    document.body.classList.remove('dashboard-layout');
    return () => document.body.classList.add('dashboard-layout');
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('auth-error', (data) => setMessage({ text: data.message, type: 'error' }));
    socket.on('auth-success', (data) => {
      setMessage({ text: data.message, type: 'success' });
      setPassword('');
    });
    return () => {
      socket.off('auth-error');
      socket.off('auth-success');
    };
  }, [socket]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!socket) return;
    setMessage({ text: 'Registrando...', type: '' });
    socket.emit('register-time', { cpf, password, type });
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%' }}>
      <div className="content-box" style={{ width: '100%', maxWidth: '400px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Registro de Ponto</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="cpf">CPF:</label>
            <input type="text" id="cpf" required maxLength="11" placeholder="Digite seu CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="password">Senha:</label>
            <input type="password" id="password" required placeholder="Digite sua senha" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="type">Tipo de Ponto:</label>
            <select id="type" required value={type} onChange={(e) => setType(e.target.value)}>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
          </div>
          <button type="submit" style={{ width: '100%', marginTop: '10px' }}>Registrar Ponto</button>
        </form>
        {message.text && <div id="message" className={message.type}>{message.text}</div>}
        <div className="links" style={{ marginTop: '20px', textAlign: 'center' }}>
            <a href="/dashboard">Ir para Dashboard (Admin)</a>
        </div>
      </div>
    </div>
  );
}
export default Login;