    // Importa React y el sistema de renderizado
import React from 'react';
import ReactDOM from 'react-dom/client';

// Importa el componente principal de la aplicación
import App from './App.jsx';

// [CRÍTICO] - Importa los estilos globales (generados por Tailwind)
import './index.css'; 

// Renderiza la aplicación en el DOM
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

