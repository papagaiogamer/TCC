import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

function Historico() {
  const socket = useSocket();
  
  // Dados
  const [selectedDate, setSelectedDate] = useState('');
  const [records, setRecords] = useState([]);
  const [missingUsers, setMissingUsers] = useState([]);

  // Modal de Atestado
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [certUser, setCertUser] = useState(null);
  const [certReason, setCertReason] = useState('');
  const [message, setMessage] = useState('');

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

    // Carregar dados
    const loadData = (date) => socket.emit('get-history', { date: date || today });
    loadData(today);

    // Listeners
    socket.on('time-records', setRecords);
    socket.on('missing-users', setMissingUsers);

    // Atualização em tempo real
    socket.on('refresh-data', () => loadData(selectedDate));
    
    // Sucesso no atestado
    socket.on('certificate-registered', (data) => {
      setMessage(data.message); // Mostra mensagem de sucesso
      setTimeout(() => {
        setShowCertificateModal(false);
        setMessage('');
        setCertReason('');
        loadData(selectedDate); // Recarrega a lista
      }, 1500);
    });

    return () => {
      socket.off('time-records');
      socket.off('missing-users');
      socket.off('refresh-data');
      socket.off('certificate-registered');
    };
  }, [socket, selectedDate]);

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    if (newDate) socket.emit('get-history', { date: newDate });
  };

  const openJustifyModal = (user) => {
    setCertUser(user);
    setCertReason('');
    setMessage('');
    setShowCertificateModal(true);
  };

  const submitCertificate = (e) => {
    e.preventDefault(); // Evita refresh
    if (!certReason) return;
    const [y, m, d] = selectedDate.split('-');
    const formattedDate = `${d}/${m}/${y}`;
    
    socket.emit('register-certificate', {
      userId: certUser.id,
      date: formattedDate,
      reason: certReason
    });
  };

  const displayDate = selectedDate ? selectedDate.split('-').reverse().join('/') : '...';

  return (
    <div className="container">
      {/* Seletor de Data */}
      <div className="content-box">
        <div className="form-group" style={{maxWidth: '300px'}}>
            <label>Consultar Data:</label> 
            <input type="date" value={selectedDate} onChange={handleDateChange} />
        </div>
      </div>

      {/* Tabela de Registros */}
      <div className="content-box">
        <h2>Registros de Ponto ({displayDate})</h2>
        <div className="records-container">
          <table>
            <thead><tr><th>Nome</th><th>Hora</th><th>Tipo</th><th>Status</th><th>Duração</th></tr></thead>
            <tbody>
              {records.length === 0 ? <tr><td colSpan="5" style={{textAlign:'center', color:'#888'}}>Vazio.</td></tr> : 
                records.map((r, i) => (
                  <tr key={i}>
                    <td>{r.userId} <small style={{color:'#666'}}>({r.role==='visitor'?'Visitante':'Func.'})</small></td>
                    <td>{r.time}</td>
                    <td><span className={r.type==='entrada'?'entrada':'saida'}>{r.type}</span></td>
                    <td><span className={r.status==='atraso'?'atraso':(r.status==='visitante'?'':'no-horario')} style={r.status==='visitante'?{background:'#eee', color:'#555', padding:'4px 8px', borderRadius:'10px', fontSize:'0.8rem'}:{}}>{r.status}</span></td>
                    <td className={r.type==='saida'?'duration':''}>{r.type==='saida'?formatDuration(r.work_duration):'—'}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabela de Faltas */}
      <div className="content-box">
        <h2>Faltas e Justificativas ({displayDate})</h2>
        <div className="records-container">
           <table>
               <thead><tr><th>Nome</th><th>Situação</th><th>Ação</th></tr></thead>
               <tbody>
                   {missingUsers.length === 0 ? <tr><td colSpan="3" style={{textAlign:'center', color:'#888'}}>Todos presentes!</td></tr> :
                       missingUsers.map(u => (
                           <tr key={u.id}>
                               <td>{u.name}</td>
                               <td>
                                   {u.isJustified 
                                    ? <span style={{color:'green', background:'#dcfce7', padding:'4px 8px', borderRadius:'12px', fontWeight:'bold', fontSize:'0.85rem'}}>✓ Atestado: {u.reason}</span> 
                                    : <span style={{color:'red', background:'#fee2e2', padding:'4px 8px', borderRadius:'12px', fontWeight:'bold', fontSize:'0.85rem'}}>✖ Falta</span>
                                   }
                               </td>
                               <td>{!u.isJustified && <button className="secondary small" onClick={()=>openJustifyModal(u)}>Justificar</button>}</td>
                           </tr>
                       ))
                   }
               </tbody>
           </table>
        </div>
      </div>

      {/* --- MODAL DE ATESTADO (DESIGN MELHORADO) --- */}
      {showCertificateModal && (
        <>
            <div className="modal-overlay" onClick={() => setShowCertificateModal(false)}></div>
            <div className="modal" style={{ height: 'auto', maxWidth: '500px' }}>
                <div className="modal-header">
                    <h3 className="modal-title">Justificar Ausência</h3>
                    <button className="modal-close" onClick={() => setShowCertificateModal(false)}>✕</button>
                </div>
                
                <div className="modal-body">
                    {/* Cartão de Detalhes */}
                    <div style={{
                        backgroundColor: 'var(--bg-body)', 
                        padding: '16px', 
                        borderRadius: '8px', 
                        marginBottom: '20px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                            <span style={{color: 'var(--text-secondary)', fontSize: '0.9rem'}}>Funcionário:</span>
                            <span style={{fontWeight: 'bold'}}>{certUser?.name}</span>
                        </div>
                        <div style={{display: 'flex', justifyContent: 'space-between'}}>
                            <span style={{color: 'var(--text-secondary)', fontSize: '0.9rem'}}>Data da Falta:</span>
                            <span style={{fontWeight: 'bold'}}>{displayDate}</span>
                        </div>
                    </div>

                    <form onSubmit={submitCertificate}>
                        <div className="form-group">
                            <label style={{fontWeight: '600'}}>Motivo do Atestado:</label>
                            <input 
                                type="text" 
                                value={certReason} 
                                onChange={(e) => setCertReason(e.target.value)} 
                                placeholder="Ex: Consulta Médica, Doença, Problema Pessoal..." 
                                autoFocus
                                required
                                style={{width: '100%'}}
                            />
                        </div>

                        {message && (
                            <div style={{
                                backgroundColor: '#dcfce7', 
                                color: '#166534', 
                                padding: '10px', 
                                borderRadius: '6px', 
                                textAlign: 'center', 
                                marginTop: '10px',
                                fontWeight: '500'
                            }}>
                                {message}
                            </div>
                        )}

                        <div className="modal-footer" style={{marginTop: '20px', padding: '16px 0 0 0', background: 'transparent'}}>
                            <button type="button" className="secondary" onClick={() => setShowCertificateModal(false)}>Cancelar</button>
                            <button type="submit" className="primary">Salvar Justificativa</button>
                        </div>
                    </form>
                </div>
            </div>
        </>
      )}
    </div>
  );
}

export default Historico;