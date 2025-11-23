import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

function Historico() {
  const socket = useSocket();
  
  // Estado para a data selecionada e as listas de dados
  const [selectedDate, setSelectedDate] = useState('');
  const [records, setRecords] = useState([]);
  const [missingUsers, setMissingUsers] = useState([]);

  // Função auxiliar para formatar duração (ex: 8h 30m)
  const formatDuration = (totalMinutes) => {
    if (totalMinutes === null || totalMinutes === undefined) return '—';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  };

  // Função auxiliar para pegar a data de hoje no formato YYYY-MM-DD
  const getTodayDate = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Efeito inicial e configuração dos ouvintes do Socket
  useEffect(() => {
    if (!socket) return;

    // Define a data inicial como hoje
    const today = getTodayDate();
    setSelectedDate(today);

    // Pede os dados iniciais
    socket.emit('get-history', { date: today });

    // --- Listeners (Ouvintes) ---
    
    // O servidor responde 'time-records' com a lista de pontos
    socket.on('time-records', (data) => {
      setRecords(data);
    });

    // O servidor responde 'missing-users' com a lista de ausentes
    socket.on('missing-users', (data) => {
      setMissingUsers(data);
    });

    // Limpeza ao sair da tela
    return () => {
      socket.off('time-records');
      socket.off('missing-users');
    };
  }, [socket]);

  // Função chamada quando o usuário muda a data no input
  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    
    if (newDate) {
      // Pede ao servidor os dados da nova data
      socket.emit('get-history', { date: newDate });
    }
  };

  // Formata a data para exibir no título (DD/MM/AAAA)
  const displayDate = selectedDate ? selectedDate.split('-').reverse().join('/') : '...';

  return (
    <div className="container">
      {/* Controle de Data */}
      <div className="content-box">
        <div className="form-group" style={{ maxWidth: '300px' }}>
          <label htmlFor="historyDate">Consultar Histórico por Data:</label>
          <input 
            type="date" 
            id="historyDate" 
            className="input-date"
            value={selectedDate}
            onChange={handleDateChange}
          />
        </div>
      </div>

      {/* Tabela 1: Registros de Ponto */}
      <div className="content-box">
        <h2>Registros de Ponto ({displayDate})</h2>
        <div className="records-container">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Data</th>
                <th>Hora</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Jornada</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{textAlign: 'center', color: 'gray'}}>
                    Nenhum ponto registrado nesta data.
                  </td>
                </tr>
              ) : (
                records.map((record, index) => (
                  <tr key={index}>
                    <td>{record.userId}</td>
                    <td>{record.date}</td>
                    <td>{record.time}</td>
                    
                    <td className={record.type === 'entrada' ? 'entrada' : 'saida'}>
                      {record.type === 'entrada' ? 'Entrada' : 'Saída'}
                    </td>

                    <td className={
                      record.status === 'atraso' ? 'atraso' : 
                      record.status === 'no_horario' ? 'no-horario' : 'na'
                    }>
                      {record.status === 'atraso' ? 'Atraso' : 
                       record.status === 'no_horario' ? 'No horário' : '—'}
                    </td>

                    <td className={record.type === 'saida' ? 'duration' : 'na'}>
                      {record.type === 'saida' ? formatDuration(record.work_duration) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabela 2: Usuários Ausentes */}
      <div className="content-box">
        <h2>Usuários que não bateram ponto ({displayDate})</h2>
        <div className="records-container">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Horário Entrada</th>
                <th>Horário Saída</th>
              </tr>
            </thead>
            <tbody>
              {missingUsers.length === 0 ? (
                <tr>
                  <td colSpan="3" style={{textAlign: 'center', color: 'gray'}}>
                    Todos bateram ponto nesta data!
                  </td>
                </tr>
              ) : (
                missingUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.entry_time}</td>
                    <td>{user.exit_time}</td>
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

export default Historico;