// src/main.tsx
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Registra o Service Worker e escuta por atualizações
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('🔄 Nova versão do sistema detectada! Recarregando...');
              
              // 🔥 O TRUQUE: Deixa uma flag na memória antes de forçar o F5
              localStorage.setItem('fluxo_royale_updated', 'true');
              
              // Força o recarregamento automático
              window.location.reload();
            }
          });
        }
      });
    }).catch((error) => {
      console.error('Falha ao registrar o Service Worker:', error);
    });
  });
}

// Renderiza o App normalmente
createRoot(document.getElementById("root")!).render(<App />);
