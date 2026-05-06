import axios from 'axios';

// Sistema de Notificação de Loading
type Listener = (isLoading: boolean) => void;
let listeners: Listener[] = [];
let activeRequests = 0;
let loadingTimer: any = null;
let isLoaderVisible = false; // Controle para evitar re-renderizações desnecessárias

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
      isLoaderVisible = true;
      notifyListeners(true);
    }, 300);
  }
};

const handleRequestEnd = () => {
  activeRequests--;
  // Garante que nunca fique negativo e limpa corretamente
  if (activeRequests <= 0) {
    activeRequests = 0;
    
    // Se terminou antes do tempo limite, cancela o timer
    if (loadingTimer) {
      clearTimeout(loadingTimer);
      loadingTimer = null;
    }
    
    // Só notifica o fechamento se o loader chegou a aparecer na tela
    if (isLoaderVisible) {
      isLoaderVisible = false;
      notifyListeners(false);
    }
  }
};

// Função inteligente para definir o endereço da API
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

// --- INTERCEPTADORES INTELIGENTES ---

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // LÓGICA DE FILTRO ANTI-FLICKER:
    // 1. Verifica se é GET (leitura)
    const isGetRequest = config.method?.toLowerCase() === 'get';
    // 2. Verifica se tem opção explícita de pular
    const skipOption = (config as any).skipLoading;
    
    // Se não tiver opção explícita, assume TRUE (pular) para GET e FALSE para o resto
    const shouldSkip = skipOption !== undefined ? skipOption : isGetRequest;

    if (!shouldSkip) {
      (config as any)._usesLoader = true; // Marca que essa requisição ativou o loader
      handleRequestStart(); 
    }
    
    return config;
  },
  (error) => {
    // Se deu erro antes de sair e estava usando loader, finaliza
    if ((error.config as any)?._usesLoader) {
      handleRequestEnd(); 
    }
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    // Só finaliza se essa requisição específica ativou o loader
    if ((response.config as any)._usesLoader) {
      handleRequestEnd(); 
    }
    return response;
  },
  (error) => {
    // Só finaliza se essa requisição específica ativou o loader
    if ((error.config as any)?._usesLoader) {
      handleRequestEnd(); 
    }
    return Promise.reject(error);
  }
);


// ==========================================
// PAINEL DE TI (DEV TASKS)
// ==========================================

export const getDevTasks = async (): Promise<any[]> => {
  const response = await api.get('/dev-tasks');
  return response.data.map((task: any) => ({
    ...task,
    start: new Date(task.start_time),
    end: new Date(task.end_time)
  }));
};

export const createDevTask = async (taskData: {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  priority: 'baixa' | 'media' | 'alta';
  status: 'pendente' | 'concluida';
}): Promise<any> => {
  const response = await api.post('/dev-tasks', taskData);
  return response.data;
};

// ==========================================
// PRODUTOS
// ==========================================

export const updateProductPrices = async (id: number | string, data: { unit_price: number, sales_price: number }): Promise<any> => {
  const response = await api.patch(`/products/${id}/prices`, data);
  return response.data;
};

// ==========================================
// VIAGENS E CONFRONTOS
// ==========================================

/**
 * Apaga um confronto de viagem existente.
 * Se a viagem estiver aberta, devolve as reservas ao estoque.
 * Se estiver concluída, desfaz os movimentos de estoque físico.
 * 
 * @param travelId ID da viagem a ser apagada
 * @returns Resposta de sucesso do backend
 */
export const deleteTravel = async (travelId: string): Promise<any> => {
  // CORREÇÃO: Alterado de '/travels/' para '/travel-orders/' para alinhar com o backend.
  const response = await api.delete(`/travel-orders/${travelId}`);
  return response.data;
};
