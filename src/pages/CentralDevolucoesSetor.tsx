// src/pages/CentralDevolucoesSetor.tsx
import React, { useState } from "react";
import { 
  Package, Truck, CheckCircle, Clock, Plus, Search, 
  ArrowLeftRight, FileText 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// Interface para simular os dados das Devoluções de OP
interface DevolucaoOP {
  id: string;
  op: string;
  material: string;
  quantidade: number;
  dataSolicitacao: string;
  stepAtual: number;
}

// Componente da Linha do Tempo (Extraído e adaptado do seu HTML)
const TimelineTracker = ({ currentStep }: { currentStep: number }) => {
  const steps = [
    { title: "Solicitado", sub: "Setor", icon: Clock },
    { title: "Aguardando", sub: "Coleta", icon: Package },
    { title: "Em Trânsito", sub: "Transporte", icon: Truck },
    { title: "Recebido", sub: "Almoxarifado", icon: CheckCircle }
  ];

  return (
    <div className="flex items-start w-full overflow-x-auto py-4">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isCompleted = i <= currentStep;
        
        return (
          <React.Fragment key={i}>
            {/* Círculo e Textos */}
            <div className="flex flex-col items-center gap-2 w-[120px] sm:w-[150px]">
              <div 
                className={`w-10 h-10 rounded-full grid place-items-center transition-colors duration-300
                ${isCompleted 
                  ? 'bg-emerald-500 text-white shadow-md' 
                  : 'bg-secondary text-muted-foreground border border-border'}`}
              >
                <Icon size={20} />
              </div>
              <div className="text-center mt-1">
                <div className={`text-[12.5px] font-semibold leading-tight ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.title}
                </div>
                <div className="text-[11px] text-muted-foreground">{step.sub}</div>
              </div>
            </div>
            
            {/* Linha Conectora */}
            {i < steps.length - 1 && (
              <div className="flex-none w-8 sm:w-12 h-[2px] mt-5 bg-border relative">
                <div 
                  className={`absolute top-0 left-0 h-full bg-emerald-500 transition-all duration-500 ${isCompleted ? 'w-full' : 'w-0'}`} 
                />
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

  // Dados mockados para visualização inicial
  const devolucoes: DevolucaoOP[] = [
    { id: "DEV-1001", op: "OP-4590", material: "Cabo de Cobre 4mm", quantidade: 15, dataSolicitacao: "15/06/2026", stepAtual: 1 },
    { id: "DEV-1002", op: "OP-4591", material: "Disjuntor 32A", quantidade: 5, dataSolicitacao: "14/06/2026", stepAtual: 3 },
    { id: "DEV-1003", op: "OP-4602", material: "Tubulação PVC 20mm", quantidade: 50, dataSolicitacao: "15/06/2026", stepAtual: 0 },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ArrowLeftRight className="text-emerald-600" />
            Central de Devolução
          </h1>
          <p className="text-muted-foreground text-sm">Gerencie o retorno de materiais excedentes das OPs (Visão Setor)</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="mr-2 h-4 w-4" /> Nova Devolução
        </Button>
      </div>

      {/* Barra de Ferramentas */}
      <Card>
        <CardContent className="p-4 flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por OP ou ID de Devolução..." 
              className="pl-9"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Button variant="outline"><FileText className="mr-2 h-4 w-4" /> Relatório</Button>
        </CardContent>
      </Card>

      {/* Lista de Devoluções Ativas */}
      <div className="grid gap-6">
        {devolucoes.map((dev) => (
          <Card key={dev.id} className="overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {dev.id} <Badge variant="outline">{dev.op}</Badge>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {dev.quantidade}x {dev.material} • Solicitado em {dev.dataSolicitacao}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm">Ver Detalhes</Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {/* Aqui renderizamos o componente de Tracking extraído do seu modelo */}
              <TimelineTracker currentStep={dev.stepAtual} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
