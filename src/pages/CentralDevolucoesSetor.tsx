import React, { useState } from "react";
import { 
  Package, Truck, CheckCircle, Clock, Plus, Search, 
  ArrowLeftRight, FileText, ChevronRight
} from "lucide-react";

// Interface para as Devoluções
interface DevolucaoOP {
  id: string;
  op: string;
  material: string;
  quantidade: number;
  dataSolicitacao: string;
  stepAtual: number;
}

// ============================================================================
// COMPONENTE DA LINHA DO TEMPO (EXATAMENTE COMO NO SEU HTML)
// ============================================================================
const TimelineTracker = ({ currentStep }: { currentStep: number }) => {
  const steps = [
    { title: "Solicitado", sub: "Setor", icon: Clock },
    { title: "Aguardando", sub: "Coleta", icon: Package },
    { title: "Em Trânsito", sub: "Transporte", icon: Truck },
    { title: "Recebido", sub: "Almoxarifado", icon: CheckCircle }
  ];

  return (
    <div style={{ display: "flex", width: "100%", overflowX: "auto", padding: "16px 0", msOverflowStyle: "none", scrollbarWidth: "none" }}>
      {steps.map((step, i) => {
        const Icon = step.icon;
        const on = i <= currentStep;
        
        return (
          <React.Fragment key={i}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 120, flexShrink: 0 }}>
              <div 
                style={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: "50%", 
                  display: "grid", 
                  placeItems: "center",
                  background: on ? "#34d27f" : "#1e293b", // Verde idêntico ou fundo escuro
                  color: on ? "#06210f" : "#94a3b8",      // Contraste do ícone
                  border: on ? "none" : "1px solid #334155",
                  transition: "all 0.3s ease"
                }}
              >
                <Icon size={20} strokeWidth={on ? 2.5 : 2} />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: on ? "#ffffff" : "#94a3b8", lineHeight: 1.25, transition: "color 0.3s ease" }}>
                  {step.title}
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  {step.sub}
                </div>
              </div>
            </div>
            
            {/* Linha Conectora */}
            {i < steps.length - 1 && (
              <div style={{ flex: "none", width: 48, height: 2, background: "#334155", marginTop: 19, position: "relative" }}>
                 <div style={{ 
                   position: "absolute", top: 0, left: 0, height: "100%", 
                   background: "#34d27f", 
                   width: i < currentStep ? "100%" : "0%",
                   transition: "width 0.5s ease" 
                 }}></div>
              </div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  );
};

export default function CentralDevolucoesSetor() {
  const [busca, setBusca] = useState("");

  // Dados mockados
  const devolucoes: DevolucaoOP[] = [
    { id: "DEV-1001", op: "OP-4590", material: "Cabo de Cobre 4mm", quantidade: 15, dataSolicitacao: "15/06/2026", stepAtual: 1 },
    { id: "DEV-1002", op: "OP-4591", material: "Disjuntor 32A", quantidade: 5, dataSolicitacao: "14/06/2026", stepAtual: 3 },
    { id: "DEV-1003", op: "OP-4602", material: "Tubulação PVC 20mm", quantidade: 50, dataSolicitacao: "15/06/2026", stepAtual: 0 },
  ];

  return (
    // Fundo da página usando a cor exata do seu HTML (#090d13)
    <div style={{ backgroundColor: "#090d13", minHeight: "100vh", padding: "24px", color: "#ffffff", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        
        {/* Cabeçalho Fiel */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, display: "flex", alignItems: "center", gap: 12, margin: 0 }}>
              <div style={{ background: "rgba(52, 210, 127, 0.1)", padding: 8, borderRadius: 8 }}>
                <ArrowLeftRight size={24} color="#34d27f" />
              </div>
              Devolução de OP · Setor
            </h1>
            {/* O ERRO FOI CORRIGIDO AQUI: marginBottom no lugar de marginBotoom */}
            <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 4, marginBottom: 0 }}>
              Gerencie o retorno de materiais excedentes para o almoxarifado
            </p>
          </div>
          <button 
            style={{ 
              background: "#34d27f", color: "#06210f", border: "none", borderRadius: 8, 
              padding: "10px 16px", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8,
              cursor: "pointer", outline: "none"
            }}
          >
            <Plus size={18} /> Nova Devolução
          </button>
        </div>

        {/* Barra de Busca e Filtros */}
        <div style={{ background: "#172030", border: "1px solid #1e293b", borderRadius: 12, padding: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, position: "relative", minWidth: 250 }}>
            <Search size={18} color="#64748b" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input 
              type="text" 
              placeholder="Buscar por OP ou ID de Devolução..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{ 
                width: "100%", background: "#090d13", border: "1px solid #334155", color: "#fff",
                borderRadius: 8, padding: "10px 14px 10px 40px", fontSize: 14, outline: "none"
              }}
            />
          </div>
          <button style={{ background: "transparent", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8, padding: "0 16px", fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <FileText size={16} /> Relatório
          </button>
        </div>

        {/* Lista de Devoluções */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {devolucoes.map((dev) => (
            <div key={dev.id} style={{ background: "#172030", border: "1px solid #1e293b", borderRadius: 16, overflow: "hidden" }}>
              
              {/* Topo do Card */}
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#f8fafc" }}>{dev.id}</h3>
                    <span style={{ background: "rgba(242, 169, 59, 0.15)", color: "#f2a93b", border: "1px solid rgba(242, 169, 59, 0.3)", padding: "4px 10px", borderRadius: 100, fontSize: 12, fontWeight: 600 }}>
                      {dev.op}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 8 }}>
                    <strong style={{ color: "#e2e8f0" }}>{dev.quantidade}x</strong> {dev.material} • Solicitado em {dev.dataSolicitacao}
                  </div>
                </div>
                
                <button style={{ background: "transparent", border: "none", color: "#34d27f", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                  Ver Detalhes <ChevronRight size={16} />
                </button>
              </div>

              {/* Área do Tracker (Linha do Tempo) */}
              <div style={{ padding: "16px 24px", background: "rgba(9, 13, 19, 0.3)" }}>
                <TimelineTracker currentStep={dev.stepAtual} />
              </div>

            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
