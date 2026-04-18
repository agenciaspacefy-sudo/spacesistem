import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

const savedTheme = localStorage.getItem('spacefy-theme');
document.documentElement.setAttribute('data-theme', savedTheme === 'light' ? 'light' : 'dark');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
