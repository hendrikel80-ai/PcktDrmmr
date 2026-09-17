import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import MobileApp from './components/MobileApp.jsx';
import './index.css';

// Kein zweites Projekt/keine zweite Build-Pipeline für die Mobile-App
// (siehe Plan "Pocket Studio Mobile") — reine Laufzeit-Verzweigung per
// URL-Parameter, damit Tauri (das index.html immer ohne Query-String lädt)
// von dieser Änderung strukturell gar nicht betroffen sein kann.
const isMobile = new URLSearchParams(window.location.search).has('mobile');
const Root = isMobile ? MobileApp : App;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
