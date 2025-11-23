import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
  // Verifica se existe o "crachá" de admin salvo no navegador
  const isAdmin = localStorage.getItem('adminToken');

  // Se não tiver o token, redireciona para o Login de Admin
  if (!isAdmin) {
    return <Navigate to="/admin-login" replace />;
  }

  // Se tiver, deixa passar e mostra o conteúdo da rota (Outlet)
  return <Outlet />;
};

export default ProtectedRoute;