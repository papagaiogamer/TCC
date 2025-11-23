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
    socket.emit('get-records');
    socket.emit('get-missing-users');

    socket.on('time-records', (data) => setRecords(data));
    socket.on('missing-users', (data) => setMissingUsers(data));
    socket.on('time-registered', (data) => {
      setRecords(data);
      socket.emit('get-missing-users');
    });

    return () => {
      socket.off('time-records');
      socket.off('missing-users');
      socket.off('time-registered');
    };
  }, [socket]);

  return (
    <div className="container">
      <div className="content-box">
        <h2>Registros de Ponto (Hoje)</h2>
        <div className="records-container">
          <table>
            <thead>
              <tr><th>Nome</th><th>Data</th><th>Hora</th><th>Tipo</th><th>Status</th><th>Jornada</th></tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr><td colSpan="6" style={{textAlign: 'center'}}>Nenhum ponto registrado hoje.</td></tr>
              ) : (
                records.map((r, i) => (
                  <tr key={i}>
                    <td>{r.userId}</td><td>{r.date}</td><td>{r.time}</td>
                    <td className={r.type === 'entrada' ? 'entrada' : 'saida'}>{r.type === 'entrada' ? 'Entrada' : 'Saída'}</td>
                    <td className={r.status === 'atraso' ? 'atraso' : r.status === 'no_horario' ? 'no-horario' : 'na'}>
                      {r.status === 'atraso' ? 'Atraso' : r.status === 'no_horario' ? 'No horário' : '—'}
                    </td>
                    <td className={r.type === 'saida' ? 'duration' : 'na'}>
                      {r.type === 'saida' ? formatDuration(r.work_duration) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="content-box">
        <h2>Usuários que ainda não bateram ponto (Hoje)</h2>
        <div className="records-container">
          <table>
            <thead><tr><th>Nome</th><th>Horário Entrada</th><th>Horário Saída</th></tr></thead>
            <tbody>
              {missingUsers.length === 0 ? (
                <tr><td colSpan="3" style={{textAlign: 'center'}}>Todos bateram ponto! 🎉</td></tr>
              ) : (
                missingUsers.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.entry_time}</td><td>{u.exit_time}</td></tr>)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default Dashboard;