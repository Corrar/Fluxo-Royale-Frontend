import React, { useState } from "react";
import { ScrollParticles } from "@/components/ScrollParticles";
import { ThemeToggle } from "@/components/ThemeToggle"; // CORRIGIDO AQUI
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PackagePlus, Recycle, Undo2, Sparkles } from "lucide-react";

// Os teus painéis reais de sistema (com a lógica de BD)
import { NewStockPanel } from '@/components/withdrawal/NewStockPanel';
import { ReusedStockPanel } from '@/components/withdrawal/ReusedStockPanel';
import { StockReturnPanel } from '@/components/withdrawal/StockReturnPanel';

const HERO_TABS = [
  { id: "novos", label: "Produtos Novos", desc: "Entrada via NFe — rápida e direta", icon: PackagePlus },
  { id: "reuso", label: "Reaproveitados", desc: "Materiais reutilizados, classificados automaticamente", icon: Recycle },
  { id: "devolucao", label: "Devolução", desc: "Devolução por OP, com setor e responsável", icon: Undo2 },
];

function Hero({ active, setActive }: { active: string; setActive: (v: string) => void }) {
  const current = HERO_TABS.find((t) => t.id === active)!;
  const Icon = current.icon;

  return (
    <section className="relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
      <div className="absolute inset-0 opacity-[0.12]" style={{
        backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, #facc15 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />
      <div className="absolute -top-32 -right-32 size-96 rounded-full blur-3xl opacity-30" style={{ background: "var(--gradient-accent)" }} />
      <div className="relative max-w-6xl mx-auto px-6 py-24">
        
        {/* CORRIGIDO AQUI - Usar ThemeToggle em vez de ModeToggle */}
        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>

        <Badge className="bg-white/15 text-white border-white/25 backdrop-blur mb-6 hover:bg-white/20">
          <Sparkles className="size-3 mr-1" style={{ color: "#facc15" }} /> Módulo de Estoque
        </Badge>
        <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight max-w-3xl">
          Entrada de Materiais{" "}
          <span style={{ color: "#facc15" }}>Inteligente</span>
        </h1>
        <p className="text-white/85 text-lg mt-4 max-w-2xl">
          Centralize o recebimento de NFe, reaproveitamento e devoluções em um único fluxo.
        </p>

        <div className="mt-10 flex flex-wrap gap-2">
          {HERO_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                active === t.id
                  ? "bg-[#facc15] text-[#1e1b4b] shadow-lg scale-105"
                  : "bg-white/10 text-white hover:bg-white/20 border border-white/15"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div key={current.id} className="mt-8 flex items-center gap-4 animate-in fade-in duration-500">
          <div className="size-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center border border-white/20">
            <Icon className="size-7" style={{ color: "#facc15" }} />
          </div>
          <div>
            <div className="text-white font-semibold text-xl">{current.label}</div>
            <div className="text-white/75 text-sm">{current.desc}</div>
          </div>
        </div>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-1 h-72"
        style={{
          background:
            "linear-gradient(to bottom, transparent 0%, color-mix(in oklab, var(--background) 15%, transparent) 25%, color-mix(in oklab, var(--background) 45%, transparent) 55%, color-mix(in oklab, var(--background) 80%, transparent) 80%, var(--background) 100%)",
        }}
      />
    </section>
  );
}

const TAB_ORDER = ["novos", "reuso", "devolucao"] as const;

export default function MaterialEntries() {
  const [heroActive, setHeroActive] = useState<string>("novos");
  const [tab, setTab] = useState<string>("novos");
  const [direction, setDirection] = useState<"right" | "left">("right");

  const changeTab = (v: string) => {
    const from = TAB_ORDER.indexOf(tab as typeof TAB_ORDER[number]);
    const to = TAB_ORDER.indexOf(v as typeof TAB_ORDER[number]);
    setDirection(to >= from ? "right" : "left");
    setTab(v);
    setHeroActive(v);
  };

  const enterClass = direction === "right" ? "tab-enter-right" : "tab-enter-left";

  return (
    <div className="min-h-screen bg-background relative pb-20 md:pb-0">
      <ScrollParticles density={80} />
      
      <div className="relative z-10">
        <Hero active={heroActive} setActive={changeTab} />

        <main className="max-w-5xl mx-auto px-4 md:px-6 py-12 -mt-12 relative">
          <Card className="p-4 md:p-8 backdrop-blur bg-card/95 border-border/60 rounded-2xl md:rounded-[2rem]" style={{ boxShadow: "var(--shadow-elegant)" }}>
            <Tabs value={tab} onValueChange={changeTab} className="w-full">
              
              <TabsList className="hidden md:grid grid-cols-3 w-full mb-8 h-12 bg-muted/50 rounded-xl p-1">
                <TabsTrigger value="novos" className="rounded-lg h-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <PackagePlus className="size-4 mr-2" /> Novos (NFe)
                </TabsTrigger>
                <TabsTrigger value="reuso" className="rounded-lg h-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Recycle className="size-4 mr-2" /> Reaproveitados
                </TabsTrigger>
                <TabsTrigger value="devolucao" className="rounded-lg h-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Undo2 className="size-4 mr-2" /> Devolução de OP
                </TabsTrigger>
              </TabsList>

              <div className="relative overflow-hidden min-h-[400px]">
                <TabsContent value="novos" key={`novos-${tab}`} className={enterClass} forceMount={tab === "novos" ? true : undefined} hidden={tab !== "novos"}>
                  <div className="tab-stagger"><NewStockPanel /></div>
                </TabsContent>
                
                <TabsContent value="reuso" key={`reuso-${tab}`} className={enterClass} forceMount={tab === "reuso" ? true : undefined} hidden={tab !== "reuso"}>
                  <div className="tab-stagger"><ReusedStockPanel /></div>
                </TabsContent>
                
                <TabsContent value="devolucao" key={`devolucao-${tab}`} className={enterClass} forceMount={tab === "devolucao" ? true : undefined} hidden={tab !== "devolucao"}>
                  <div className="tab-stagger"><StockReturnPanel /></div>
                </TabsContent>
              </div>

            </Tabs>
          </Card>
        </main>
      </div>
    </div>
  );
}
