import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import Clock from '../components/Clock'; // Importando o Relógio

function Dashboard() {
  const socket = useSocket();
  const [records, setRecords] = useState([]);
  const [missingUsers, setMissingUsers] = useState([]);

  // Formata minutos em horas
  const formatDuration = (totalMinutes) => {
    if (totalMinutes === null || totalMinutes === undefined) return '—';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  };

  // Deixa o tipo (ex: saida_almoco) mais bonito para ler
  const formatType = (type) => {
    switch(type) {
        case 'entrada': return 'Entrada';
        case 'saida_almoco': return 'Saída Almoço';
        case 'volta_almoco': return 'Volta Almoço';
        case 'saida': return 'Saída';
        default: return type;
    }
  };

  useEffect(() => {
    if (!socket) return;

    // 1. Pede dados iniciais
    socket.emit('get-records');
    socket.emit('get-missing-users');

    // 2. Listeners
    socket.on('time-records', (data) => setRecords(data));
    socket.on('missing-users', (data) => setMissingUsers(data));
    
    // 3. Atualização automática (quando alguém bate ponto ou cadastra algo)
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
      
      {/* CABEÇALHO COM RELÓGIO */}
      <div className="content-box" style={{
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap',
          gap: '20px'
      }}>
         <div>
            <h2 style={{border: 'none', marginBottom: '5px'}}>Monitoramento em Tempo Real</h2>
            <p style={{color: 'var(--text-secondary)'}}>Acompanhe as batidas de hoje</p>
         </div>
         
         {/* O Relógio fica aqui, destacado */}
         <div style={{
             backgroundColor: 'var(--bg-body)', 
             padding: '10px 20px', 
             borderRadius: '12px', 
             border: '1px solid var(--border-color)'
         }}>
             <Clock />
         </div>
      </div>

      {/* TABELA DE REGISTROS DO DIA */}
      <div className="content-box">
        <h2>Últimos Registros</h2>
        <div className="records-container">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Hora</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Jornada</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{textAlign: 'center', color: '#888', padding: '30px'}}>
                    Nenhum ponto registrado hoje.
                  </td>
                </tr>
              ) : (
                records.map((r, i) => (
                  <tr key={i}>
                    <td>
                        {r.userId} 
                        <small style={{color: '#666', marginLeft: '6px'}}>
                            ({r.role === 'visitor' ? 'Visitante' : 'Func.'})
                        </small>
                    </td>
                    <td style={{fontWeight: 'bold', fontFamily: 'monospace', fontSize: '1rem'}}>
                        {r.time}
                    </td>
                    <td>
                        {/* Badge de Tipo */}
                        <span className={r.type === 'entrada' || r.type === 'volta_almoco' ? 'entrada' : 'saida'}
                              style={{
                                  backgroundColor: r.type.includes('entrada') || r.type.includes('volta') ? '#dcfce7' : '#fef3c7',
                                  color: r.type.includes('entrada') || r.type.includes('volta') ? '#166534' : '#92400e'
                              }}>
                            {formatType(r.type)}
                        </span>
                    </td>
                    <td>
                      {/* Badge de Status (Trata atraso de almoço também) */}
                      <span style={{
                          padding: '4px 8px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 'bold',
                          backgroundColor: r.status.includes('atraso') ? '#fee2e2' : (r.status === 'visitante' ? '#f3f4f6' : 'transparent'),
                          color: r.status.includes('atraso') ? '#991b1b' : (r.status === 'visitante' ? '#4b5563' : 'var(--text-primary)'),
                          border: r.status === 'no_horario' ? '1px solid var(--border-color)' : 'none'
                      }}>
                        {r.status === 'atraso' ? 'Atraso Entrada' : 
                         r.status === 'atraso_almoco' ? 'Almoço Excedido' :
                         r.status === 'visitante' ? 'Livre' : 'No horário'}
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

      {/* TABELA DE FALTAS */}
      <div className="content-box">
        <h2>Monitoramento de Ausências (Hoje)</h2>
        <div className="records-container">
          <table>
            <thead><tr><th>Nome</th><th>Horário Previsto</th><th>Situação</th></tr></thead>
            <tbody>
              {missingUsers.length === 0 ? (
                <tr><td colSpan="3" style={{textAlign: 'center', color: '#888'}}>Todos presentes! 🎉</td></tr>
              ) : (
                missingUsers.map((u, i) => (
                  <tr key={i}>
                    <td>{u.name}</td>
                    <td>{u.entry_time} - {u.exit_time}</td>
                    <td>
                        {u.isJustified 
                            ? <span style={{color: 'green', fontWeight:'bold', background:'#dcfce7', padding:'4px 8px', borderRadius:'12px', fontSize:'0.85rem'}}>✓ Atestado: {u.reason}</span>
                            : <span style={{color: 'red', fontWeight:'bold', background:'#fee2e2', padding:'4px 8px', borderRadius:'12px', fontSize:'0.85rem'}}>Ausente</span>
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