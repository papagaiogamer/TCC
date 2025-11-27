import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

function Funcionarios() {
  const socket = useSocket();
  const [employees, setEmployees] = useState([]);
  
  // Controle do Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Formulário Básico
  const [formData, setFormData] = useState({ 
    name: '', 
    cpf: '', 
    password: '', 
    cargo: '', 
    role: 'employee' 
  });

  // Estado da Jornada (4 campos por dia)
  const initialSchedule = Array.from({ length: 7 }, (_, i) => ({ 
    day_of_week: i, 
    entryTime: '', 
    lunchStart: '', 
    lunchEnd: '', 
    exitTime: '' 
  }));
  const [schedule, setSchedule] = useState(initialSchedule);
  const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  useEffect(() => {
    if (!socket) return;
    socket.emit('get-employees');
    socket.on('employees-list', (data) => setEmployees(data));
    
    socket.on('employee-details', (data) => {
      if (!data.user) return;
      setEditingId(data.user.id);
      setFormData({
        name: data.user.name,
        cpf: data.user.cpf,
        cargo: data.user.cargo || '',
        password: '',
        role: data.user.role || 'employee'
      });

      if (data.schedule && data.schedule.length > 0) {
        const newSchedule = [...initialSchedule];
        data.schedule.forEach(day => {
          newSchedule[day.day_of_week] = { 
            day_of_week: day.day_of_week, 
            entryTime: day.entry_time || '', 
            lunchStart: day.lunch_start || '', 
            lunchEnd: day.lunch_end || '', 
            exitTime: day.exit_time || '' 
          };
        });
        setSchedule(newSchedule);
      } else {
        setSchedule(initialSchedule);
      }
      setShowModal(true);
    });

    const handleSuccess = (res) => {
      setMessage({ text: res.message, type: 'success' });
      setTimeout(() => { 
        closeModal(); 
        socket.emit('get-employees'); 
      }, 1000);
    };

    socket.on('user-registered', handleSuccess);
    socket.on('user-updated', handleSuccess);
    socket.on('user-register-error', (res) => setMessage({ text: res.message, type: 'error' }));

    return () => {
      socket.off('employees-list');
      socket.off('employee-details');
      socket.off('user-registered');
      socket.off('user-updated');
      socket.off('user-register-error');
    };
  }, [socket]);

  const openModal = (roleType) => {
    setEditingId(null);
    setFormData({ 
      name: '', 
      cpf: '', 
      password: '', 
      cargo: roleType === 'visitor' ? 'Visitante' : (roleType === 'admin' ? 'Administrador' : ''), 
      role: roleType 
    });
    setSchedule(initialSchedule);
    setMessage({ text: '', type: '' });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setMessage({ text: '', type: '' }); };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleScheduleChange = (idx, field, val) => {
    const newSchedule = [...schedule];
    newSchedule[idx] = { ...newSchedule[idx], [field]: val };
    setSchedule(newSchedule);
  };

  // --- FUNÇÕES DE FACILITAÇÃO (AUTOMATIZAÇÃO) ---
  const replicateMondayToWeek = () => {
      const monday = schedule[1]; // Pega Segunda-feira (índice 1)
      const newSchedule = [...schedule];
      
      // Replica para Terça(2) até Sexta(5)
      for (let i = 2; i <= 5; i++) {
          newSchedule[i] = { 
              ...newSchedule[i],
              entryTime: monday.entryTime,
              lunchStart: monday.lunchStart,
              lunchEnd: monday.lunchEnd,
              exitTime: monday.exitTime
          };
      }
      setSchedule(newSchedule);
      setMessage({ text: 'Horários de Segunda copiados até Sexta!', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 2000);
  };

  const clearSchedule = () => {
      setSchedule(initialSchedule);
  };
  // ----------------------------------------------

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.cpf) return setMessage({ text: 'Nome e CPF obrigatórios!', type: 'error' });
    
    if (!editingId && formData.role !== 'visitor' && !formData.password) {
        return setMessage({ text: 'Senha é obrigatória!', type: 'error' });
    }

    const dataToSend = { 
        id: editingId, 
        ...formData, 
        schedule: formData.role === 'visitor' ? null : schedule 
    };

    if (editingId) {
        socket.emit('update-user', dataToSend);
    } else {
        socket.emit('register-user', dataToSend);
    }
  };

  return (
    <div className="container">
      <div className="content-box" style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
        <button className="btn-open-modal primary" onClick={() => openModal('employee')}>
            + Funcionário
        </button>
        <button className="btn-open-modal secondary" onClick={() => openModal('visitor')}>
            + Visitante
        </button>
        <button className="btn-open-modal" style={{backgroundColor: '#1e293b', color: '#fff'}} onClick={() => openModal('admin')}>
            + Admin
        </button>
      </div>

      <div className="content-box">
        <h2>Gestão de Usuários</h2>
        <div className="records-container">
          <table>
            <thead>
                <tr>
                    <th>Nome</th>
                    <th>CPF</th>
                    <th>Tipo (Cargo)</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                    <td>{emp.name}</td>
                    <td>{emp.cpf}</td>
                    <td>
                        <span style={{
                            padding: '4px 8px', 
                            borderRadius: '12px', 
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            backgroundColor: emp.role === 'admin' ? '#1e293b' : (emp.role === 'visitor' ? '#6b7280' : '#2563eb'),
                            color: '#fff'
                        }}>
                            {emp.role === 'admin' ? 'ADMIN' : (emp.role === 'visitor' ? 'VISITANTE' : 'FUNC.')}
                        </span>
                        <span style={{marginLeft: '8px', color: '#666', fontSize: '0.85rem'}}>
                            {emp.cargo}
                        </span>
                    </td>
                    <td>
                        <button className="secondary small" onClick={() => socket.emit('get-employee-details', { id: emp.id })}>
                            Editar
                        </button>
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {showModal && (
        <>
            <div className="modal-overlay" onClick={closeModal}></div>
            <div className="modal" style={{ maxWidth: '800px' }}>
                <div className="modal-header">
                    <h2 className="modal-title">
                        {editingId ? 'Editar Usuário' : `Novo ${formData.role}`}
                    </h2>
                    <button className="modal-close" onClick={closeModal}>✕</button>
                </div>
                
                <div className="modal-body">
                <form onSubmit={handleSubmit}>
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                        <div className="form-group">
                            <label>Nome:</label>
                            <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
                        </div>
                        <div className="form-group">
                            <label>CPF:</label>
                            <input type="text" name="cpf" value={formData.cpf} onChange={handleInputChange} required disabled={!!editingId} />
                        </div>
                    </div>
                    
                    {formData.role !== 'visitor' && (
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                            <div className="form-group">
                                <label>Senha:</label>
                                <input 
                                    type="password" 
                                    name="password" 
                                    value={formData.password} 
                                    onChange={handleInputChange} 
                                    placeholder={editingId ? "Deixe em branco para manter" : "Senha de acesso"} 
                                />
                            </div>
                            <div className="form-group">
                                <label>Cargo:</label>
                                <input type="text" name="cargo" value={formData.cargo} onChange={handleInputChange} />
                            </div>
                        </div>
                    )}

                    {/* Editor de Jornada (4 Campos) */}
                    {formData.role !== 'visitor' && (
                        <>
                            <div style={{
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                marginTop: '20px', 
                                borderTop: '1px solid #eee', 
                                paddingTop: '10px',
                                marginBottom: '10px'
                            }}>
                                <h3 style={{fontSize: '1rem', margin: 0}}>
                                    Jornada (Entrada | Almoço | Saída)
                                </h3>
                                
                                {/* BOTÕES MÁGICOS */}
                                <div style={{display: 'flex', gap: '8px'}}>
                                    <button 
                                        type="button" 
                                        className="secondary small" 
                                        onClick={replicateMondayToWeek}
                                        style={{backgroundColor: '#eff6ff', borderColor: '#2563eb', color: '#2563eb'}}
                                        title="Preencha Segunda-feira e clique aqui"
                                    >
                                        ⚡ Copiar Seg p/ Sex
                                    </button>
                                    <button 
                                        type="button" 
                                        className="secondary small" 
                                        onClick={clearSchedule}
                                        style={{color: '#ef4444', borderColor: '#ef4444'}}
                                    >
                                        Limpar
                                    </button>
                                </div>
                            </div>

                            <div id="schedule-editor">
                                {daysOfWeek.map((day, idx) => (
                                    <div className="schedule-day-row" key={idx} style={{
                                        display: 'grid', 
                                        gridTemplateColumns: '80px 1fr 1fr 1fr 1fr', 
                                        gap: '5px',
                                        alignItems: 'center',
                                        marginBottom: '5px',
                                        // Destaca final de semana com cor diferente
                                        backgroundColor: (idx === 0 || idx === 6) ? '#f9fafb' : 'transparent',
                                        padding: '5px',
                                        borderRadius: '4px'
                                    }}>
                                        <label style={{marginBottom: 0, fontWeight: (idx === 0 || idx === 6) ? 'normal' : 'bold'}}>{day}:</label>
                                        <input type="time" title="Entrada" value={schedule[idx].entryTime} onChange={(e) => handleScheduleChange(idx, 'entryTime', e.target.value)} />
                                        <input type="time" title="Ida Almoço" value={schedule[idx].lunchStart} onChange={(e) => handleScheduleChange(idx, 'lunchStart', e.target.value)} style={{borderColor: '#fbbf24'}} />
                                        <input type="time" title="Volta Almoço" value={schedule[idx].lunchEnd} onChange={(e) => handleScheduleChange(idx, 'lunchEnd', e.target.value)} style={{borderColor: '#fbbf24'}} />
                                        <input type="time" title="Saída" value={schedule[idx].exitTime} onChange={(e) => handleScheduleChange(idx, 'exitTime', e.target.value)} />
                                    </div>
                                ))}
                            </div>
                            <p style={{fontSize: '0.75rem', color: '#666', marginTop: '5px'}}>
                                * Preencha apenas a Segunda-feira e clique em <b>"Copiar Seg p/ Sex"</b> para agilizar.
                            </p>
                        </>
                    )}

                    {message.text && (
                        <div style={{
                            marginTop: '10px', 
                            padding: '10px', 
                            borderRadius: '4px', 
                            backgroundColor: message.type === 'error' ? '#fee2e2' : '#dcfce7',
                            color: message.type === 'error' ? '#991b1b' : '#166534',
                            textAlign: 'center'
                        }}>
                            {message.text}
                        </div>
                    )}

                    <div className="modal-footer" style={{marginTop: '20px'}}>
                        <button type="button" className="secondary" onClick={closeModal}>Cancelar</button>
                        <button type="submit" className="primary">Salvar</button>
                    </div>
                </form>
                </div>
            </div>
        </>
      )}
    </div>
  );
}

export default Funcionarios;