import { createContext, useContext, useState, type ReactNode } from "react";

export type Material = "PLA" | "ABS" | "PETG" | "TPU" | "Nylon";
export type Priority = "Baixa" | "Média" | "Alta" | "Urgente";
export type DemandStatus = "Em análise" | "Aceita" | "Em desenvolvimento" | "Concluída";

export interface Part {
  id: string;
  code: string;
  name: string;
  image: string;
  productionMinutes: number;
  filamentGrams: number;
  material: Material;
  description?: string;
}

export interface Demand {
  id: string;
  partId: string;
  quantity: number;
  opNumber: string;
  priority: Priority;
  status: DemandStatus;
  notes?: string;
  createdAt: string;
  requester: string;
}

export interface Production {
  id: string;
  partId: string;
  quantity: number;
  totalMinutes: number;
  filamentGrams: number;
  date: string;
  operator?: string;
  demandId?: string;
}

const sampleImg = (seed: string) =>
  `https://images.unsplash.com/photo-${seed}?w=600&q=80&auto=format&fit=crop`;

// --- DADOS INICIAIS ---
const initialParts: Part[] = [
  { id: "p1", code: "ENG-001", name: "Engrenagem Helicoidal", image: sampleImg("1581092160562-40aa08e78837"), productionMinutes: 145, filamentGrams: 48, material: "PLA", description: "Engrenagem para transmissão mecânica leve." },
  { id: "p2", code: "SUP-014", name: "Suporte Articulado", image: sampleImg("1635070041078-e363dbe005cb"), productionMinutes: 220, filamentGrams: 92, material: "PETG", description: "Suporte ajustável para câmera." },
  { id: "p3", code: "CXA-007", name: "Caixa Modular", image: sampleImg("1611532736597-de2d4265fba3"), productionMinutes: 380, filamentGrams: 165, material: "ABS", description: "Caixa eletrônica empilhável." },
  { id: "p4", code: "BUC-022", name: "Bucha de Encaixe", image: sampleImg("1581090700227-1e37b190418e"), productionMinutes: 35, filamentGrams: 12, material: "PLA" },
  { id: "p5", code: "FLE-003", name: "Conector Flexível", image: sampleImg("1518770660439-4636190af475"), productionMinutes: 90, filamentGrams: 28, material: "TPU" },
  { id: "p6", code: "PRT-019", name: "Protótipo Carcaça", image: sampleImg("1581090464777-f3220bbe1b8b"), productionMinutes: 510, filamentGrams: 240, material: "ABS" },
];

const initialDemands: Demand[] = [
  { id: "d1", partId: "p1", quantity: 12, opNumber: "OP-2031", priority: "Alta", status: "Em desenvolvimento", createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), requester: "Engenharia", notes: "Lote para validação." },
  { id: "d2", partId: "p3", quantity: 4, opNumber: "OP-2034", priority: "Urgente", status: "Aceita", createdAt: new Date(Date.now() - 86400000).toISOString(), requester: "Produção" },
  { id: "d3", partId: "p4", quantity: 50, opNumber: "OP-2036", priority: "Média", status: "Em análise", createdAt: new Date().toISOString(), requester: "Manutenção" },
  { id: "d4", partId: "p2", quantity: 8, opNumber: "OP-2028", priority: "Baixa", status: "Concluída", createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), requester: "P&D" },
  { id: "d5", partId: "p5", quantity: 20, opNumber: "OP-2039", priority: "Alta", status: "Em análise", createdAt: new Date().toISOString(), requester: "Qualidade" },
];

const QTY_SEQ = [3, 5, 2, 6, 4, 1, 5, 3, 2, 4, 6, 3];
const EXTRA_SEQ = [10, 22, 5, 18, 27, 12, 8, 14, 20, 3, 25, 16];
const initialProductions: Production[] = Array.from({ length: 12 }).map((_, i) => {
  const part = initialParts[i % initialParts.length];
  const qty = QTY_SEQ[i];
  return {
    id: `pr${i}`,
    partId: part.id,
    quantity: qty,
    totalMinutes: part.productionMinutes * qty + EXTRA_SEQ[i],
    filamentGrams: part.filamentGrams * qty,
    date: new Date(2026, 4, 6 - (11 - i)).toISOString(),
    operator: ["Marcos", "Luiza", "Pedro"][i % 3],
  };
});

// --- DEFINIÇÃO DO CONTEXTO ---
interface StoreCtx {
  parts: Part[];
  demands: Demand[];
  productions: Production[];
  addPart: (p: Omit<Part, "id">) => void;
  updatePart: (id: string, p: Partial<Part>) => void;
  deletePart: (id: string) => void;
  addDemand: (d: Omit<Demand, "id" | "createdAt" | "status">) => void;
  updateDemandStatus: (id: string, status: DemandStatus) => void;
  deleteDemand: (id: string) => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [parts, setParts] = useState<Part[]>(initialParts);
  const [demands, setDemands] = useState<Demand[]>(initialDemands);
  const [productions] = useState<Production[]>(initialProductions);

  const value: StoreCtx = {
    parts,
    demands,
    productions,
    addPart: (p) => setParts((s) => [...s, { ...p, id: `p${Date.now()}` }]),
    updatePart: (id, p) => setParts((s) => s.map((x) => (x.id === id ? { ...x, ...p } : x))),
    deletePart: (id) => setParts((s) => s.filter((x) => x.id !== id)),
    addDemand: (d) =>
      setDemands((s) => [
        { ...d, id: `d${Date.now()}`, createdAt: new Date().toISOString(), status: "Em análise" },
        ...s,
      ]),
    updateDemandStatus: (id, status) =>
      setDemands((s) => s.map((x) => (x.id === id ? { ...x, status } : x))),
    deleteDemand: (id) => setDemands((s) => s.filter((x) => x.id !== id)),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore deve ser usado dentro de um StoreProvider");
  return ctx;
}

// Utilitários exportados
export const formatMinutes = (m: number) => {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}min` : `${min}min`;
};

export const priorityColor: Record<Priority, string> = {
  Baixa: "bg-muted text-muted-foreground",
  Média: "bg-info/15 text-info",
  Alta: "bg-warning/20 text-warning",
  Urgente: "bg-destructive/15 text-destructive",
};

export const statusColor: Record<DemandStatus, string> = {
  "Em análise": "bg-muted text-muted-foreground",
  Aceita: "bg-info/15 text-info",
  "Em desenvolvimento": "bg-warning/20 text-warning",
  Concluída: "bg-success/15 text-success",
};

export const STATUS_FLOW: DemandStatus[] = ["Em análise", "Aceita", "Em desenvolvimento", "Concluída"];
