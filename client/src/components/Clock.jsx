import React, { useState, useEffect } from 'react';

function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    // Atualiza o estado a cada 1 segundo (1000ms)
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    // Limpeza do timer quando sair da tela
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{
        fontSize: '2.5rem', 
        fontWeight: 'bold', 
        color: 'var(--primary-color)', /* Usa a cor azul do tema */
        textAlign: 'center',
        marginBottom: '20px',
        fontFamily: 'monospace', /* Fonte estilo digital */
        letterSpacing: '2px'
    }}>
      {/* Mostra HH:MM:SS no formato brasileiro */}
      {time.toLocaleTimeString('pt-BR')}
    </div>
  );
}

export default Clock;