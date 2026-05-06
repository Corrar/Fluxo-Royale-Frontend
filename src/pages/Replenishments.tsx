import React, {
  useState,
  useMemo,
  useDeferredValue,
  useCallback,
  type ChangeEvent,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

// Importações do PDF
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

import {
  Plus,
  Minus,
  Trash2,
  Search,
  Save,
  Check,
  Loader2,
  X,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Download,
  ShoppingCart,
  Package,
  Zap,
  Pencil,
  MapPin,
  RefreshCw,
  Truck,
  RotateCcw,
  Clock,
  ShieldAlert,
  ArrowRight,
  Filter
} from "lucide-react";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// FRAMER MOTION
import {
  LazyMotion,
  domAnimation,
  m,
  AnimatePresence,
} from "framer-motion";

// ===================== HELPERS =====================
const isDecimalUnit = (unit?: string) => {
  if (!unit) return false;
  const u = unit.toUpperCase().trim();
  return ["M", "MT", "METRO", "METROS", "KG", "QUILO", "KILO", "KILOS", "L", "LT", "LITRO", "LITROS"].includes(u);
};

const removeAccents = (str: string) => {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

// ===================== TYPES =====================
interface IApiError {
  message: string;
  response?: {
    status?: number;
    data?: {
      error?: string;
    };
  };
}

interface IStock {
  quantity_on_hand: number;
  quantity_reserved: number;
}

interface IProduct {
  id: string;
  name: string;
  sku: string;
  unit: string;
  unit_price?: number;
  stock?: IStock;
  stock_available?: number;
  min_stock?: number;
}

interface IReplenishmentItem {
  id: string;
  product_id: string;
  quantity: number; 
  qty_requested: number;
  products?: IProduct;
}

interface IReplenishment {
  id: string;
  order_number: string;
  client_name: string;
  city_state: string;
  status: "pendente" | "em_preparo" | "concluido";
  created_at: string;
  shipping_info?: string;
  tracking_code?: string;
  total_value?: number;
  items: IReplenishmentItem[];
}

interface ICreateReplenishmentPayload {
  order_number: string;
  client_name: string;
  city_state: string;
  total_value: number;
  status: string;
  items: { product_id: string; qty_requested: number }[];
}

interface IAuthorizePayload {
  id: string;
  items: { id: string; quantity?: number }[];
  statusAction: "reservar" | "entregar" | "reverter";
  shippingInfo?: string;
  trackingCode?: string;
}

interface ITrackingEvent {
  descricao: string;
  dtHrCriado: string;
  unidade?: {
    tipo: string;
    endereco?: { cidade: string; uf: string };
  };
  unidadeDestino?: {
    tipo: string;
    endereco?: { cidade: string; uf: string };
  };
}

interface ITrackingData {
  eventos: ITrackingEvent[];
  usage?: {
    count: number;
    limit: number;
  };
}

const smoothCurve: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

// ===================== UI HELPERS =====================
const EmptyState = ({ title, description }: { title: string; description: string }) => (
    <m.div 
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, ease: smoothCurve }}
      className="flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-muted/30 min-h-[350px]"
    >
      <div className="h-20 w-20 rounded-full bg-background shadow-sm flex items-center justify-center mb-6">
        <RefreshCw className="h-10 w-10 text-muted-foreground/40" />
      </div>
      <h3 className="text-2xl font-bold tracking-tight text-foreground mb-2">{title}</h3>
      <p className="text-base text-muted-foreground max-w-sm mb-8">{description}</p>
    </m.div>
);

const CustomProgressBar = ({ value, max, className, indicatorColor }: { value: number, max: number, className?: string, indicatorColor?: string }) => {
    const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
    return (
        <div className={cn("h-1.5 w-full bg-secondary rounded-full overflow-hidden", className)}>
            <div 
                className={cn("h-full transition-all duration-500 ease-out", indicatorColor || "bg-primary")}
                style={{ width: `${pct}%` }}
            />
        </div>
    )
}

// ===================== CATALOG ITEM =====================
interface CatalogItemProps {
  product: IProduct;
  quantityInCart: number;
  onAdd: () => void;
  onRemove: () => void;
  onUpdateQuantity: (val: number) => void;
}

const CatalogItem = ({ product, quantityInCart, onAdd, onRemove, onUpdateQuantity }: CatalogItemProps) => {
  const stockPhysical = product.stock?.quantity_on_hand ?? 0;
  const stockReserved = product.stock?.quantity_reserved ?? 0;
  const stockAvailable = product.stock_available ?? Math.max(0, stockPhysical - stockReserved);
  
  const stock = stockAvailable;
  const hasStock = stock > 0;
  const minStock = product.min_stock || 10;
  
  const isExceedingStock = quantityInCart > stock;
  const stockColor = stock === 0 ? "bg-muted-foreground/20" : stock < minStock ? "bg-amber-400" : "bg-emerald-500";
  const allowDecimal = isDecimalUnit(product.unit);

  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = allowDecimal ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
    if (isNaN(val)) val = 0;
    onUpdateQuantity(val);
  };

  return (
    <m.div 
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: false, margin: "-10% 0px -10% 0px" }}
      transition={{ duration: 0.4, ease: smoothCurve }}
      className={cn(
        "group flex flex-col p-5 rounded-3xl transition-all duration-300",
        quantityInCart > 0 && !isExceedingStock ? "bg-primary/[0.03] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-primary/10" : 
        isExceedingStock ? "bg-amber-500/5 shadow-[0_4px_20px_-4px_rgba(245,158,11,0.1)] border border-amber-500/20" : 
        "bg-card shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-transparent hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)]"
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3 pointer-events-none">
         <div className="flex-1 min-w-0">
             <Badge variant="secondary" className="font-mono text-[10px] font-medium tracking-wider text-muted-foreground bg-muted/50 border-0 mb-2 px-2 py-0.5 rounded-md">
                {product.sku}
             </Badge>
             <h4 className="font-bold text-base leading-tight text-foreground break-words whitespace-normal">{product.name}</h4>
         </div>
         <div className="flex flex-col items-end shrink-0 gap-1">
             {!hasStock && quantityInCart === 0 && (
                <Badge variant="outline" className="text-[10px] font-semibold text-destructive border-destructive/30 bg-destructive/5 rounded-full px-2">Esgotado</Badge>
             )}
             {isExceedingStock && (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-[10px] font-bold px-2 py-0.5 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Excede Estoque
                </Badge>
             )}
         </div>
      </div>
      
      <div className="mt-auto pt-2 flex items-end justify-between gap-4">
         <div className="flex-1 max-w-[140px] space-y-1.5 pointer-events-none">
            <span className={cn("text-xs font-semibold block", !hasStock ? "text-destructive" : "text-muted-foreground")}>
                {stock} {product.unit} disponíveis
            </span>
            <CustomProgressBar value={stock} max={minStock * 2} indicatorColor={stockColor} className="h-1.5" />
         </div>

         <div onClick={(e) => e.stopPropagation()}>
            {quantityInCart > 0 ? (
              <div className={cn(
                  "flex items-center bg-background rounded-2xl shadow-sm border p-1 transition-all",
                  isExceedingStock ? "border-amber-300 ring-2 ring-amber-500/20" : "border-primary/20 ring-2 ring-primary/5"
              )}>
                <m.button
                  whileTap={{ scale: 0.85 }}
                  onClick={onRemove}
                  className="flex items-center justify-center h-8 w-8 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Minus className="h-4 w-4" />
                </m.button>
                
                <Input 
                    type="number"
                    step={allowDecimal ? "any" : "1"}
                    className={cn(
                        "h-8 w-14 border-0 text-center font-black text-base p-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent shadow-none",
                        isExceedingStock ? "text-amber-600 dark:text-amber-400" : "text-primary"
                    )}
                    value={quantityInCart === 0 ? "" : quantityInCart}
                    onChange={handleManualInput}
                    min={0}
                />

                <m.button 
                  whileTap={{ scale: 0.85 }}
                  onClick={onAdd}
                  className="flex items-center justify-center h-8 w-8 rounded-xl text-primary hover:bg-primary/10"
                >
                  <Plus className="h-4 w-4" />
                </m.button>
              </div>
            ) : (
              <m.button 
                whileTap={{ scale: 0.95 }}
                className={cn(
                    "flex items-center justify-center rounded-2xl font-bold px-6 h-10 transition-all duration-300",
                    hasStock ? "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground shadow-none" : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                )}
                onClick={onAdd}
              >
                Adicionar
              </m.button>
            )}
         </div>
      </div>
    </m.div>
  );
};

// ===================== REPLENISHMENT CARD =====================
const ReplenishmentCard = ({ rep, onClick }: { rep: IReplenishment; onClick: () => void; }) => {
  const total = rep.items.length;
  const done = rep.items.filter(i => i.quantity >= i.qty_requested).length;
  const progress = total > 0 ? (done / total) * 100 : 0;
  
  let totalRequestedQty = 0;
  let totalSeparatedQty = 0;

  rep.items.forEach(item => {
      totalRequestedQty += Number(item.qty_requested) || 0;
      totalSeparatedQty += Number(item.quantity) || 0;
  });

  const bgStatus: Record<string, string> = {
      pendente: "bg-amber-500",
      em_preparo: "bg-blue-500",
      concluido: "bg-emerald-500"
  };

  const statusColors: Record<string, string> = {
      pendente: "border-amber-500/50 hover:border-amber-500",
      em_preparo: "border-blue-500/50 hover:border-blue-500", 
      concluido: "border-emerald-500/50 hover:border-emerald-500",
  };

  const displayStatus = rep.status.replace("_", " ");
  
  const formattedTotalValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rep.total_value || 0);

  return (
    <m.div 
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: smoothCurve }}
        viewport={{ once: false, margin: "-15% 0px -15% 0px" }}
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.96 }}
        onClick={onClick}
        className={cn(
            "group relative flex flex-col justify-between rounded-2xl border-2 bg-card p-5 cursor-pointer shadow-sm hover:shadow-xl h-full",
            statusColors[rep.status] || "border-border"
        )}
    >
        <div className="flex justify-between items-start mb-3 pointer-events-none">
            <Badge variant="outline" className="font-mono bg-background shadow-sm border-muted-foreground/30">
                {rep.order_number}
            </Badge>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                {format(new Date(rep.created_at), "dd MMM")}
            </span>
        </div>

        <div className="flex-1 mb-2 pointer-events-none">
            <h3 className="text-xl font-black uppercase leading-tight tracking-tight text-foreground break-words whitespace-normal">
                {rep.client_name}
            </h3>
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span className="truncate">{rep.city_state}</span>
            </div>
            {rep.shipping_info && (
               <div className="flex flex-wrap items-center gap-2 mt-1.5">
                   <div className="flex items-center gap-1.5 text-xs text-primary/80 bg-primary/10 p-1.5 px-2.5 rounded-lg w-fit">
                       <Truck className="h-3.5 w-3.5" />
                       <span className="truncate font-semibold">{rep.shipping_info}</span>
                   </div>
                   {rep.tracking_code && (
                       <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 p-1.5 px-2.5 rounded-lg w-fit">
                           <Package className="h-3.5 w-3.5" />
                           <span className="truncate font-semibold">{rep.tracking_code.toUpperCase().replace(/\s/g, '')}</span>
                       </div>
                   )}
               </div>
            )}
        </div>

        <div className="space-y-3 pt-4 mt-4 border-t border-border/50 pointer-events-none">
            <div className="flex justify-between items-end gap-3">
                <div className="flex flex-col min-w-0">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Itens</span>
                    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                        <span className={cn("text-lg font-black truncate", progress === 100 ? "text-emerald-600" : "text-foreground")}>
                            {totalSeparatedQty} / {totalRequestedQty}
                        </span>
                    </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Valor Total</span>
                    <span className="text-sm font-bold text-foreground leading-none">
                        {formattedTotalValue}
                    </span>
                </div>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                    className={cn("h-full transition-all duration-500", bgStatus[rep.status] || "bg-primary")} 
                    style={{ width: `${progress}%` }} 
                />
            </div>
        </div>

        <div className="absolute -top-3 -right-2 pointer-events-none">
             <Badge className={cn("shadow-md uppercase text-[10px] px-2 h-6", bgStatus[rep.status])}>
                {displayStatus}
             </Badge>
        </div>
    </m.div>
  );
};

// ===================== DETAILED ITEM ROW =====================
interface ReplenishmentDetailedRowProps {
  item: IReplenishmentItem;
  inputValue: number | string;
  onChange: (val: string) => void;
  canEdit: boolean;
}

const ReplenishmentDetailedRow = ({ item, inputValue, onChange, canEdit }: ReplenishmentDetailedRowProps) => {
  const dbPhysical = item.products?.stock?.quantity_on_hand ?? 0;
  const dbReserved = item.products?.stock?.quantity_reserved ?? 0;
  const dbAvailable = item.products?.stock_available ?? Math.max(0, dbPhysical - dbReserved);

  const allowDecimal = isDecimalUnit(item.products?.unit);
  
  const dbReservedHere = item.quantity || 0;
  const numericInput = typeof inputValue === 'number' ? inputValue : parseFloat(inputValue as string) || 0;
  const projectedTotal = dbReservedHere + numericInput;

  const requested = item.qty_requested || 0;
  const isComplete = projectedTotal >= requested;
  
  const remainingRequest = Math.max(0, requested - dbReservedHere);
  const maxAddable = Math.min(remainingRequest, dbAvailable);
  const maxRevertable = dbReservedHere;

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    if (rawVal === '-' || rawVal === '') {
        onChange(rawVal); 
        return;
    }

    let val = allowDecimal ? parseFloat(rawVal) : parseInt(rawVal, 10);
    if (isNaN(val)) val = 0;
    
    if (val < 0 && Math.abs(val) > maxRevertable) {
        toast.warning(`Máximo para estornar: ${maxRevertable}`);
        val = -maxRevertable;
    }
    if (val > 0 && val > maxAddable) {
        toast.warning(`Estoque disponível insuficiente.`);
        val = maxAddable;
    }
    onChange(String(val));
  };

  const hasChange = numericInput !== 0;
  const quickFill = () => {
      if (maxAddable > 0) onChange(String(maxAddable));
      else toast.info("Estoque insuficiente ou pedido já completo.");
  };

  return (
    <m.div 
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: false, margin: "-10% 0px -10% 0px" }}
      transition={{ duration: 0.4, ease: smoothCurve }}
      className={cn(
      "relative flex flex-col sm:flex-row gap-5 p-5 rounded-3xl transition-all duration-300",
      isComplete ? "bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30" : "bg-card border border-transparent shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md",
      hasChange && "ring-2 ring-primary/30 border-primary/20 bg-primary/[0.02]"
    )}>
      
      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-3">
           <Badge variant="secondary" className="text-[10px] font-mono font-medium px-2 py-0.5 bg-muted/50 border-0">{item.products?.sku}</Badge>
           {isComplete && (
               <span className="text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-0.5 rounded-full animate-in zoom-in">
                   <CheckCircle2 className="h-3.5 w-3.5"/> Completo
               </span>
           )}
        </div>
        
        <div>
            <div className="font-bold text-lg leading-snug">{item.products?.name}</div>
        </div>

        <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                <span>Separado: <span className={cn("font-bold text-foreground", isComplete && "text-emerald-600 dark:text-emerald-400")}>{projectedTotal} / {requested}</span></span>
            </div>
            <CustomProgressBar value={projectedTotal} max={requested} indicatorColor={isComplete ? "bg-emerald-500" : "bg-primary"} className="h-1.5" />
        </div>
      </div>

      <div className="flex flex-col sm:items-end justify-between gap-4 min-w-[160px] pl-4 sm:border-l border-border/50">
         
         <div className="flex gap-6 text-sm sm:text-right w-full sm:w-auto justify-between sm:justify-end">
             <div className="flex flex-col">
                 <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mb-0.5">Disp. Estoque</span>
                 <span className="font-bold text-base">{dbAvailable}</span>
             </div>
             <div className="flex flex-col text-right">
                 <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mb-0.5">Reservado</span>
                 <span className={cn("font-bold text-base", hasChange && "text-primary")}>
                    {dbReservedHere}
                    {hasChange && <span className="text-xs ml-1 font-black bg-primary/10 px-1.5 py-0.5 rounded-md">({numericInput > 0 ? '+' : ''}{numericInput})</span>}
                 </span>
             </div>
         </div>

         {canEdit && (
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {!isComplete && maxAddable > 0 && (
                    <m.button 
                        whileTap={{ scale: 0.85 }}
                        className="flex items-center justify-center h-12 w-12 rounded-2xl bg-muted/30 text-primary hover:bg-primary/10 hover:text-primary transition-colors"
                        onClick={quickFill}
                        title="Completar Automaticamente"
                    >
                        <Zap className="h-5 w-5 fill-current opacity-80" />
                    </m.button>
                )}
                
                <div className="relative group flex items-center bg-background border shadow-sm rounded-2xl p-1 h-12">
                    <span className="absolute -top-3 left-3 bg-background px-1.5 text-[10px] font-bold text-muted-foreground transition-colors group-focus-within:text-primary rounded-full">
                        {numericInput < 0 ? "Estornar" : "Adicionar"}
                    </span>
                    <Input 
                        type="number"
                        step={allowDecimal ? "any" : "1"}
                        className={cn(
                            "h-full w-20 border-0 text-center font-black text-xl shadow-none focus-visible:ring-0 rounded-xl bg-transparent",
                            numericInput < 0 ? "text-red-500" : numericInput > 0 ? "text-emerald-500" : "text-foreground"
                        )}
                        placeholder="0"
                        value={inputValue === 0 ? "" : inputValue}
                        onChange={handleInputChange}
                    />
                </div>
            </div>
         )}
      </div>
    </m.div>
  );
};

// ===================== DETAILED VIEW =====================
interface DetailedViewProps {
  rep: IReplenishment;
  inputIncrements: Record<string, number | string>;
  setInputIncrements: React.Dispatch<React.SetStateAction<Record<string, number | string>>>;
  onBack: () => void;
  onDelete: (id: string) => void;
  onEdit: (rep: IReplenishment) => void;
  hasEdits: boolean;
  authorizeMutation: any;
  onSave: () => void;
  onDeliverCheck: () => void;
  onRevert: () => void;
  canManage: boolean; 
}

const DetailedView = ({
    rep,
    inputIncrements,
    setInputIncrements,
    onBack,
    onDelete,
    onEdit, 
    hasEdits,
    authorizeMutation,
    onSave,
    onDeliverCheck,
    onRevert,
    canManage 
}: DetailedViewProps) => {

    const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

    const isPending = rep.status === 'pendente' || rep.status === 'em_preparo';
    const isArchived = rep.status === 'concluido';

    const { data: trackingData, isLoading: isLoadingTracking, isError: isErrorTracking, error: trackingError } = useQuery<ITrackingData>({
        queryKey: ["tracking", rep.tracking_code],
        queryFn: async () => {
            const cleanCode = rep.tracking_code?.toUpperCase().replace(/\s/g, '') || "";
            try {
                const response = await api.get(`/tracking/${cleanCode}?t=${Date.now()}`);
                return response.data;
            } catch (err: unknown) {
                const e = err as IApiError;
                if (e.response?.status === 429) {
                    throw new Error('LIMIT_REACHED');
                }
                throw err;
            }
        },
        enabled: isTrackingModalOpen && !!rep.tracking_code,
    });

    const trackingEvents = trackingData?.eventos;
    const trackingUsage = trackingData?.usage;

    const { grandTotalRequested, grandTotalSeparated, progressPercent } = useMemo(() => {
        let req = 0;
        let sepTotal = 0;

        rep.items.forEach((item) => {
            const requestedQty = Number(item.qty_requested) || 0;
            const dbQuantity = item.quantity || 0;
            const inc = inputIncrements[item.id];
            const currentIncrement = typeof inc === 'number' ? inc : parseFloat(inc as string) || 0;
            const currentQuantity = Math.max(0, dbQuantity + currentIncrement);

            req += requestedQty;
            sepTotal += currentQuantity;
        });

        const pct = req > 0 ? (sepTotal / req) * 100 : 0;

        return {
            grandTotalRequested: req,
            grandTotalSeparated: sepTotal,
            progressPercent: Math.min(100, pct)
        };
    }, [rep, inputIncrements]); 

    const formattedOrderTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rep.total_value || 0);

    const generatePDF = (filter: 'all' | 'separated' | 'missing') => {
       
       let itemsToExport = rep.items;
       let subtitle = "Pedido Completo";

       if (filter === 'missing') {
           itemsToExport = rep.items.filter(item => item.qty_requested - item.quantity > 0);
           subtitle = "Itens Pendentes / Em Falta";
       } else if (filter === 'separated') {
           itemsToExport = rep.items.filter(item => item.quantity > 0);
           subtitle = "Somente Itens Separados";
       }

       if (itemsToExport.length === 0) {
           toast.warning("Não há itens para esta categoria selecionada.");
           return;
       }

       const doc = new jsPDF();
       
       // Header
       doc.setFontSize(22);
       doc.setTextColor(0, 0, 0);
       doc.setFont("helvetica", "bold");
       doc.text("Pedido de Reposição", 14, 20);
       
       doc.setFontSize(12);
       doc.setTextColor(100);
       doc.setFont("helvetica", "normal");
       doc.text(subtitle, 14, 28);
       
       doc.setFontSize(10);
       doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 34);
       
       // Info Box
       doc.setFillColor(240, 240, 240);
       doc.rect(14, 40, 182, 28, 'F');
       doc.setFontSize(12);
       doc.setTextColor(0);
       doc.setFont("helvetica", "bold");
       doc.text(`Cliente: ${rep.client_name}`, 18, 48);
       doc.text(`Nº Pedido: ${rep.order_number}`, 18, 56);
       doc.setFont("helvetica", "normal");
       doc.text(`Cidade/UF: ${rep.city_state}`, 120, 48);
       doc.text(`Status: ${rep.status.toUpperCase().replace('_', ' ')}`, 120, 56);
       doc.text(`Data Pedido: ${format(new Date(rep.created_at), "dd/MM/yyyy")}`, 18, 64);
       
       let startY = 78;
       if (rep.shipping_info) {
          doc.setFont("helvetica", "bold");
          doc.text(`Enviado por: ${rep.shipping_info}`, 18, 70);
          if (rep.tracking_code) {
              doc.text(`Rastreio: ${rep.tracking_code}`, 18, 76);
              startY = 84;
          }
       }
       
       const totalItems = rep.items.length;
       const completedItems = rep.items.filter((i) => i.quantity >= i.qty_requested).length;
       const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
       
       doc.setFontSize(10);
       doc.setFont("helvetica", "normal");
       doc.text(`Progresso: ${progress.toFixed(0)}% Concluído`, 120, 64);
       doc.text(`Valor Total: ${formattedOrderTotal}`, 120, 70);
       
       // Table
       const tableRows = itemsToExport.map((item) => {
           const requested = item.qty_requested;
           const separated = item.quantity;
           const missing = Math.max(0, requested - separated);
           const stock = item.products?.stock?.quantity_on_hand ?? item.products?.stock_available ?? 0;
           const status = separated >= requested ? "Completo" : "Pendente";
           return [`${item.products?.sku}\n${item.products?.name}`, requested, separated, missing > 0 ? missing : "-", stock, status];
       });

       autoTable(doc, {
           startY: startY,
           head: [['Produto / SKU', 'Solicitado', 'Separado', 'Falta', 'Estoque Atual', 'Status']],
           body: tableRows,
           headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
           styles: { fontSize: 9, valign: 'middle', cellPadding: 3 },
           columnStyles: {
               0: { cellWidth: 70 }, 1: { halign: 'center' }, 2: { halign: 'center', fontStyle: 'bold' },
               3: { halign: 'center', textColor: [220, 53, 69] }, 4: { halign: 'center' }, 5: { halign: 'center' }
           },
           didParseCell: (data) => {
               if (data.section === 'body' && data.column.index === 5) {
                   if (String(data.cell.raw) === 'Pendente') { 
                       data.cell.styles.textColor = [220, 53, 69]; 
                   } else { 
                       data.cell.styles.textColor = [40, 167, 69]; 
                   }
               }
           }
       });
       
       const internalDoc = doc as jsPDF & { internal: { getNumberOfPages: () => number } };
       const pageCount = internalDoc.internal.getNumberOfPages();

       for(let i = 1; i <= pageCount; i++) {
           doc.setPage(i);
           doc.setFontSize(8);
           doc.setTextColor(150);
           doc.text('Fluxo Royale - Sistema de Controle de Estoque', 14, doc.internal.pageSize.getHeight() - 10);
           doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 10);
       }
       doc.save(`Reposicao_${rep.order_number}_${rep.client_name}.pdf`);
    };

    return (
       <m.div 
         initial={{ opacity: 0, x: 20 }} 
         animate={{ opacity: 1, x: 0 }} 
         exit={{ opacity: 0, x: -20 }}
         transition={{ duration: 0.3 }}
         className="bg-background min-h-screen flex flex-col w-full pb-32"
       >
          <m.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: smoothCurve }}
            className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b shadow-sm"
          >
              <div className="w-full px-4 sm:container py-5">
                  <div className="flex items-center gap-4 mb-4">
                      <m.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={onBack} 
                        className="flex items-center justify-center hover:bg-muted/80 rounded-full h-12 w-12 shrink-0"
                      >
                          <ArrowLeft className="h-6 w-6" />
                      </m.button>
                      <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-[10px] font-mono bg-muted/30 border-0">{rep.order_number}</Badge>
                              <Badge className={cn("text-[10px] border-0 shadow-none", 
                                  isArchived ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : 
                                  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              )}>
                                  {isArchived ? "Concluído" : "Em Preparo"}
                              </Badge>
                          </div>
                          <h1 className="text-2xl md:text-3xl font-black tracking-tight truncate text-foreground break-words whitespace-normal">{rep.client_name}</h1>
                      </div>

                      <div className="hidden lg:flex flex-col items-end mr-6 px-6 border-r border-border/50">
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mb-1">Valor do Pedido</span>
                          <span className="text-xl font-black text-foreground leading-none">
                              {formattedOrderTotal}
                          </span>
                      </div>
                      
                      <div className="hidden lg:flex flex-col items-end mr-6 px-6 border-r border-border/50">
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mb-1">Itens Separados</span>
                          <span className="text-2xl font-black text-primary leading-none">
                              {grandTotalSeparated} / {grandTotalRequested}
                          </span>
                      </div>

                      <m.button 
                        whileTap={{ scale: 0.95 }}
                        className="hidden sm:flex items-center gap-2 px-4 h-10 rounded-xl font-bold bg-muted/50 hover:bg-muted"
                        onClick={() => setIsPdfModalOpen(true)}
                      >
                          <FileText className="h-4 w-4" />
                          Gerar PDF
                      </m.button>
                      
                      <m.button 
                        whileTap={{ scale: 0.9 }}
                        className="sm:hidden flex items-center justify-center shrink-0 h-10 w-10 rounded-full bg-muted/50" 
                        onClick={() => setIsPdfModalOpen(true)}
                      >
                          <Download className="h-5 w-5" />
                      </m.button>

                      {isPending && canManage && (
                          <div className="flex items-center ml-2 border-l border-border/50 pl-2 gap-1">
                            <m.button 
                                whileTap={{ scale: 0.85 }}
                                className="flex items-center justify-center rounded-full h-12 w-12 text-muted-foreground hover:bg-primary/10 hover:text-primary shrink-0" 
                                onClick={() => onEdit(rep)}
                                title="Editar Pedido"
                            >
                                <Pencil className="h-5 w-5" />
                            </m.button>
                            <m.button 
                                whileTap={{ scale: 0.85 }}
                                className="flex items-center justify-center rounded-full h-12 w-12 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0" 
                                onClick={() => onDelete(rep.id)}
                                title="Excluir Pedido"
                            >
                                <Trash2 className="h-5 w-5" />
                            </m.button>
                          </div>
                      )}

                      {isArchived && canManage && (
                          <m.button 
                              whileTap={{ scale: 0.95 }}
                              className="hidden sm:flex items-center gap-2 px-4 h-10 rounded-xl font-bold bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 ml-2 border border-amber-500/20 shrink-0"
                              onClick={onRevert}
                              disabled={authorizeMutation.isPending}
                          >
                              {authorizeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                              Reverter Pedido
                          </m.button>
                      )}
                  </div>

                  <div className="bg-muted/30 rounded-full p-1 mt-2 flex items-center gap-3">
                      <div className="flex-1 h-2 bg-secondary/50 rounded-full overflow-hidden ml-2">
                          <div 
                              className="h-full bg-primary transition-all duration-700 ease-out rounded-full" 
                              style={{ width: `${progressPercent}%` }} 
                          />
                      </div>
                      <span className="text-xs font-bold text-foreground mr-3">{progressPercent.toFixed(0)}%</span>
                  </div>
                  
                  {isArchived && rep.shipping_info && (
                      <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
                          <div className="flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 p-2.5 px-4 rounded-xl w-fit">
                                  <Truck className="h-4 w-4" />
                                  <span className="font-bold">Enviado por: {rep.shipping_info}</span>
                              </div>
                              {rep.tracking_code && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-2.5 px-4 rounded-xl w-fit">
                                      <Package className="h-4 w-4" />
                                      <span className="font-bold">Rastreio: {rep.tracking_code.toUpperCase().replace(/\s/g, '')}</span>
                                  </div>
                              )}
                          </div>
                          
                          {rep.tracking_code && (
                              <m.button 
                                  whileTap={{ scale: 0.95 }}
                                  className="flex items-center justify-center gap-2 px-4 h-11 rounded-xl font-bold bg-blue-500 text-white hover:bg-blue-600 shadow-md transition-colors"
                                  onClick={() => setIsTrackingModalOpen(true)}
                              >
                                  <MapPin className="h-4 w-4" />
                                  Acompanhar Entrega
                              </m.button>
                          )}
                      </div>
                  )}

                  {isArchived && canManage && (
                      <m.button 
                          whileTap={{ scale: 0.95 }}
                          className="sm:hidden flex mt-4 items-center justify-center gap-2 w-full h-12 rounded-xl font-bold bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/20"
                          onClick={onRevert}
                          disabled={authorizeMutation.isPending}
                      >
                          {authorizeMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <RotateCcw className="h-5 w-5" />}
                          Reverter Pedido para Pendente
                      </m.button>
                  )}

              </div>
          </m.div>

          <div className="flex-1 w-full px-4 sm:container py-8">
              <div className="space-y-4">
                 {rep.items.map((item) => (
                     <ReplenishmentDetailedRow
                        key={item.id}
                        item={item}
                        inputValue={inputIncrements[item.id] || 0}
                        onChange={(val: string) => setInputIncrements((prev) => ({ ...prev, [item.id]: val }))}
                        canEdit={isPending && canManage}
                     />
                 ))}
              </div>
          </div>

          {isPending && canManage && (
             <m.div 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: smoothCurve }}
                className="fixed bottom-6 left-4 right-4 lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-3xl bg-background/90 backdrop-blur-xl border border-border/50 rounded-[2rem] p-3 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] z-50 transition-all"
             >
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="hidden sm:flex flex-1 items-center px-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Itens Reservados</span>
                            <span className="font-bold text-lg text-primary">{grandTotalSeparated} unidades</span>
                        </div>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                        <m.button 
                            whileTap={{ scale: 0.95 }}
                            className="flex items-center justify-center flex-1 sm:flex-none h-14 px-6 rounded-2xl font-bold bg-muted hover:bg-muted/80 text-foreground transition-all"
                            disabled={!hasEdits || authorizeMutation.isPending}
                            onClick={onSave}
                        >
                            {authorizeMutation.isPending ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="mr-2 h-5 w-5" />}
                            Salvar
                        </m.button>
                        <m.button 
                            whileTap={{ scale: 0.95 }}
                            className="flex items-center justify-center flex-1 sm:flex-none h-14 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/25 transition-all disabled:opacity-50"
                            onClick={onDeliverCheck}
                            disabled={authorizeMutation.isPending}
                        >
                            <CheckCircle2 className="mr-2 h-5 w-5" />
                            Finalizar Pedido
                        </m.button>
                    </div>
                </div>
             </m.div>
          )}

          {/* ===================== MODAL EXPORTAR PDF ===================== */}
          <Dialog open={isPdfModalOpen} onOpenChange={setIsPdfModalOpen}>
              <DialogContent className="sm:max-w-[400px] p-6 rounded-[2rem] border-0 shadow-2xl bg-background">
                  <div className="flex flex-col items-center justify-center text-center gap-2 mb-6">
                      <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
                          <FileText className="h-7 w-7 text-primary" />
                      </div>
                      <DialogTitle className="text-2xl font-black">Exportar PDF</DialogTitle>
                      <DialogDescription className="text-base text-muted-foreground">
                          Escolha quais itens deseja incluir no documento.
                      </DialogDescription>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                      <m.button 
                          whileTap={{ scale: 0.98 }}
                          onClick={() => { generatePDF('all'); setIsPdfModalOpen(false); }}
                          className="flex items-center justify-between p-4 rounded-2xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
                      >
                          <div className="flex flex-col">
                              <span className="font-bold text-foreground">Pedido Completo</span>
                              <span className="text-xs text-muted-foreground">Todos os itens solicitados</span>
                          </div>
                          <FileText className="h-5 w-5 text-muted-foreground" />
                      </m.button>

                      <m.button 
                          whileTap={{ scale: 0.98 }}
                          onClick={() => { generatePDF('separated'); setIsPdfModalOpen(false); }}
                          className="flex items-center justify-between p-4 rounded-2xl border border-border/50 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left"
                      >
                          <div className="flex flex-col">
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">Somente Separados</span>
                              <span className="text-xs text-muted-foreground">Itens que já foram bipados/separados</span>
                          </div>
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 opacity-70" />
                      </m.button>

                      <m.button 
                          whileTap={{ scale: 0.98 }}
                          onClick={() => { generatePDF('missing'); setIsPdfModalOpen(false); }}
                          className="flex items-center justify-between p-4 rounded-2xl border border-border/50 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-left"
                      >
                          <div className="flex flex-col">
                              <span className="font-bold text-amber-600 dark:text-amber-500">Em Falta / Pendentes</span>
                              <span className="text-xs text-muted-foreground">Itens que ainda precisam ser separados</span>
                          </div>
                          <AlertTriangle className="h-5 w-5 text-amber-500 opacity-70" />
                      </m.button>
                  </div>
                  
                  <div className="mt-4 flex justify-center">
                     <DialogClose asChild>
                         <Button variant="ghost" className="rounded-xl font-bold w-full h-12">Cancelar</Button>
                     </DialogClose>
                  </div>
              </DialogContent>
          </Dialog>

          {/* ===================== MODAL DE RASTREIO ===================== */}
          <Dialog open={isTrackingModalOpen} onOpenChange={setIsTrackingModalOpen}>
              <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto rounded-3xl">
                  <DialogHeader className="mb-2 flex flex-row items-start justify-between pr-6">
                      <div>
                          <DialogTitle className="flex items-center gap-2 text-2xl font-black">
                              <Truck className="h-6 w-6 text-primary" />
                              Rastreio da Encomenda
                          </DialogTitle>
                          <DialogDescription className="text-base mt-1">
                              Código: <span className="font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded-md ml-1">{rep.tracking_code?.toUpperCase().replace(/\s/g, '')}</span>
                          </DialogDescription>
                      </div>
                      
                      {trackingUsage && (
                          <div className="flex flex-col items-end text-right">
                              <Badge variant={trackingUsage.count >= 950 ? "destructive" : "secondary"} className="shadow-sm px-2 py-1 text-xs">
                                  {trackingUsage.count} / {trackingUsage.limit}
                              </Badge>
                              <span className="text-[9px] text-muted-foreground mt-1 font-bold uppercase tracking-wider">Usos no Mês</span>
                          </div>
                      )}
                  </DialogHeader>

                  <div className="py-2">
                      {isLoadingTracking ? (
                          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                              <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
                              <p className="font-medium text-lg">Consultando transportadora...</p>
                          </div>
                      ) : isErrorTracking ? (
                           (trackingError as Error)?.message === 'LIMIT_REACHED' ? (
                               <div className="flex flex-col items-center justify-center py-10 text-center text-amber-600 dark:text-amber-500">
                                   <ShieldAlert className="h-14 w-14 mb-3 opacity-90" />
                                   <span className="font-black text-xl mb-1">Limite Atingido!</span>
                                   <span className="text-sm font-medium mt-1 max-w-[280px]">Você atingiu o limite de 1000 rastreios gratuitos deste mês. O sistema bloqueou a consulta para evitar cobranças excedentes.</span>
                               </div>
                           ) : (
                               <div className="flex flex-col items-center justify-center py-10 text-center text-destructive">
                                   <AlertTriangle className="h-10 w-10 mb-3 opacity-80" />
                                   <span className="font-bold text-lg">Serviço Indisponível</span>
                                   <span className="text-sm opacity-80 mt-1 max-w-[250px]">Não foi possível obter os dados no momento. Tente novamente mais tarde.</span>
                               </div>
                           )
                      ) : !trackingEvents || trackingEvents.length === 0 ? (
                           <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                               <Package className="h-10 w-10 mb-3 opacity-50" />
                               <span className="font-bold text-lg">Aguardando Atualização</span>
                               <span className="text-sm opacity-80 mt-1 max-w-[250px]">O código já está no sistema, mas ainda não possui movimentações.</span>
                           </div>
                      ) : (
                           <div className="relative border-l-2 border-border/50 ml-5 pl-6 space-y-8 mt-4 pb-4">
                               {trackingEvents.map((event: ITrackingEvent, index: number) => {
                                   const statusLower = event.descricao.toLowerCase();
                                   const isDelivered = statusLower.includes("entregue");
                                   const isTransit = statusLower.includes("em trânsito") || statusLower.includes("encaminhado") || statusLower.includes("saiu para entrega");

                                   return (
                                       <m.div 
                                           initial={{ opacity: 0, x: -10 }}
                                           animate={{ opacity: 1, x: 0 }}
                                           transition={{ delay: index * 0.1 }}
                                           key={index} 
                                           className="relative"
                                       >
                                           <div className={cn(
                                               "absolute -left-[41px] h-8 w-8 rounded-full flex items-center justify-center border-4 border-background shadow-sm",
                                               isDelivered ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                               isTransit ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-muted text-muted-foreground'
                                           )}>
                                               {isDelivered ? <CheckCircle2 className="h-4 w-4" /> :
                                                isTransit ? <Truck className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                                           </div>

                                           <div className="flex flex-col gap-1.5 pt-1">
                                               <h4 className={cn("text-base font-bold leading-tight", index === 0 ? "text-primary" : "text-foreground")}>
                                                   {event.descricao}
                                               </h4>

                                               {event.unidade && (
                                                  <div className="flex items-center gap-2 mt-1 text-xs font-medium text-muted-foreground">
                                                      <MapPin className="h-3.5 w-3.5 opacity-70" />
                                                      <span>{event.unidade.tipo} - {event.unidade.endereco?.cidade}/{event.unidade.endereco?.uf}</span>
                                                  </div>
                                               )}

                                               {event.unidadeDestino && (
                                                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mt-0.5">
                                                      <Truck className="h-3.5 w-3.5 opacity-70 ml-0.5" />
                                                      <span>Para: {event.unidadeDestino.tipo} - {event.unidadeDestino.endereco?.cidade}/{event.unidadeDestino.endereco?.uf}</span>
                                                  </div>
                                               )}

                                               <div className="flex items-center gap-1.5 mt-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/40 w-fit px-2.5 py-1 rounded-md">
                                                  <Clock className="h-3.5 w-3.5 opacity-70" />
                                                  {format(new Date(event.dtHrCriado), "dd/MM/yyyy 'às' HH:mm")}
                                               </div>
                                           </div>
                                       </m.div>
                                   );
                               })}
                           </div>
                      )}
                  </div>
              </DialogContent>
          </Dialog>

       </m.div>
    );
};


// ===================== MAIN =====================
export default function Replenishments() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const canManage = profile?.role === 'admin' || profile?.role === 'almoxarife';
  
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inputIncrements, setInputIncrements] = useState<Record<string, number | string>>({});
  
  const [deliveryModal, setDeliveryModal] = useState({ open: false, isPartial: false, shippingInfo: "", trackingCode: "" });

  const [activeTab, setActiveTab] = useState<"pendente" | "em_preparo" | "concluido">("pendente");
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);

  // Estados dos Filtros Avançados
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterTracking, setFilterTracking] = useState<"all" | "with" | "without">("all");
  const [filterShipping, setFilterShipping] = useState<string>("all");
  
  const [isNewSheetOpen, setIsNewSheetOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [editingReplenishmentId, setEditingReplenishmentId] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [cityState, setCityState] = useState("");
  const [totalValue, setTotalValue] = useState<string>("");
  
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Record<string, number>>({});
  const [showStockOnly, setShowStockOnly] = useState(false); 

  // ===================== QUERIES =====================
  const { data: replenishments = [], isLoading: isLoadingReps } = useQuery({
    queryKey: ["replenishments"],
    queryFn: async () => {
      return (await api.get("/replenishments")).data;
    },
  });

  const { data: products = [], isLoading: isLoadingProds } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      return (await api.get("/products")).data;
    },
  });

  // Lista única de Métodos de Envio para os filtros
  const uniqueShippingMethods = useMemo(() => {
      const methods = (replenishments as IReplenishment[])
          .map(r => r.shipping_info)
          .filter((info): info is string => !!info && info.trim().length > 0);
      return Array.from(new Set(methods)).sort();
  }, [replenishments]);

  // ===================== LOGIC =====================
  const selectedReplenishment = useMemo<IReplenishment | null>(() => {
    if (!selectedId) return null;
    return (replenishments as IReplenishment[]).find((s) => s.id === selectedId) ?? null;
  }, [selectedId, replenishments]);

  const filteredReplenishments = useMemo(() => {
    const term = removeAccents(deferredSearch.toLowerCase().trim());
    return (replenishments as IReplenishment[])
      .filter((r) => {
        // Busca textual inteligente
        const matchSearch = 
            removeAccents(r.order_number.toLowerCase()).includes(term) || 
            removeAccents(r.client_name.toLowerCase()).includes(term) ||
            removeAccents(r.city_state.toLowerCase()).includes(term) ||
            (r.tracking_code && removeAccents(r.tracking_code.toLowerCase()).includes(term)) ||
            (r.shipping_info && removeAccents(r.shipping_info.toLowerCase()).includes(term)) ||
            r.items.some(i => removeAccents(i.products?.name.toLowerCase() || "").includes(term));
            
        if (!matchSearch) return false;

        // Filtro de Tabs
        if (activeTab === "pendente" && r.status !== "pendente") return false;
        if (activeTab === "em_preparo" && r.status !== "em_preparo") return false;
        if (activeTab === "concluido" && r.status !== "concluido") return false;

        // Filtros Expansíveis
        if (filterShipping !== "all" && r.shipping_info !== filterShipping) return false;
        if (filterTracking === "with" && !r.tracking_code) return false;
        if (filterTracking === "without" && !!r.tracking_code) return false;

        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [replenishments, deferredSearch, activeTab, filterShipping, filterTracking]);

  const filteredCatalogProducts = useMemo(() => {
    let result = products as IProduct[];

    if (showStockOnly) {
        result = result.filter(p => {
            const stockPhysical = p.stock?.quantity_on_hand ?? 0;
            const stockReserved = p.stock?.quantity_reserved ?? 0;
            const stockAvailable = p.stock_available ?? Math.max(0, stockPhysical - stockReserved);
            
            return stockAvailable > 0;
        });
    }

    if (productSearchTerm) {
        const lowerTerm = removeAccents(productSearchTerm.toLowerCase());
        result = result.filter(p => 
            removeAccents(p.name.toLowerCase()).includes(lowerTerm) || 
            removeAccents(p.sku.toLowerCase()).includes(lowerTerm)
        );
    }
    
    return result.slice(0, 50);
  }, [products, productSearchTerm, showStockOnly]);

  const resetSelection = useCallback(() => {
      setSelectedId(null);
      setInputIncrements({});
  }, []);

  const resetForm = useCallback(() => {
      setIsNewSheetOpen(false);
      setIsMobileCartOpen(false);
      setClientName(""); 
      setOrderNumber(""); 
      setCityState("");
      setTotalValue("");
      setSelectedProducts({});
      setProductSearchTerm("");
      setEditingReplenishmentId(null);
  }, []);

  const handleEditReplenishment = (rep: IReplenishment) => {
      setEditingReplenishmentId(rep.id);
      setOrderNumber(rep.order_number);
      setClientName(rep.client_name);
      setCityState(rep.city_state);
      setTotalValue(rep.total_value ? String(rep.total_value) : "");
      
      const cart: Record<string, number> = {};
      rep.items.forEach(item => {
          cart[item.product_id] = item.qty_requested;
      });
      setSelectedProducts(cart);
      
      setIsNewSheetOpen(true);
  };

  // ===================== MUTAÇÕES =====================
  const createMutation = useMutation({
    mutationFn: async (data: ICreateReplenishmentPayload) => await api.post("/replenishments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["replenishments"] });
      toast.success("Pedido salvo com sucesso!");
      resetForm();
    },
    onError: (err: unknown) => { 
        const error = err as IApiError;
        toast.error("Erro ao salvar pedido: " + (error.response?.data?.error || error.message)); 
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<ICreateReplenishmentPayload> }) => await api.put(`/replenishments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["replenishments"] });
      toast.success("Pedido atualizado com sucesso!");
      resetForm();
    },
    onError: (err: unknown) => { 
        const error = err as IApiError;
        toast.error("Erro ao atualizar pedido: " + (error.response?.data?.error || error.message)); 
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => await api.delete(`/replenishments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["replenishments"] });
      toast.success("Excluído com sucesso.");
      setDeleteId(null);
      resetSelection();
    },
    onError: (err: unknown) => { 
        const error = err as IApiError;
        toast.error("Erro ao excluir: " + (error.response?.data?.error || error.message)); 
        setDeleteId(null); 
    },
  });

  const authorizeMutation = useMutation({
    mutationFn: async ({ id, items, statusAction, shippingInfo, trackingCode }: IAuthorizePayload) => {
      await api.put(`/replenishments/${id}/authorize`, { items, action: statusAction, shipping_info: shippingInfo, tracking_code: trackingCode });
    },
    onSuccess: (_, v: IAuthorizePayload) => {
      queryClient.invalidateQueries({ queryKey: ["replenishments"] });
      queryClient.invalidateQueries({ queryKey: ["products-list"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] }); 
      
      if (v.statusAction === "entregar") {
         toast.success("Pedido Finalizado e Baixa Realizada!");
         setDeliveryModal({ open: false, isPartial: false, shippingInfo: "", trackingCode: "" });
         resetSelection();
      } else if (v.statusAction === "reverter") {
         toast.success("Pedido revertido com sucesso! Saldo estornado.");
      } else {
         toast.success("Reservas atualizadas!");
      }
      
      setInputIncrements({});
    },
    onError: (err: unknown, v: IAuthorizePayload) => { 
        const error = err as IApiError;
        toast.error("Ação falhou: " + (error.response?.data?.error || error.message));
    },
  });

  // ===================== ACTIONS =====================
  const handleSaveAuth = () => {
    if (!selectedReplenishment) return;
    const payload = selectedReplenishment.items.map((i) => {
      const inc = inputIncrements[i.id];
      const numericInc = typeof inc === 'number' ? inc : parseFloat(inc as string) || 0;
      return { id: i.id, quantity: i.quantity + numericInc };
    });
    authorizeMutation.mutate({ id: selectedReplenishment.id, items: payload, statusAction: "reservar" });
  };

  const handleDeliverCheck = () => {
    if (!selectedReplenishment) return;
    const isFullyReady = selectedReplenishment.items.every((i) => {
      const inc = inputIncrements[i.id];
      const numericInc = typeof inc === 'number' ? inc : parseFloat(inc as string) || 0;
      return i.quantity + numericInc >= i.qty_requested;
    });
    
    setDeliveryModal({ open: true, isPartial: !isFullyReady, shippingInfo: "", trackingCode: "" });
  };

  const executeDelivery = () => {
    if (!selectedReplenishment) return;
    const payload = selectedReplenishment.items.map((i) => {
        const inc = inputIncrements[i.id];
        const numericInc = typeof inc === 'number' ? inc : parseFloat(inc as string) || 0;
        return { id: i.id, quantity: i.quantity + numericInc };
    });
    authorizeMutation.mutate({ 
        id: selectedReplenishment.id, 
        items: payload, 
        statusAction: "entregar",
        shippingInfo: deliveryModal.shippingInfo,
        trackingCode: deliveryModal.trackingCode
    });
  };

  const executeRevert = () => {
     if (!selectedReplenishment) return;
     const payload = selectedReplenishment.items.map((i) => ({ id: i.id }));
     authorizeMutation.mutate({ id: selectedReplenishment.id, items: payload, statusAction: "reverter" });
  };

  const addItemToCart = (productId: string) => setSelectedProducts(prev => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));
  const updateCartQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
        const { [productId]: _, ...rest } = selectedProducts;
        setSelectedProducts(rest);
    } else {
        setSelectedProducts(prev => ({ ...prev, [productId]: newQty }));
    }
  };
  const removeItemFromCart = (productId: string) => {
    setSelectedProducts(prev => {
        const current = prev[productId] || 0;
        if (current <= 1) {
            const { [productId]: _, ...rest } = prev;
            return rest;
        }
        return { ...prev, [productId]: current - 1 };
    });
  };
  const clearCart = () => { setSelectedProducts({}); toast.info("Carrinho limpo"); };

  const { totalItemsInCart, totalUniqueItems } = useMemo(() => {
     let itemsCount = 0;
     let uniqueCount = 0;
     Object.entries(selectedProducts).forEach(([pid, qty]) => {
        itemsCount += qty;
        uniqueCount += 1;
     });
     return { totalItemsInCart: Number(itemsCount.toFixed(2)), totalUniqueItems: uniqueCount };
  }, [selectedProducts]);

  const hasExceedingItemsInCart = useMemo(() => {
    return Object.entries(selectedProducts).some(([pid, qty]) => {
        const prod = (products as IProduct[]).find(p => p.id === pid);
        if (!prod) return false;
        
        const stockPhysical = prod.stock?.quantity_on_hand ?? 0;
        const stockReserved = prod.stock?.quantity_reserved ?? 0;
        const stockAvailable = prod.stock_available ?? Math.max(0, stockPhysical - stockReserved);

        return qty > stockAvailable;
    });
  }, [selectedProducts, products]);

  const hasEdits = Object.values(inputIncrements).some(v => v !== 0 && v !== '' && v !== '-');

  if (isLoadingReps || isLoadingProds) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden">
        
        {!selectedReplenishment && (
            <m.header 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: smoothCurve }}
              className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50"
            >
                <div className="container px-4 py-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                            <RefreshCw className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black leading-none tracking-tight">Reposições</h1>
                            <p className="text-sm font-medium text-muted-foreground mt-0.5">Gerencie pedidos de reposição</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {canManage && (
                            <m.button 
                                whileTap={{ scale: 0.9 }}
                                onClick={() => { resetForm(); setIsNewSheetOpen(true); }} 
                                className="flex items-center justify-center bg-primary text-primary-foreground rounded-2xl font-bold shadow-lg shadow-primary/20 h-12 px-6"
                            >
                                <Plus className="mr-2 h-5 w-5" /> Novo Pedido
                            </m.button>
                        )}
                    </div>
                </div>
            </m.header>
        )}

        <main className="container px-4 py-8">
           <AnimatePresence mode="wait">
              {selectedReplenishment ? (
                  <DetailedView 
                      key="detail"
                      rep={selectedReplenishment}
                      inputIncrements={inputIncrements}
                      setInputIncrements={setInputIncrements}
                      onBack={resetSelection}
                      onDelete={setDeleteId} 
                      onEdit={handleEditReplenishment} 
                      hasEdits={hasEdits}
                      authorizeMutation={authorizeMutation}
                      onSave={handleSaveAuth}
                      onDeliverCheck={handleDeliverCheck}
                      onRevert={executeRevert}
                      canManage={canManage}
                  />
              ) : (
                  <m.div 
                      key="list"
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="flex flex-col gap-5"
                  >
                      <m.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: smoothCurve, delay: 0.1 }}
                        className="flex flex-col gap-4"
                      >
                         <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                             <div className="flex gap-3 w-full md:max-w-xl">
                                 <div className="relative flex-1 group bg-background rounded-2xl shadow-sm border border-border focus-within:border-primary/50 focus-within:ring-4 ring-primary/10 transition-all">
                                    <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input 
                                        placeholder="Buscar pedido, rastreio, envio..." 
                                        className="pl-12 h-12 border-0 bg-transparent shadow-none text-base focus-visible:ring-0"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                 </div>
                                 <m.button 
                                     whileTap={{ scale: 0.95 }}
                                     onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                                     className={cn(
                                         "flex items-center justify-center shrink-0 px-4 h-12 rounded-2xl transition-colors font-bold border",
                                         showAdvancedFilters ? "bg-primary border-primary text-primary-foreground shadow-md" : "bg-card border-border hover:bg-muted text-muted-foreground shadow-sm"
                                     )}
                                 >
                                     <Filter className={cn("h-5 w-5", showAdvancedFilters ? "mr-0 sm:mr-2" : "")} />
                                     <span className="hidden sm:block">{showAdvancedFilters ? "Ocultar" : "Filtros"}</span>
                                 </m.button>
                             </div>
    
                             <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "pendente" | "em_preparo" | "concluido")} className="w-full md:w-auto bg-muted/40 p-1 rounded-2xl">
                                 <TabsList className="bg-transparent border-0 h-10 w-full md:w-auto grid grid-cols-3 gap-1">
                                     <TabsTrigger value="pendente" className="rounded-xl font-bold data-[state=active]:shadow-sm">Pendentes</TabsTrigger>
                                     <TabsTrigger value="em_preparo" className="rounded-xl font-bold data-[state=active]:shadow-sm">Em Preparo</TabsTrigger>
                                     <TabsTrigger value="concluido" className="rounded-xl font-bold data-[state=active]:shadow-sm">Concluídos</TabsTrigger>
                                 </TabsList>
                             </Tabs>
                         </div>

                         {/* PAINEL DE FILTROS AVANÇADOS */}
                         <AnimatePresence>
                             {showAdvancedFilters && (
                                 <m.div
                                     initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                     animate={{ height: "auto", opacity: 1, marginTop: 8 }}
                                     exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                     className="overflow-hidden"
                                 >
                                     <div className="p-5 bg-card shadow-sm border border-border/50 rounded-2xl flex flex-col sm:flex-row gap-8">
                                         
                                         {/* Filtro Rastreio */}
                                         <div className="space-y-3">
                                             <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                                 <Package className="h-3.5 w-3.5"/> Código de Rastreio
                                             </Label>
                                             <div className="flex flex-wrap gap-2">
                                                 {[
                                                     { id: 'all', label: 'Todos' },
                                                     { id: 'with', label: 'Com Rastreio' },
                                                     { id: 'without', label: 'Sem Rastreio' }
                                                 ].map(opt => (
                                                     <Badge
                                                         key={opt.id}
                                                         className={cn("cursor-pointer px-4 py-2 rounded-xl text-sm transition-all border", filterTracking === opt.id ? "bg-primary text-primary-foreground font-bold border-primary shadow-md" : "bg-muted/50 border-border text-muted-foreground hover:bg-muted font-medium shadow-sm")}
                                                         onClick={() => setFilterTracking(opt.id as "all" | "with" | "without")}
                                                     >
                                                         {opt.label}
                                                     </Badge>
                                                 ))}
                                             </div>
                                         </div>
                  
                                         {/* Filtro Método Envio */}
                                         {uniqueShippingMethods.length > 0 && (
                                             <div className="space-y-3">
                                                 <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                                     <Truck className="h-3.5 w-3.5"/> Método de Envio
                                                 </Label>
                                                 <div className="flex flex-wrap gap-2">
                                                     <Badge
                                                         className={cn("cursor-pointer px-4 py-2 rounded-xl text-sm transition-all border", filterShipping === 'all' ? "bg-primary text-primary-foreground font-bold border-primary shadow-md" : "bg-muted/50 border-border text-muted-foreground hover:bg-muted font-medium shadow-sm")}
                                                         onClick={() => setFilterShipping('all')}
                                                     >
                                                         Todos
                                                     </Badge>
                                                     {uniqueShippingMethods.map(method => (
                                                         <Badge
                                                             key={method}
                                                             className={cn("cursor-pointer px-4 py-2 rounded-xl text-sm transition-all border", filterShipping === method ? "bg-primary text-primary-foreground font-bold border-primary shadow-md" : "bg-muted/50 border-border text-muted-foreground hover:bg-muted font-medium shadow-sm")}
                                                             onClick={() => setFilterShipping(method)}
                                                         >
                                                             {method}
                                                         </Badge>
                                                     ))}
                                                 </div>
                                             </div>
                                         )}

                                     </div>
                                 </m.div>
                             )}
                         </AnimatePresence>

                      </m.div>

                      <div>
                          {filteredReplenishments.length === 0 ? (
                             <EmptyState title="Tudo limpo por aqui!" description="Não encontramos nenhum pedido com os filtros selecionados." />
                          ) : (
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-24">
                                 {filteredReplenishments.map(rep => (
                                     <ReplenishmentCard 
                                        key={rep.id} 
                                        rep={rep} 
                                        onClick={() => setSelectedId(rep.id)} 
                                     />
                                 ))}
                             </div>
                          )}
                      </div>
                  </m.div>
              )}
           </AnimatePresence>
        </main>

        {/* ===================== SHEET DE CRIAÇÃO / EDIÇÃO ===================== */}
        <Sheet open={isNewSheetOpen} onOpenChange={(open) => { if(!open) resetForm(); else setIsNewSheetOpen(true); }}>
            <SheetContent className="w-full sm:w-screen sm:max-w-none flex flex-col h-full p-0 border-none shadow-2xl bg-background" side="bottom">
                
                <div className="px-5 py-4 border-b border-border/50 bg-background/80 backdrop-blur-xl z-30 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            {editingReplenishmentId ? <Pencil className="h-5 w-5 text-primary" /> : <ShoppingCart className="h-5 w-5 text-primary" />}
                        </div>
                        <div>
                            <h2 className="text-xl font-black leading-none">{editingReplenishmentId ? "Editar Pedido" : "Novo Pedido de Reposição"}</h2>
                            <p className="text-xs font-medium text-muted-foreground mt-1 hidden sm:block">
                                Selecione os materiais necessários para a reposição
                            </p>
                        </div>
                    </div>
                    {/* Botão de Fechar Grande para Usabilidade */}
                    <m.button 
                        whileTap={{ scale: 0.85 }} 
                        className="flex items-center justify-center h-12 w-12 rounded-full bg-muted/50 hover:bg-muted text-foreground transition-colors" 
                        onClick={resetForm}
                    >
                        <X className="h-6 w-6" />
                    </m.button>
                </div>

                <div className="flex-1 flex overflow-hidden relative bg-muted/5">
                    
                    <div className={cn(
                        "flex-1 overflow-y-auto px-4 sm:px-8 py-8 space-y-10 lg:border-r border-border/50 bg-background/50 scroll-smooth",
                        isMobileCartOpen ? "hidden lg:block" : "block w-full"
                    )}>
                        <section className="max-w-5xl mx-auto space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">1. Identificação do Pedido</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2 group">
                                    <Label className="text-sm font-bold ml-1">Número do Pedido</Label>
                                    <Input 
                                        value={orderNumber} 
                                        onChange={e => setOrderNumber(e.target.value)} 
                                        placeholder="Ex: REP-1024" 
                                        className="h-14 rounded-2xl bg-muted/30 border-transparent focus:border-primary focus:ring-4 ring-primary/10 transition-all text-lg font-medium px-5"
                                    />
                                </div>
                                <div className="space-y-2 group">
                                    <Label className="text-sm font-bold ml-1">Cidade - Estado</Label>
                                    <Input 
                                        value={cityState} 
                                        onChange={e => setCityState(e.target.value)} 
                                        placeholder="Ex: Curitiba - PR" 
                                        className="h-14 rounded-2xl bg-muted/30 border-transparent focus:border-primary focus:ring-4 ring-primary/10 transition-all text-lg font-medium px-5"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2 group">
                                    <Label className="text-sm font-bold ml-1">Cliente / Destino</Label>
                                    <Input 
                                        value={clientName} 
                                        onChange={e => setClientName(e.target.value)} 
                                        placeholder="Ex: Loja Centro" 
                                        className="h-14 rounded-2xl bg-muted/30 border-transparent focus:border-primary focus:ring-4 ring-primary/10 transition-all text-lg font-medium px-5"
                                    />
                                </div>
                                <div className="space-y-2 group">
                                    <Label className="text-sm font-bold ml-1 text-primary">Valor do Pedido (R$)</Label>
                                    <Input 
                                        type="number"
                                        step="0.01"
                                        value={totalValue} 
                                        onChange={e => setTotalValue(e.target.value)} 
                                        placeholder="Ex: 1500.00" 
                                        className="h-14 rounded-2xl bg-primary/5 border-primary/20 focus:border-primary focus:ring-4 ring-primary/10 transition-all text-lg font-black text-primary px-5"
                                    />
                                </div>
                            </div>
                        </section>

                        <Separator className="max-w-5xl mx-auto opacity-50" />

                        <section className="max-w-5xl mx-auto space-y-6 pb-32 lg:pb-10">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">2. Catálogo de Materiais</h3>
                            
                            <div className="flex flex-col sm:flex-row gap-4 sticky top-0 z-10 bg-background/90 py-3 backdrop-blur-xl rounded-b-2xl">
                                <div className="relative flex-1">
                                    <Search className="absolute left-4 top-4 h-6 w-6 text-muted-foreground" />
                                    <Input 
                                        placeholder="Buscar no catálogo..." 
                                        value={productSearchTerm}
                                        onChange={e => setProductSearchTerm(e.target.value)}
                                        className="pl-12 h-14 rounded-2xl bg-card border-border shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] focus:border-primary focus:ring-4 ring-primary/10 text-base font-medium"
                                    />
                                </div>
                                <div className="flex items-center gap-3 bg-card border border-border rounded-2xl px-5 h-14 shadow-sm shrink-0">
                                    <Switch id="stock-filter" checked={showStockOnly} onCheckedChange={setShowStockOnly} />
                                    <Label htmlFor="stock-filter" className="text-sm font-bold cursor-pointer">Apenas com estoque</Label>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                {filteredCatalogProducts.length === 0 ? (
                                    <div className="col-span-full py-20 text-center">
                                        <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Search className="h-10 w-10 text-muted-foreground/50" />
                                        </div>
                                        <h3 className="text-xl font-bold">Nenhum produto encontrado</h3>
                                    </div>
                                ) : (
                                    <AnimatePresence>
                                        {filteredCatalogProducts.map((prod: IProduct) => (
                                            <CatalogItem 
                                                key={prod.id}
                                                product={prod}
                                                quantityInCart={selectedProducts[prod.id] || 0}
                                                onAdd={() => addItemToCart(prod.id)}
                                                onRemove={() => removeItemFromCart(prod.id)}
                                                onUpdateQuantity={(val: number) => updateCartQuantity(prod.id, val)}
                                            />
                                        ))}
                                    </AnimatePresence>
                                )}
                            </div>
                        </section>
                    </div>

                    {!isMobileCartOpen && (
                        <m.div 
                          initial={{ y: 50, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          className="lg:hidden absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/95 to-transparent z-10 pt-16"
                        >
                            <m.button 
                                whileTap={{ scale: 0.95 }}
                                className="flex items-center justify-center bg-primary text-primary-foreground w-full h-14 rounded-2xl font-black text-lg shadow-[0_10px_30px_-10px_rgba(var(--primary),0.5)]"
                                onClick={() => setIsMobileCartOpen(true)}
                            >
                                <ShoppingCart className="mr-3 h-6 w-6" />
                                Ver Lista ({totalItemsInCart})
                            </m.button>
                        </m.div>
                    )}

                    <div className={cn(
                        "flex-col bg-card/50 backdrop-blur z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.03)] lg:border-l border-border/30 h-full w-full lg:w-[420px] xl:w-[480px] absolute inset-0 lg:static",
                        isMobileCartOpen ? "flex" : "hidden lg:flex"
                    )}>
                        <div className="p-4 sm:p-6 border-b border-border/50 bg-background/90 backdrop-blur sticky top-0 flex justify-between items-center z-10">
                            <div className="flex items-center gap-3">
                                <m.button whileTap={{ scale: 0.85 }} className="flex items-center justify-center lg:hidden h-10 w-10 rounded-full bg-muted/50 -ml-1" onClick={() => setIsMobileCartOpen(false)}>
                                    <ArrowLeft className="h-5 w-5" />
                                </m.button>
                                <div>
                                    <h3 className="font-black text-xl flex items-center gap-2">Lista de Reposição</h3>
                                    <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">{totalUniqueItems} {totalUniqueItems === 1 ? 'item diferente' : 'itens diferentes'}</p>
                                </div>
                            </div>
                            {totalItemsInCart > 0 && (
                                <m.button whileTap={{ scale: 0.9 }} onClick={clearCart} className="flex items-center justify-center text-destructive hover:bg-destructive/10 font-bold rounded-xl h-10 px-4">
                                    Limpar Tudo
                                </m.button>
                            )}
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 relative pb-32 lg:pb-5">
                            {totalUniqueItems === 0 ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center opacity-50 p-6">
                                    <Package className="h-16 w-16 mb-4 text-muted-foreground" />
                                    <p className="text-lg font-bold">Nenhum item na lista</p>
                                    <p className="text-sm mt-2 max-w-[200px]">Os itens que você adicionar ao catálogo aparecerão aqui.</p>
                                </div>
                            ) : (
                                Object.entries(selectedProducts).map(([pid, qty]) => {
                                    const prod = (products as IProduct[]).find((p) => p.id === pid);
                                    if (!prod) return null;
                                    
                                    const stockPhysical = prod.stock?.quantity_on_hand ?? 0;
                                    const stockReserved = prod.stock?.quantity_reserved ?? 0;
                                    const stockAvailable = prod.stock_available ?? Math.max(0, stockPhysical - stockReserved);
                                    
                                    const isExceeding = qty > stockAvailable;
                                    const allowDecimal = isDecimalUnit(prod.unit);

                                    return (
                                        <m.div 
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            key={pid} 
                                            className={cn(
                                                "flex flex-col p-4 rounded-3xl bg-background border transition-all",
                                                isExceeding ? "border-amber-500/30 shadow-[0_4px_15px_-4px_rgba(245,158,11,0.1)]" : "border-border/50 shadow-sm"
                                            )}
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex-1 min-w-0 pr-3">
                                                    <p className="text-base font-bold truncate leading-tight text-foreground">{prod.name}</p>
                                                    <span className="text-[11px] font-mono font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md mt-1 inline-block mr-2">{prod.sku}</span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center justify-between mt-1">
                                                {isExceeding ? (
                                                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-500 flex items-center bg-amber-500/10 px-2 py-1 rounded-lg">
                                                        <AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Faltam {Number((qty - stockAvailable).toFixed(2))} un.
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-semibold text-muted-foreground">Estoque: {stockAvailable}</span>
                                                )}

                                                <div className={cn(
                                                    "flex items-center bg-muted/30 border rounded-2xl shadow-sm h-10 p-1",
                                                    isExceeding ? "border-amber-300 ring-2 ring-amber-500/10" : "border-border"
                                                )}>
                                                    <m.button whileTap={{ scale: 0.8 }} className="flex items-center justify-center h-full w-8 rounded-xl hover:bg-background text-muted-foreground" onClick={() => removeItemFromCart(pid)}>
                                                        <Minus className="h-4 w-4" />
                                                    </m.button>
                                                    <Input 
                                                        type="number" 
                                                        step={allowDecimal ? "any" : "1"}
                                                        value={qty === 0 ? "" : qty} 
                                                        onChange={(e) => {
                                                            let val = allowDecimal ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
                                                            if (isNaN(val)) val = 0;
                                                            updateCartQuantity(pid, val);
                                                        }}
                                                        className={cn(
                                                            "h-full w-14 sm:w-16 border-0 p-0 text-center text-sm font-black shadow-none focus-visible:ring-0 rounded-none bg-transparent",
                                                            isExceeding ? "text-amber-600 dark:text-amber-500" : "text-foreground"
                                                        )}
                                                    />
                                                    <m.button whileTap={{ scale: 0.8 }} className="flex items-center justify-center h-full w-8 rounded-xl hover:bg-background text-foreground" onClick={() => addItemToCart(pid)}>
                                                        <Plus className="h-4 w-4" />
                                                    </m.button>
                                                </div>
                                            </div>
                                        </m.div>
                                    );
                                })
                            )}
                        </div>

                        <div className="absolute bottom-0 left-0 right-0 lg:static border-t border-border/50 bg-background/95 backdrop-blur-xl p-4 sm:p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-20">
                            <div className="space-y-4 sm:space-y-5">
                                {hasExceedingItemsInCart && (
                                    <m.div 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex items-start gap-3 bg-amber-500/10 text-amber-700 dark:text-amber-400 p-3 sm:p-4 rounded-2xl"
                                    >
                                        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                                        <p className="text-[11px] sm:text-xs font-bold leading-snug">
                                            Atenção: Alguns itens excedem o estoque atual. O pedido ficará com status Pendente.
                                        </p>
                                    </m.div>
                                )}

                                <div className="flex items-center justify-between pb-1 sm:pb-2 border-b border-border/50">
                                    <span className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] sm:text-xs">Quantidade Total de Itens</span>
                                    <strong className="text-2xl sm:text-3xl text-foreground font-black">{totalItemsInCart}</strong>
                                </div>
                                
                                <m.button 
                                    whileTap={{ scale: 0.95 }}
                                    className="flex items-center justify-center w-full h-14 sm:h-16 bg-primary text-primary-foreground rounded-2xl font-black text-base sm:text-lg shadow-[0_10px_30px_-10px_rgba(var(--primary),0.5)] disabled:opacity-50"
                                    disabled={
                                        createMutation.isPending || 
                                        editMutation.isPending || 
                                        totalItemsInCart === 0 || 
                                        !orderNumber || 
                                        !clientName ||
                                        !cityState ||
                                        !totalValue
                                    }
                                    onClick={() => {
                                        const itemsPayload = Object.entries(selectedProducts).map(([pid, qty]) => ({
                                            product_id: pid,
                                            qty_requested: qty
                                        }));

                                        const payload = {
                                            order_number: orderNumber,
                                            client_name: clientName,
                                            city_state: cityState,
                                            total_value: parseFloat(totalValue.replace(',', '.')) || 0,
                                            status: "pendente",
                                            items: itemsPayload
                                        };

                                        if (editingReplenishmentId) {
                                            editMutation.mutate({ id: editingReplenishmentId, data: payload });
                                        } else {
                                            createMutation.mutate(payload);
                                        }
                                    }}
                                >
                                    {(createMutation.isPending || editMutation.isPending) ? (
                                        <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                                    ) : (
                                        <Check className="mr-3 h-6 w-6" />
                                    )}
                                    {editingReplenishmentId ? "Salvar Alterações" : "Confirmar Pedido"}
                                </m.button>
                            </div>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>

        {/* ===================== ALERTS E MODAIS ===================== */}
        <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
           <AlertDialogContent className="rounded-[2rem]">
              <AlertDialogHeader>
                 <AlertDialogTitle className="text-destructive flex items-center gap-2 text-xl font-black">
                    <Trash2 className="h-6 w-6" /> Excluir Pedido
                 </AlertDialogTitle>
                 <AlertDialogDescription className="text-base">
                    Tem certeza que deseja excluir esta solicitação de reposição? Esta ação não pode ser desfeita.
                 </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-4 gap-3">
                 <AlertDialogCancel className="rounded-xl h-12 font-bold flex-1">Cancelar</AlertDialogCancel>
                 <AlertDialogAction 
                    onClick={() => deleteId && deleteMutation.mutate(deleteId)} 
                    className="bg-destructive hover:bg-destructive/90 text-white rounded-xl h-12 font-bold flex-1"
                 >
                    {deleteMutation.isPending ? "Excluindo..." : "Sim, Excluir"}
                 </AlertDialogAction>
              </AlertDialogFooter>
           </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deliveryModal.open} onOpenChange={(open) => setDeliveryModal(p => ({...p, open}))}>
           <AlertDialogContent className="rounded-[2rem]">
               <AlertDialogHeader>
                   <AlertDialogTitle className={cn("flex items-center gap-2 text-xl font-black", deliveryModal.isPartial ? "text-amber-600" : "text-primary")}>
                       {deliveryModal.isPartial ? <AlertTriangle className="h-6 w-6" /> : <Truck className="h-6 w-6" />}
                       {deliveryModal.isPartial ? "Reposição Parcial" : "Finalizar Envio"}
                   </AlertDialogTitle>
                   <AlertDialogDescription className="text-base space-y-4 pt-2 text-left">
                       {deliveryModal.isPartial && (
                           <span className="block p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-xl font-medium border border-amber-200 dark:border-amber-900/50">
                               Atenção: Este pedido não está 100% completo. Se continuar, os itens restantes ficarão pendentes.
                           </span>
                       )}
                       <div className="space-y-2 mt-2">
                           <Label className="text-sm font-bold text-foreground">Por onde foi enviado? *</Label>
                           <Input 
                               placeholder="Ex: Correios, Transportadora X, Retirada..."
                               value={deliveryModal.shippingInfo}
                               onChange={(e) => setDeliveryModal(p => ({...p, shippingInfo: e.target.value}))}
                               className="h-12 rounded-xl"
                           />
                       </div>
                       
                       <div className="space-y-2 mt-4">
                           <Label className="text-sm font-bold text-foreground">Código de Rastreio (Opcional)</Label>
                           <Input 
                               placeholder="Ex: AB123456789BR"
                               value={deliveryModal.trackingCode}
                               onChange={(e) => setDeliveryModal(p => ({...p, trackingCode: e.target.value.toUpperCase().replace(/\s/g, '')}))}
                               className="h-12 rounded-xl font-mono uppercase"
                           />
                       </div>

                   </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter className="mt-6 gap-3">
                   <AlertDialogCancel className="rounded-xl h-12 font-bold flex-1">Revisar</AlertDialogCancel>
                   <AlertDialogAction 
                       onClick={(e) => { e.preventDefault(); executeDelivery(); }}
                       className={cn("text-white rounded-xl h-12 font-bold flex-1 disabled:opacity-50", deliveryModal.isPartial ? "bg-amber-500 hover:bg-amber-600" : "bg-primary hover:bg-primary/90")}
                       disabled={authorizeMutation.isPending || deliveryModal.shippingInfo.trim().length === 0}
                   >
                       {authorizeMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirmar Envio"}
                   </AlertDialogAction>
               </AlertDialogFooter>
           </AlertDialogContent>
        </AlertDialog>

      </div>
    </LazyMotion>
  );
}
