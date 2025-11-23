import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

function Funcionarios() {
  const socket = useSocket();
  const [employees, setEmployees] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
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
      setFormData({ name: data.user.name, cpf: data.user.cpf, cargo: data.user.cargo || '', password: '' });
      const newSchedule = [...initialSchedule];
      data.schedule.forEach(day => {
        newSchedule[day.day_of_week] = { day_of_week: day.day_of_week, entryTime: day.entry_time || '', exitTime: day.exit_time || '' };
      });
      setSchedule(newSchedule);
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

  const openNewModal = () => {
    setEditingId(null); setFormData({ name: '', cpf: '', password: '', cargo: '' }); setSchedule(initialSchedule); setMessage({ text: '', type: '' }); setShowModal(true);
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
    if (!editingId && !formData.password) return setMessage({ text: 'Senha obrigatória!', type: 'error' });
    const dataToSend = { id: editingId, ...formData, schedule };
    editingId ? socket.emit('update-user', dataToSend) : socket.emit('register-user', dataToSend);
  };

  return (
    <div className="container">
      <div className="content-box"><button className="btn-open-modal" onClick={openNewModal}>+ Registrar Novo Funcionário</button></div>
      <div className="content-box">
        <h2>Lista de Funcionários</h2>
        <div className="records-container">
          <table>
            <thead><tr><th>Nome</th><th>CPF</th><th>Cargo</th><th>Ações</th></tr></thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}><td>{emp.name}</td><td>{emp.cpf}</td><td>{emp.cargo || '—'}</td><td><button className="secondary small" onClick={() => socket.emit('get-employee-details', { id: emp.id })}>Editar</button></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="modal-overlay" style={{ display: showModal ? 'block' : 'none' }} onClick={closeModal}></div>
      <div className="modal" style={{ display: showModal ? 'flex' : 'none' }}>
        <div className="modal-header"><h2 className="modal-title">{editingId ? 'Editar' : 'Registrar'}</h2><button className="modal-close" onClick={closeModal}>✕</button></div>
        <div className="modal-body">
          <form>
            <div className="form-group"><label>Nome:</label><input type="text" id="newName" value={formData.name} onChange={handleInputChange} required /></div>
            <div className="form-group"><label>CPF:</label><input type="text" id="newCpf" value={formData.cpf} onChange={handleInputChange} required disabled={!!editingId} /></div>
            <div className="form-group"><label>Senha:</label><input type="password" id="newPassword" value={formData.password} onChange={handleInputChange} placeholder={editingId ? "Em branco para não alterar" : ""} /></div>
            <div className="form-group"><label>Cargo:</label><input type="text" id="newCargo" value={formData.cargo} onChange={handleInputChange} /></div>
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
            {message.text && <div id="registerMessage" className={message.type}>{message.text}</div>}
          </form>
        </div>
        <div className="modal-footer"><button className="secondary" onClick={closeModal}>Cancelar</button><button className="primary" onClick={handleSubmit}>Salvar</button></div>
      </div>
    </div>
  );
}
export default Funcionarios;