import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import Clock from '../components/Clock'; // Importando o relógio

function Login() {
  const socket = useSocket();
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  // Ajuste de Layout (Remove a sidebar nesta página)
  useEffect(() => {
    document.body.classList.remove('dashboard-layout');
    return () => document.body.classList.add('dashboard-layout');
  }, []);

  // Listeners do Socket
  useEffect(() => {
    if (!socket) return;

    socket.on('auth-success', (data) => {
      setMessage({ text: data.message, type: 'success' });
      setPassword(''); // Limpa a senha para o próximo
    });

    socket.on('auth-error', (data) => {
      setMessage({ text: data.message, type: 'error' });
    });

    return () => {
      socket.off('auth-success');
      socket.off('auth-error');
    };
  }, [socket]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!socket) return;
    
    setMessage({ text: 'Processando...', type: '' });
    
    // Enviamos apenas CPF e Senha.
    // O servidor decide se é Entrada, Almoço ou Saída.
    socket.emit('register-time', { cpf, password });
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh', 
      width: '100%',
      backgroundColor: 'var(--bg-body)' 
    }}>
      <div className="content-box" style={{ width: '100%', maxWidth: '420px', padding: '32px' }}>
        
        {/* RELÓGIO EM TEMPO REAL */}
        <Clock />

        <h1 style={{ textAlign: 'center', fontSize: '1.5rem', marginBottom: '10px' }}>Registro de Ponto</h1>
        <p style={{ textAlign: 'center', marginBottom: '25px', color: 'var(--text-secondary)' }}>
          Digite suas credenciais
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="cpf">CPF:</label>
            <input 
              type="text" 
              id="cpf"
              required 
              maxLength="11" 
              placeholder="Apenas números" 
              value={cpf} 
              onChange={(e) => setCpf(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Senha (ou CPF para Visitantes):</label>
            <input 
              type="password" 
              id="password"
              required 
              placeholder="Digite sua senha" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>

          <button type="submit" className="primary" style={{ width: '100%', marginTop: '15px', padding: '12px' }}>
            Registrar Ponto
          </button>
        </form>

        {/* Mensagens de Erro ou Sucesso */}
        {message.text && (
          <div style={{
            marginTop: '20px',
            padding: '12px',
            borderRadius: '8px',
            textAlign: 'center',
            fontWeight: '600',
            backgroundColor: message.type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)',
            color: message.type === 'error' ? 'var(--danger-text)' : 'var(--success-text)'
          }}>
            {message.text}
          </div>
        )}

        <div style={{ marginTop: '30px', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <a href="/admin-login" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontSize: '0.9rem' }}>
               Sou Administrador
            </a>
        </div>
      </div>
    </div>
  );
}

export default Login;