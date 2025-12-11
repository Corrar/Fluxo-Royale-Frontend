import axios from 'axios';

// Sistema de Notificação de Loading
type Listener = (isLoading: boolean) => void;
let listeners: Listener[] = [];
let activeRequests = 0;
let loadingTimer: any = null;

export const subscribeToLoading = (listener: Listener) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
};

const notifyListeners = (isLoading: boolean) => {
  listeners.forEach(l => l(isLoading));
};

// Função inteligente para definir o endereço
const getBaseUrl = () => {
  // 1. PRIORIDADE: Variável de ambiente (Produção)
  // Quando você fizer o deploy na Vercel, você definirá a variável 'VITE_API_URL'
  // com o link do seu backend (ex: https://seu-backend.onrender.com)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  const { hostname } = window.location;
  
  // 2. FALLBACK: Desenvolvimento Local
  // Se estiver no PC (localhost), usa localhost
  if (hostname === 'localhost') {
    return 'http://localhost:3000';
  }
  
  // Se estiver no Celular (IP), usa o IP do PC
  return `http://${hostname}:3000`;
};

export const api = axios.create({
  baseURL: getBaseUrl(),
});

// Interceptadores
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  activeRequests++;
  
  // Só ativa o loading se a requisição demorar mais de 300ms
  if (activeRequests === 1) {
    loadingTimer = setTimeout(() => {
      notifyListeners(true);
    }, 300);
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    activeRequests--;
    if (activeRequests === 0) {
      if (loadingTimer) clearTimeout(loadingTimer);
      notifyListeners(false);
    }
    return response;
  },
  (error) => {
    activeRequests--;
    if (activeRequests === 0) {
      if (loadingTimer) clearTimeout(loadingTimer);
      notifyListeners(false);
    }
    return Promise.reject(error);
  }
);