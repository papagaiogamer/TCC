import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

function Funcionarios() {
  const socket = useSocket();
  const [employees, setEmployees] = useState([]);
  
  // Controle do Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Estado do Formulário
  const [formData, setFormData] = useState({ 
    name: '', 
    cpf: '', 
    password: '', 
    cargo: '', 
    role: 'employee' // Pode ser: 'employee', 'visitor', 'admin'
  });

  // Estado da Jornada (7 dias)
  const initialSchedule = Array.from({ length: 7 }, (_, i) => ({ 
    day_of_week: i, entryTime: '', exitTime: '' 
  }));
  const [schedule, setSchedule] = useState(initialSchedule);
  const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  useEffect(() => {
    if (!socket) return;

    // Carrega a lista inicial
    socket.emit('get-employees');

    // Listeners
    socket.on('employees-list', (data) => setEmployees(data));
    
    // Ao clicar em editar
    socket.on('employee-details', (data) => {
      if (!data.user) return;
      setEditingId(data.user.id);
      
      setFormData({
        name: data.user.name,
        cpf: data.user.cpf,
        cargo: data.user.cargo || '',
        password: '', // Senha sempre vazia por segurança
        role: data.user.role || 'employee'
      });

      // Se tiver horários, preenche
      if (data.schedule && data.schedule.length > 0) {
        const newSchedule = [...initialSchedule];
        data.schedule.forEach(day => {
          newSchedule[day.day_of_week] = { 
            day_of_week: day.day_of_week, 
            entryTime: day.entry_time || '', 
            exitTime: day.exit_time || '' 
          };
        });
        setSchedule(newSchedule);
      } else {
        setSchedule(initialSchedule);
      }
      
      setShowModal(true);
    });

    // Sucesso e Erro
    const handleSuccess = (res) => {
      setMessage({ text: res.message, type: 'success' });
      setTimeout(() => { 
        closeModal(); 
        socket.emit('get-employees'); // Recarrega a lista
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

  // Função genérica para abrir modal dependendo do tipo
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

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validações básicas
    if (!formData.name || !formData.cpf) return setMessage({ text: 'Nome e CPF são obrigatórios!', type: 'error' });
    
    // Senha é obrigatória para Admin e Funcionario novos
    if (!editingId && formData.role !== 'visitor' && !formData.password) {
        return setMessage({ text: 'Senha é obrigatória!', type: 'error' });
    }

    const dataToSend = { 
        id: editingId, 
        ...formData, 
        // Se for visitante, não mandamos o schedule (é null)
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
      {/* Botões de Ação */}
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

      {/* Tabela de Usuários */}
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
                        {/* Badge Colorido dependendo do cargo */}
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
      
      {/* MODAL UNIFICADO */}
      {showModal && (
        <>
            <div className="modal-overlay" onClick={closeModal}></div>
            <div className="modal">
                <div className="modal-header">
                    <h2 className="modal-title">
                        {editingId ? 'Editar Usuário' : `Novo ${formData.role === 'visitor' ? 'Visitante' : (formData.role === 'admin' ? 'Admin' : 'Funcionário')}`}
                    </h2>
                    <button className="modal-close" onClick={closeModal}>✕</button>
                </div>
                
                <div className="modal-body">
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Nome:</label>
                        <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
                    </div>
                    <div className="form-group">
                        <label>CPF:</label>
                        <input type="text" name="cpf" value={formData.cpf} onChange={handleInputChange} required disabled={!!editingId} />
                    </div>
                    
                    {/* Campos de Senha e Cargo (Escondidos se for Visitante Novo, pois visitante usa CPF como senha) */}
                    {formData.role !== 'visitor' && (
                        <>
                            <div className="form-group">
                                <label>Senha:</label>
                                <input 
                                    type="password" 
                                    name="password" 
                                    value={formData.password} 
                                    onChange={handleInputChange} 
                                    placeholder={editingId ? "Deixe em branco para não alterar" : "Senha de acesso"} 
                                />
                            </div>
                            <div className="form-group">
                                <label>Cargo:</label>
                                <input type="text" name="cargo" value={formData.cargo} onChange={handleInputChange} />
                            </div>
                        </>
                    )}

                    {formData.role === 'visitor' && (
                        <p style={{fontSize: '0.9rem', color: '#666', marginBottom: '15px'}}>
                            ℹ️ Visitantes usam o próprio CPF como senha para bater ponto.
                        </p>
                    )}

                    {/* Editor de Jornada (Apenas para Funcionários e Admins) */}
                    {formData.role !== 'visitor' && (
                        <>
                            <h3 style={{fontSize: '1rem', marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '10px'}}>
                                Jornada de Trabalho
                            </h3>
                            <div id="schedule-editor">
                            {daysOfWeek.map((day, idx) => (
                                <div className="schedule-day-row" key={idx}>
                                <label>{day}:</label>
                                <input type="time" value={schedule[idx].entryTime} onChange={(e) => handleScheduleChange(idx, 'entryTime', e.target.value)} />
                                <span>às</span>
                                <input type="time" value={schedule[idx].exitTime} onChange={(e) => handleScheduleChange(idx, 'exitTime', e.target.value)} />
                                </div>
                            ))}
                            </div>
                        </>
                    )}

                    {message.text && (
                        <div style={{
                            marginTop: '10px', 
                            padding: '10px', 
                            borderRadius: '4px', 
                            backgroundColor: message.type === 'error' ? '#fee2e2' : '#dcfce7',
                            color: message.type === 'error' ? '#991b1b' : '#166534'
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