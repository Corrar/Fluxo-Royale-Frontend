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

// --- FUNÇÕES AUXILIARES (Nova Lógica de Segurança) ---

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
  // 1. PRIORIDADE: Variável de ambiente (Produção)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  const { hostname } = window.location;
  
  // 2. FALLBACK: Desenvolvimento Local
  if (hostname === 'localhost') {
    return 'http://localhost:3000';
  }
  
  // Se estiver no Celular (IP), usa o IP do PC
  return `http://${hostname}:3000`;
};

export const api = axios.create({
  baseURL: getBaseUrl(),
});

// --- INTERCEPTADORES ---

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    handleRequestStart(); // Inicia contagem
    return config;
  },
  (error) => {
    handleRequestEnd(); // Finaliza se der erro na montagem da requisição
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    handleRequestEnd(); // Finaliza no sucesso
    return response;
  },
  (error) => {
    handleRequestEnd(); // Finaliza no erro de resposta
    return Promise.reject(error);
  }
);