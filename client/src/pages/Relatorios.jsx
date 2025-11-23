import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function Relatorios() {
  const socket = useSocket();
  const [reportData, setReportData] = useState([]);
  const [monthYear, setMonthYear] = useState('');

  // 1. Define mês atual
  useEffect(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    setMonthYear(`${yyyy}-${mm}`);
  }, []);

  // 2. Busca dados
  useEffect(() => {
    if (!socket || !monthYear) return;
    
    // Envia MM-YYYY para o servidor
    const [year, month] = monthYear.split('-');
    socket.emit('get-monthly-report', { monthYear: `${month}-${year}` });

    socket.on('monthly-report-data', (data) => {
      console.log("Dados recebidos no front:", data); // Log para debug no navegador
      setReportData(data);
    });

    // Atualiza se houver novos registros
    socket.on('refresh-data', () => {
        socket.emit('get-monthly-report', { monthYear: `${month}-${year}` });
    });

    return () => {
      socket.off('monthly-report-data');
      socket.off('refresh-data');
    };
  }, [socket, monthYear]);

  const chartData = {
    labels: reportData.map(u => u.name),
    datasets: [{
      label: 'Horas Trabalhadas',
      data: reportData.map(u => u.total_hours), // Certifique-se que são números
      backgroundColor: 'rgba(37, 99, 235, 0.7)',
      borderColor: 'rgba(37, 99, 235, 1)',
      borderWidth: 1,
      borderRadius: 4
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Produtividade (Horas)' }
    },
    scales: { y: { beginAtZero: true } }
  };

  return (
    <div className="container">
      <div className="content-box">
        <label style={{marginRight: '10px', fontWeight: 'bold'}}>Mês de Referência:</label>
        <input 
            type="month" 
            value={monthYear} 
            onChange={(e) => setMonthYear(e.target.value)}
            style={{padding: '5px', borderRadius: '5px', border: '1px solid #ccc'}}
        />
      </div>

      <div className="content-box">
        <h2>Gráfico de Produtividade</h2>
        
        {/* Container fixo para o gráfico não sumir nem explodir */}
        <div style={{ position: 'relative', height: '400px', width: '100%', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                {reportData.length > 0 ? (
                    <Bar data={chartData} options={chartOptions} />
                ) : (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        <p style={{ color: '#888' }}>
                           Nenhum dado encontrado para {monthYear}. <br/>
                           <small>(Verifique se há funcionários cadastrados e pontos batidos neste mês)</small>
                        </p>
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="content-box">
        <h2>Detalhamento</h2>
        <div className="records-container">
            <table>
                <thead>
                    <tr><th>Funcionário</th><th>Horas Totais</th><th>Atestados</th></tr>
                </thead>
                <tbody>
                    {reportData.length === 0 ? (
                        <tr><td colSpan="3" style={{textAlign:'center'}}>Sem dados.</td></tr>
                    ) : (
                        reportData.map(u => (
                            <tr key={u.id}>
                                <td>{u.name}</td>
                                <td className="duration">{u.total_hours}h <small style={{color:'#888', fontWeight:'normal'}}>({u.total_minutes} min)</small></td>
                                <td>{u.certs_count > 0 ? <span style={{color:'orange', fontWeight:'bold'}}>{u.certs_count} Atestado(s)</span> : '—'}</td>
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

export default Relatorios;