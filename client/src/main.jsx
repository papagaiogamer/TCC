import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

// Contexto de Conexão com o Servidor
import { SocketProvider } from './context/SocketContext';

// Componentes de Estrutura
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Páginas Públicas
import Login from './pages/Login';          // Tela de Ponto (Funcionário/Visitante)
import AdminLogin from './pages/AdminLogin'; // Tela de Login do Chefe

// Páginas Protegidas (Dashboard)
import Dashboard from './pages/Dashboard';
import Historico from './pages/Historico';
import Funcionarios from './pages/Funcionarios';
import Relatorios from './pages/Relatorios'; // A nova página de gráficos

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SocketProvider>
      <BrowserRouter>
        <Routes>
          {/* === ROTAS PÚBLICAS === */}
          
          {/* Tela principal de bater ponto */}
          <Route path="/login" element={<Login />} />
          
          {/* Tela de login administrativo */}
          <Route path="/admin-login" element={<AdminLogin />} />

          {/* === ROTAS PROTEGIDAS (Área Admin) === */}
          {/* Só acessa aqui se tiver feito login no /admin-login */}
          <Route element={<ProtectedRoute />}>
             <Route path="/" element={<Layout />}>
                {/* Se acessar a raiz, joga pro dashboard */}
                <Route index element={<Navigate to="/dashboard" replace />} />
                
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="historico" element={<Historico />} />
                <Route path="funcionarios" element={<Funcionarios />} />
                <Route path="relatorios" element={<Relatorios />} />
             </Route>
          </Route>

          {/* Qualquer rota desconhecida joga pro Login */}
          <Route path="*" element={<Navigate to="/login" replace />} />

        </Routes>
      </BrowserRouter>
    </SocketProvider>
  </React.StrictMode>,
);