import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

function Dashboard() {
  const socket = useSocket();
  const [records, setRecords] = useState([]);
  const [missingUsers, setMissingUsers] = useState([]);

  const formatDuration = (totalMinutes) => {
    if (totalMinutes === null || totalMinutes === undefined) return '—';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  };

  useEffect(() => {
    if (!socket) return;

    // 1. Pede dados assim que entra
    socket.emit('get-records');
    socket.emit('get-missing-users');

    // 2. OUVINTES (LISTENERS) - Atualizam a tela sozinhos
    socket.on('time-records', (data) => setRecords(data));
    socket.on('missing-users', (data) => setMissingUsers(data));
    
    // 3. OUVINTE EXTRA: Se o servidor gritar "refresh-data", pedimos tudo de novo
    socket.on('refresh-data', () => {
        socket.emit('get-records');
        socket.emit('get-missing-users');
    });

    return () => {
      socket.off('time-records');
      socket.off('missing-users');
      socket.off('refresh-data');
    };
  }, [socket]);

  return (
    <div className="container">
      {/* Tabela de Pontos */}
      <div className="content-box">
        <h2>Registros de Ponto (Hoje)</h2>
        <div className="records-container">
          <table>
            <thead>
              <tr><th>Nome</th><th>Hora</th><th>Tipo</th><th>Status</th><th>Jornada</th></tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr><td colSpan="5" style={{textAlign: 'center', color: '#888'}}>Nenhum ponto hoje.</td></tr>
              ) : (
                records.map((r, i) => (
                  <tr key={i}>
                    <td>{r.userId} <small>({r.role === 'visitor' ? 'Visitante' : 'Func.'})</small></td>
                    <td>{r.time}</td>
                    <td>
                        <span className={r.type === 'entrada' ? 'entrada' : 'saida'}>
                            {r.type === 'entrada' ? 'Entrada' : 'Saída'}
                        </span>
                    </td>
                    <td>
                      <span className={r.status === 'atraso' ? 'atraso' : r.status === 'visitante' ? '' : 'no-horario'}
                            style={r.status === 'visitante' ? {background:'#eee', color:'#555', padding:'4px 8px', borderRadius:'10px', fontSize:'0.8rem'} : {}}>
                        {r.status === 'atraso' ? 'Atraso' : r.status === 'visitante' ? 'Livre' : 'No horário'}
                      </span>
                    </td>
                    <td className={r.type === 'saida' ? 'duration' : ''}>
                      {r.type === 'saida' ? formatDuration(r.work_duration) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabela de Ausentes */}
      <div className="content-box">
        <h2>Monitoramento de Faltas (Hoje)</h2>
        <div className="records-container">
          <table>
            <thead><tr><th>Nome</th><th>Horário</th><th>Situação</th></tr></thead>
            <tbody>
              {missingUsers.length === 0 ? (
                <tr><td colSpan="3" style={{textAlign: 'center', color: '#888'}}>Todos presentes!</td></tr>
              ) : (
                missingUsers.map((u, i) => (
                  <tr key={i}>
                    <td>{u.name}</td>
                    <td>{u.entry_time} - {u.exit_time}</td>
                    <td>
                        {u.isJustified 
                            ? <span style={{color: 'green', fontWeight:'bold', background:'#dcfce7', padding:'4px 8px', borderRadius:'12px'}}>✓ Atestado: {u.reason}</span>
                            : <span style={{color: 'red', fontWeight:'bold', background:'#fee2e2', padding:'4px 8px', borderRadius:'12px'}}>Ausente</span>
                        }
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;