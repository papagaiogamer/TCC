import React, { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';

function Layout() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
    }
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    
    const theme = newMode ? 'dark' : 'light';
    document.getElementById('html-tag').setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  };

  return (
    <>
      <nav className="sidebar">
        <div>
          <div className="sidebar-header">
            <h3>Menu</h3>
          </div>
          <ul className="sidebar-menu">
            <li><NavLink to="/dashboard" end>Dashboard</NavLink></li>
            <li><NavLink to="/historico">Histórico</NavLink></li>
            <li><NavLink to="/funcionarios">Funcionários</NavLink></li>
            <li><NavLink to="/login">Sair (Ir p/ Login)</NavLink></li>
          </ul>
        </div>
        
        <div className="sidebar-footer">
          <div className="theme-switch-wrapper">
            <span>Mudar Tema</span>
            <label className="theme-switch" htmlFor="theme-toggle">
              <input type="checkbox" id="theme-toggle" onChange={toggleTheme} checked={isDarkMode} />
              <span className="slider"></span>
            </label>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <header className="header">
          <h1>Sistema de Ponto</h1>
        </header>
        <Outlet />
      </main>
    </>
  );
}

export default Layout;