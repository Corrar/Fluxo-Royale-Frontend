import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";

export default function Inicio() {
  const { profile } = useAuth();
  const [date, setDate] = useState(new Date());

  // Atualiza o relógio (opcional, apenas para dar vida à tela minimalista)
  useEffect(() => {
    const timer = setInterval(() => setDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = date.toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });

  return (
    // Removi 'rounded', 'border' e margens para eliminar o fundo branco visível
    <div className="relative w-full h-full min-h-[85vh] flex flex-col items-center justify-center overflow-hidden">
      
      {/* --- WALLPAPER DE FUNDO --- */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transform scale-105"
        style={{ 
          backgroundImage: "url('/wallpaper-chefe.png')",
        }}
      >
        {/* Gradiente Escuro: Mais elegante que uma cor sólida, melhora a leitura no centro */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-slate-950/30" />
      </div>

      {/* --- CONTEÚDO MINIMALISTA --- */}
      <div className="relative z-10 text-center space-y-6 px-4 animate-in fade-in zoom-in duration-1000">
        
        {/* Data Discreta */}
        <p className="text-emerald-400/80 font-mono text-sm tracking-[0.2em] uppercase mb-4">
          {formattedDate}
        </p>

        {/* Título Principal - Tipografia Grande e Impactante */}
        <h1 className="text-6xl md:text-9xl font-black text-white tracking-tighter drop-shadow-2xl">
          FLUXO
          <span className="text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-cyan-600">.</span>
        </h1>

        {/* Subtítulo / Saudação */}
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl text-slate-200 font-light tracking-wide">
            Bem-vindo, <span className="font-semibold text-white">{profile?.name}</span>
          </h2>
          <p className="text-slate-400 text-sm md:text-base font-light max-w-lg mx-auto leading-relaxed">
            Controle de movimentação de estoque.
          </p>
        </div>

      </div>

      {/* Rodapé Sutil */}
      <div className="absolute bottom-6 text-slate-500 text-[10px] uppercase tracking-[0.3em] opacity-50">
       
      </div>
    </div>
  );
}