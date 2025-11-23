import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

function Funcionarios() {
  const socket = useSocket();
  const [employees, setEmployees] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isVisitorMode, setIsVisitorMode] = useState(false); // NOVO
  const [message, setMessage] = useState({ text: '', type: '' });
  const [formData, setFormData] = useState({ name: '', cpf: '', password: '', cargo: '' });
  
  const initialSchedule = Array.from({ length: 7 }, (_, i) => ({ day_of_week: i, entryTime: '', exitTime: '' }));
  const [schedule, setSchedule] = useState(initialSchedule);
  const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  useEffect(() => {
    if (!socket) return;
    socket.emit('get-employees');
    socket.on('employees-list', (data) => setEmployees(data));
    socket.on('employee-details', (data) => {
      if (!data.user) return;
      setEditingId(data.user.id);
      setIsVisitorMode(data.user.role === 'visitor'); // Verifica se é visitante
      setFormData({ name: data.user.name, cpf: data.user.cpf, cargo: data.user.cargo || '', password: '' });
      
      if (data.user.role === 'employee') {
          const newSchedule = [...initialSchedule];
          data.schedule.forEach(day => {
            newSchedule[day.day_of_week] = { day_of_week: day.day_of_week, entryTime: day.entry_time || '', exitTime: day.exit_time || '' };
          });
          setSchedule(newSchedule);
      }
      setShowModal(true);
    });
    const handleSuccess = (res) => {
      setMessage({ text: res.message, type: 'success' });
      setTimeout(() => { closeModal(); socket.emit('get-employees'); }, 1000);
    };
    socket.on('user-registered', handleSuccess);
    socket.on('user-updated', handleSuccess);
    socket.on('user-register-error', (res) => setMessage({ text: res.message, type: 'error' }));

    return () => {
      socket.off('employees-list'); socket.off('employee-details'); socket.off('user-registered'); socket.off('user-updated'); socket.off('user-register-error');
    };
  }, [socket]);

  // Abre modal para FUNCIONÁRIO
  const openNewEmployee = () => {
    setEditingId(null); setIsVisitorMode(false);
    setFormData({ name: '', cpf: '', password: '', cargo: '' }); setSchedule(initialSchedule); setMessage({ text: '', type: '' }); setShowModal(true);
  };

  // Abre modal para VISITANTE
  const openNewVisitor = () => {
    setEditingId(null); setIsVisitorMode(true);
    setFormData({ name: '', cpf: '', password: '', cargo: 'Visitante' }); setMessage({ text: '', type: '' }); setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setMessage({ text: '', type: '' }); };
  
  const handleInputChange = (e) => {
    const { id, value } = e.target;
    const fieldMap = { newName: 'name', newCpf: 'cpf', newPassword: 'password', newCargo: 'cargo' };
    setFormData(prev => ({ ...prev, [fieldMap[id]]: value }));
  };
  const handleScheduleChange = (idx, field, val) => {
    const newSchedule = [...schedule]; newSchedule[idx] = { ...newSchedule[idx], [field]: val }; setSchedule(newSchedule);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.cpf) return setMessage({ text: 'Nome e CPF obrigatórios!', type: 'error' });
    
    // Senha só é obrigatória para funcionário novo. Visitante usa CPF como senha automaticamente no backend.
    if (!editingId && !isVisitorMode && !formData.password) return setMessage({ text: 'Senha obrigatória!', type: 'error' });

    const dataToSend = { 
        id: editingId, 
        ...formData, 
        role: isVisitorMode ? 'visitor' : 'employee',
        schedule: isVisitorMode ? null : schedule // Visitante não manda schedule
    };
    editingId ? socket.emit('update-user', dataToSend) : socket.emit('register-user', dataToSend);
  };

  return (
    <div className="container">
      <div className="content-box" style={{display: 'flex', gap: '10px'}}>
        <button className="btn-open-modal" onClick={openNewEmployee}>+ Novo Funcionário</button>
        <button className="btn-open-modal secondary" onClick={openNewVisitor} style={{backgroundColor: '#6e7781', color: 'white', borderColor: '#6e7781'}}>+ Novo Visitante</button>
      </div>
      <div className="content-box">
        <h2>Lista de Pessoas</h2>
        <div className="records-container">
          <table>
            <thead><tr><th>Nome</th><th>CPF</th><th>Tipo</th><th>Ações</th></tr></thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                    <td>{emp.name}</td>
                    <td>{emp.cpf}</td>
                    <td>
                        <span style={{
                            backgroundColor: emp.role === 'visitor' ? '#6e7781' : '#2da44e',
                            color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '12px'
                        }}>
                            {emp.role === 'visitor' ? 'Visitante' : 'Funcionário'}
                        </span>
                    </td>
                    <td><button className="secondary small" onClick={() => socket.emit('get-employee-details', { id: emp.id })}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* MODAL */}
      <div className="modal-overlay" style={{ display: showModal ? 'block' : 'none' }} onClick={closeModal}></div>
      <div className="modal" style={{ display: showModal ? 'flex' : 'none' }}>
        <div className="modal-header">
            <h2 className="modal-title">
                {editingId ? 'Editar' : (isVisitorMode ? 'Registrar Visitante' : 'Registrar Funcionário')}
            </h2>
            <button className="modal-close" onClick={closeModal}>✕</button>
        </div>
        <div className="modal-body">
          <form>
            <div className="form-group"><label>Nome:</label><input type="text" id="newName" value={formData.name} onChange={handleInputChange} required /></div>
            <div className="form-group"><label>CPF:</label><input type="text" id="newCpf" value={formData.cpf} onChange={handleInputChange} required disabled={!!editingId} /></div>
            
            {/* Senha e Cargo só aparecem se NÃO for visitante em modo criação */}
            {!isVisitorMode && (
                <>
                    <div className="form-group"><label>Senha:</label><input type="password" id="newPassword" value={formData.password} onChange={handleInputChange} placeholder={editingId ? "Vazio para manter" : ""} /></div>
                    <div className="form-group"><label>Cargo:</label><input type="text" id="newCargo" value={formData.cargo} onChange={handleInputChange} /></div>
                </>
            )}

            {/* Jornada só aparece para Funcionários */}
            {!isVisitorMode && (
                <>
                    <h3>Jornada</h3>
                    <div id="schedule-editor">
                    {daysOfWeek.map((day, idx) => (
                        <div className="form-group schedule-day-row" key={idx}>
                        <label>{day}:</label>
                        <input type="time" value={schedule[idx].entryTime} onChange={(e) => handleScheduleChange(idx, 'entryTime', e.target.value)} />
                        <span>às</span>
                        <input type="time" value={schedule[idx].exitTime} onChange={(e) => handleScheduleChange(idx, 'exitTime', e.target.value)} />
                        </div>
                    ))}
                    </div>
                </>
            )}

            {isVisitorMode && <p style={{color: '#666', marginTop: '10px'}}>ℹ️ Visitantes usam o CPF como senha para registrar entrada/saída.</p>}

            {message.text && <div id="registerMessage" className={message.type}>{message.text}</div>}
          </form>
        </div>
        <div className="modal-footer"><button className="secondary" onClick={closeModal}>Cancelar</button><button className="primary" onClick={handleSubmit}>Salvar</button></div>
      </div>
    </div>
  );
}
export default Funcionarios;