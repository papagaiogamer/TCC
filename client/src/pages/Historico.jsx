import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

function Historico() {
  const socket = useSocket();
  const [selectedDate, setSelectedDate] = useState('');
  const [records, setRecords] = useState([]);
  const [missingUsers, setMissingUsers] = useState([]);
  
  // Estados para o Modal de Atestado
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [certUser, setCertUser] = useState(null); // Usuário selecionado para justificar
  const [certReason, setCertReason] = useState('');
  const [certMessage, setCertMessage] = useState('');

  const formatDuration = (totalMinutes) => {
    if (totalMinutes === null || totalMinutes === undefined) return '—';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  };

  const getTodayDate = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  useEffect(() => {
    if (!socket) return;
    const today = getTodayDate();
    setSelectedDate(today);
    socket.emit('get-history', { date: today });

    socket.on('time-records', (data) => setRecords(data));
    socket.on('missing-users', (data) => setMissingUsers(data));
    
    // Sucesso ao dar atestado
    socket.on('certificate-registered', (data) => {
        setCertMessage(data.message);
        setTimeout(() => {
            setShowCertificateModal(false);
            setCertMessage('');
            setCertReason('');
        }, 1500);
    });

    return () => {
      socket.off('time-records');
      socket.off('missing-users');
      socket.off('certificate-registered');
    };
  }, [socket]);

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    if (newDate) socket.emit('get-history', { date: newDate });
  };

  // Abrir modal de atestado
  const openJustifyModal = (user) => {
      setCertUser(user);
      setCertReason('');
      setCertMessage('');
      setShowCertificateModal(true);
  };

  const submitCertificate = () => {
      if(!certReason) return;
      // Envia data no formato YYYY-MM-DD para o backend tratar ou salvar
      // No server.js esperamos o formato que o sqlite aceita ou DD/MM/AAAA.
      // Vamos mandar DD/MM/AAAA para bater com a tabela
      const [year, month, day] = selectedDate.split('-');
      const formattedDate = `${day}/${month}/${year}`;

      socket.emit('register-certificate', {
          userId: certUser.id,
          date: formattedDate,
          reason: certReason
      });
  };

  const displayDate = selectedDate ? selectedDate.split('-').reverse().join('/') : '...';

  return (
    <div className="container">
      <div className="content-box">
        <div className="form-group" style={{ maxWidth: '300px' }}>
          <label htmlFor="historyDate">Consultar Histórico por Data:</label>
          <input type="date" id="historyDate" className="input-date" value={selectedDate} onChange={handleDateChange} />
        </div>
      </div>

      <div className="content-box">
        <h2>Registros de Ponto ({displayDate})</h2>
        <div className="records-container">
          <table>
            <thead><tr><th>Nome</th><th>Hora</th><th>Tipo</th><th>Status</th><th>Jornada</th></tr></thead>
            <tbody>
              {records.length === 0 ? (
                <tr><td colSpan="5" style={{textAlign: 'center'}}>Nenhum ponto registrado.</td></tr>
              ) : (
                records.map((r, i) => (
                  <tr key={i}>
                    <td>{r.userId} <small style={{color:'#888'}}>({r.role === 'visitor' ? 'Visitante' : 'Func.'})</small></td>
                    <td>{r.time}</td>
                    <td className={r.type === 'entrada' ? 'entrada' : 'saida'}>{r.type === 'entrada' ? 'Entrada' : 'Saída'}</td>
                    <td className={r.status === 'atraso' ? 'atraso' : 'no-horario'}>{r.status === 'atraso' ? 'Atraso' : r.status === 'visitante' ? 'Livre' : 'No horário'}</td>
                    <td className={r.type === 'saida' ? 'duration' : 'na'}>{r.type === 'saida' ? formatDuration(r.work_duration) : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="content-box">
        <h2>Faltas / Atestados ({displayDate})</h2>
        <div className="records-container">
          <table>
            <thead><tr><th>Nome</th><th>Horário Previsto</th><th>Situação</th><th>Ação</th></tr></thead>
            <tbody>
              {missingUsers.length === 0 ? (
                <tr><td colSpan="4" style={{textAlign: 'center'}}>Nenhuma falta registrada.</td></tr>
              ) : (
                missingUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.entry_time} - {user.exit_time}</td>
                    <td>
                        {user.isJustified 
                            ? <span style={{color: 'green', fontWeight: 'bold'}}>✓ Atestado: {user.reason}</span> 
                            : <span style={{color: 'red'}}>Falta</span>
                        }
                    </td>
                    <td>
                        {!user.isJustified && (
                            <button className="secondary small" onClick={() => openJustifyModal(user)}>Justificar</button>
                        )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE ATESTADO */}
      <div className="modal-overlay" style={{ display: showCertificateModal ? 'block' : 'none' }} onClick={() => setShowCertificateModal(false)}></div>
      <div className="modal" style={{ display: showCertificateModal ? 'flex' : 'none', height: 'auto' }}>
          <div className="modal-header">
              <h3 className="modal-title">Justificar Falta: {certUser?.name}</h3>
              <button className="modal-close" onClick={() => setShowCertificateModal(false)}>✕</button>
          </div>
          <div className="modal-body">
              <p>Data: <strong>{displayDate}</strong></p>
              <div className="form-group">
                  <label>Motivo / Atestado:</label>
                  <input type="text" value={certReason} onChange={(e) => setCertReason(e.target.value)} placeholder="Ex: Atestado Médico, Problema familiar..." />
              </div>
              {certMessage && <p style={{color: 'green'}}>{certMessage}</p>}
          </div>
          <div className="modal-footer">
              <button className="secondary" onClick={() => setShowCertificateModal(false)}>Cancelar</button>
              <button className="primary" onClick={submitCertificate}>Salvar Justificativa</button>
          </div>
      </div>

    </div>
  );
}

export default Historico;