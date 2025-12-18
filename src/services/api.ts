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

// --- FUNÇÕES AUXILIARES ---

const handleRequestStart = () => {
  activeRequests++;
  if (activeRequests === 1) {
    // Só exibe o loading se a requisição demorar mais de 300ms
    loadingTimer = setTimeout(() => {
      notifyListeners(true);
    }, 300);
  }
};

const handleRequestEnd = () => {
  activeRequests--;
  // Garante que nunca fique negativo e limpa corretamente
  if (activeRequests <= 0) {
    activeRequests = 0;
    if (loadingTimer) {
      clearTimeout(loadingTimer);
      loadingTimer = null;
    }
    notifyListeners(false);
  }
};

// Função inteligente para definir o endereço
const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  const { hostname } = window.location;
  if (hostname === 'localhost') {
    return 'http://localhost:3000';
  }
  return `http://${hostname}:3000`;
};

export const api = axios.create({
  baseURL: getBaseUrl(),
});

// --- INTERCEPTADORES COM LÓGICA DE SKIP LOADING ---

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // CORREÇÃO: Só inicia o loading SE NÃO tiver a flag skipLoading
    if (!(config as any).skipLoading) {
      handleRequestStart(); 
    }
    
    return config;
  },
  (error) => {
    // Se deu erro e não era silenciosa, finaliza
    if (!(error.config as any)?.skipLoading) {
      handleRequestEnd(); 
    }
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    // Se não era silenciosa, finaliza o loader
    if (!(response.config as any).skipLoading) {
      handleRequestEnd(); 
    }
    return response;
  },
  (error) => {
    // Se não era silenciosa, finaliza o loader
    if (!(error.config as any)?.skipLoading) {
      handleRequestEnd(); 
    }
    return Promise.reject(error);
  }
);