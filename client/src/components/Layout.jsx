import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';

function Layout() {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const adminName = localStorage.getItem('adminName') || 'Admin';

  // 1. Carrega o tema salvo ao iniciar
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.getElementById('html-tag').setAttribute('data-theme', 'dark');
    }
  }, []);

  // 2. Função para alternar o tema
  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    
    const theme = newMode ? 'dark' : 'light';
    document.getElementById('html-tag').setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  };

  // 3. Função de Logout
  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminName');
    navigate('/admin-login');
  };

  return (
    <>
      {/* Barra Lateral */}
      <nav className="sidebar">
        <div>
          <div className="sidebar-header">
            <h3>Painel Admin</h3>
            <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px'}}>
              Olá, {adminName}
            </p>
          </div>
          <ul className="sidebar-menu">
            <li>
              <NavLink to="/dashboard" end>Dashboard</NavLink>
            </li>
            <li>
              <NavLink to="/historico">Histórico & Faltas</NavLink>
            </li>
            <li>
              <NavLink to="/funcionarios">Gestão de Usuários</NavLink>
            </li>
            {/* NOVO LINK */}
            <li>
              <NavLink to="/relatorios">Relatórios Mensais</NavLink>
            </li>
          </ul>
        </div>
        
        {/* Rodapé da Sidebar */}
        <div className="sidebar-footer">
          
          {/* Interruptor de Tema */}
          <div className="theme-switch-wrapper" style={{marginBottom: '15px'}}>
            <span>Tema Escuro</span>
            <label className="theme-switch" htmlFor="theme-toggle">
              <input 
                type="checkbox" 
                id="theme-toggle"
                onChange={toggleTheme}
                checked={isDarkMode} 
              />
              <span className="slider"></span>
            </label>
          </div>

          {/* Botão de Sair */}
          <button 
            onClick={handleLogout} 
            className="secondary" 
            style={{width: '100%', color: '#ef4444', borderColor: '#ef4444'}}
          >
            Sair do Painel
          </button>

          <div style={{marginTop: '15px', textAlign: 'center', fontSize: '0.8rem'}}>
             <a href="/login" style={{color: 'var(--text-secondary)', textDecoration: 'none'}}>Ir p/ Relógio de Ponto</a>
          </div>

        </div>
      </nav>

      {/* Conteúdo Principal */}
      <main className="main-content">
        <header className="header">
          <h1>Sistema de Ponto Digital</h1>
        </header>

        {/* Onde as páginas (Dashboard, Relatorios, etc) carregam */}
        <Outlet />
      </main>
    </>
  );
}

export default Layout;