import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';

function AdminLogin() {
  const socket = useSocket();
  const navigate = useNavigate();
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // CORREÇÃO DE LAYOUT: Remove o estilo de Sidebar desta página
  useEffect(() => {
    document.body.classList.remove('dashboard-layout');
    // Coloca de volta quando sair desta página
    return () => document.body.classList.add('dashboard-layout');
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('admin-login-success', (data) => {
      localStorage.setItem('adminToken', 'true');
      localStorage.setItem('adminName', data.user.name);
      navigate('/dashboard');
    });

    socket.on('admin-login-error', (data) => {
      setError(data.message);
    });

    return () => {
      socket.off('admin-login-success');
      socket.off('admin-login-error');
    };
  }, [socket, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    socket.emit('admin-login', { cpf, password });
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
      <div className="content-box" style={{ width: '100%', maxWidth: '400px', borderTop: '4px solid var(--primary-color)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '10px' }}>Acesso Administrativo</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem' }}>
          Gestão de Ponto e RH
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Login (CPF):</label>
            <input 
              type="text" 
              value={cpf} 
              onChange={(e) => setCpf(e.target.value)} 
              required 
              placeholder="Digite o usuário admin"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Senha:</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="Digite a senha"
            />
          </div>
          
          <button type="submit" className="primary" style={{ width: '100%', marginTop: '10px' }}>
            Entrar no Painel
          </button>
        </form>

        {error && (
          <div style={{ 
            marginTop: '20px', 
            padding: '12px', 
            borderRadius: '8px',
            backgroundColor: 'var(--danger-bg)',
            color: 'var(--danger-text)',
            textAlign: 'center',
            fontSize: '0.9rem',
            fontWeight: '500'
          }}>
            {error}
          </div>
        )}
        
        <div className="links" style={{ marginTop: '24px', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <a href="/login" style={{textDecoration: 'none', color: 'var(--text-secondary)', fontSize: '0.9rem'}}>
                ← Voltar para o Relógio de Ponto
            </a>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;