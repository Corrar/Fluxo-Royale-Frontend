import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useDeferredValue,
  useRef,
  type ChangeEvent,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";

// Importações do PDF
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

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

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

import {
  Plus,
  Minus,
  Trash2,
  Clock,
  Search,
  Save,
  User,
  Truck,
  Check,
  Loader2,
  X,
  ArrowLeft,
  CheckCircle2,
  Box,
  Ban,
  AlertTriangle,
  RotateCcw,
  FileText,
  Download,
  ShoppingCart,
  Package,
  Zap,
  Pencil
} from "lucide-react";

import { format, differenceInDays, addDays } from "date-fns";
import { cn } from "@/lib/utils";

// FRAMER MOTION
import {
  LazyMotion,
  domAnimation,
  m,
  AnimatePresence,
} from "framer-motion";

// ===================== HELPERS =====================
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const formatCompactCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value);
};

// Verifica se a unidade aceita números decimais
const isDecimalUnit = (unit?: string) => {
  if (!unit) return false;
  const u = unit.toUpperCase().trim();
  return ["M", "MT", "METRO", "METROS", "KG", "QUILO", "KILO", "KILOS", "L", "LT", "LITRO", "LITROS"].includes(u);
};

// ===================== TYPES =====================
interface IStock {
  quantity_on_hand: number;
  quantity_reserved: number;
}

interface IProduct {
  id: string;
  name: string;
  sku: string;
  unit: string;
  stock?: IStock;
  stock_available?: number;
  min_stock?: number;
  unit_price?: number; 
}

interface ISeparationItem {
  id: string;
  product_id: string;
  quantity: number;
  qty_requested: number;
  products?: IProduct;
}

interface IReturnItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  status: "pendente" | "aprovado" | "rejeitado";
  created_at?: string;
}

interface ISeparation {
  id: string;
  production_order: string;
  client_name: string;
  destination: string;
  status: "pendente" | "em_separacao" | "entregue" | "finalizada";
  created_at: string;
  sent_at?: string;
  items: ISeparationItem[];
  returns?: IReturnItem[];
}

const smoothCurve: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

// ===================== UI HELPERS =====================
const EmptyState = ({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) => {
  return (
      <m.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: smoothCurve }}
        className="flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-muted/30 min-h-[350px]"
      >
        <div className="h-20 w-20 rounded-full bg-background shadow-sm flex items-center justify-center mb-6">
          <Package className="h-10 w-10 text-muted-foreground/40" />
        </div>
        <h3 className="text-2xl font-bold tracking-tight text-foreground mb-2">{title}</h3>
        <p className="text-base text-muted-foreground max-w-sm mb-8">{description}</p>
        {action}
      </m.div>
  );
};

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
const CatalogItem = ({ 
  product,
  quantityInCart,
  onAdd,
  onRemove,
  onUpdateQuantity
}: {
  product: IProduct;
  quantityInCart: number;
  onAdd: () => void;
  onRemove: () => void;
  onUpdateQuantity: (val: number) => void;
}) => {

  const stockPhysical = product.stock?.quantity_on_hand ?? 0;
  const stockReserved = product.stock?.quantity_reserved ?? 0;
  const stockAvailable = product.stock_available ?? Math.max(0, stockPhysical - stockReserved);
  
  const stock = stockAvailable;
  const hasStock = stock > 0;
  const minStock = product.min_stock || 10;
  
  const isExceedingStock = quantityInCart > stock;
  const stockColor = stock === 0 ? "bg-muted-foreground/20" : stock < minStock ? "bg-amber-400" : "bg-emerald-500";
  const allowDecimal = isDecimalUnit(product.unit);

  const [localQty, setLocalQty] = useState<string>(String(quantityInCart));

  useEffect(() => {
      const parsedLocal = parseFloat(localQty);
      if (isNaN(parsedLocal) || parsedLocal !== quantityInCart) {
          setLocalQty(String(quantityInCart));
      }
  }, [quantityInCart, localQty]);

  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setLocalQty(raw);

      if (raw === '' || raw === '0') {
          onUpdateQuantity(0);
          return;
      }
      if (raw.endsWith('.') || raw.endsWith(',')) return;

      let val = allowDecimal ? parseFloat(raw) : parseInt(raw, 10);
      if (!isNaN(val)) {
          onUpdateQuantity(val);
      }
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
                    value={localQty === "0" ? "" : localQty}
                    onChange={handleManualInput}
                    onBlur={() => {
                        const val = parseFloat(localQty);
                        if (isNaN(val) || val <= 0) {
                            onUpdateQuantity(0);
                        } else {
                            onUpdateQuantity(val);
                            setLocalQty(String(val));
                        }
                    }}
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

// ===================== CART ITEM ROW =====================
const CartItemRow = ({ prod, qty, allowDecimal, isExceeding, stockAvailable, onUpdate, onRemove, onAdd }: any) => {
  const [localQty, setLocalQty] = useState(String(qty));

  useEffect(() => {
      const pL = parseFloat(localQty);
      if (isNaN(pL) || pL !== qty) {
          setLocalQty(String(qty));
      }
  }, [qty, localQty]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setLocalQty(raw);
      if (raw === '' || raw === '0') {
          onUpdate(0); return;
      }
      if (raw.endsWith('.') || raw.endsWith(',')) return;
      let val = allowDecimal ? parseFloat(raw) : parseInt(raw, 10);
      if (!isNaN(val)) {
          onUpdate(val);
      }
  };

  return (
      <m.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
              "flex flex-col p-4 rounded-3xl bg-background border transition-all",
              isExceeding ? "border-amber-500/30 shadow-[0_4px_15px_-4px_rgba(245,158,11,0.1)]" : "border-border/50 shadow-sm"
          )}
      >
          <div className="flex justify-between items-start mb-3">
              <div className="flex-1 min-w-0 pr-3">
                  <p className="text-base font-bold truncate leading-tight text-foreground">{prod.name}</p>
                  <span className="text-[11px] font-mono font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md mt-1 inline-block">{prod.sku}</span>
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
                  <m.button whileTap={{ scale: 0.8 }} className="flex items-center justify-center h-full w-8 rounded-xl hover:bg-background text-muted-foreground" onClick={onRemove}>
                      <Minus className="h-4 w-4" />
                  </m.button>
                  <Input 
                      type="number" 
                      step={allowDecimal ? "any" : "1"}
                      value={localQty === "0" ? "" : localQty} 
                      onChange={handleChange}
                      onBlur={() => {
                          const val = parseFloat(localQty);
                          if (isNaN(val) || val <= 0) onUpdate(0);
                          else { onUpdate(val); setLocalQty(String(val)); }
                      }}
                      className={cn(
                          "h-full w-14 sm:w-16 border-0 p-0 text-center text-sm font-black shadow-none focus-visible:ring-0 rounded-none bg-transparent",
                          isExceeding ? "text-amber-600 dark:text-amber-500" : "text-foreground"
                      )}
                  />
                  <m.button whileTap={{ scale: 0.8 }} className="flex items-center justify-center h-full w-8 rounded-xl hover:bg-background text-foreground" onClick={onAdd}>
                      <Plus className="h-4 w-4" />
                  </m.button>
              </div>
          </div>
      </m.div>
  );
};

// ===================== SEPARATION CARD =====================
const SeparationCard = ({ separation: sep, onClick }: { separation: ISeparation; onClick: () => void; }) => {
  const total = sep.items.length;
  const done = sep.items.filter(i => {
      const approvedReturns = sep.returns?.filter(r => r.product_id === i.product_id && r.status === 'aprovado').reduce((a, b) => a + b.quantity, 0) || 0;
      const netQty = Math.max(0, i.quantity - approvedReturns);
      return netQty >= i.qty_requested;
  }).length;
  const progress = total > 0 ? (done / total) * 100 : 0;
  
  let totalRequestedValue = 0;
  let totalSeparatedValue = 0;

  sep.items.forEach(item => {
      const price = Number(item.products?.unit_price) || 0;
      const requestedQty = Number(item.qty_requested) || 0;
      const approvedDeduction = sep.returns?.filter(r => r.product_id === item.product_id && r.status === 'aprovado').reduce((a, b) => a + b.quantity, 0) || 0;
      const separatedQty = Math.max(0, (item.quantity || 0) - approvedDeduction);
      totalRequestedValue += requestedQty * price;
      totalSeparatedValue += separatedQty * price;
  });

  let deadlineInfo = null;
  let isExpired = false;
  
  if (sep.status === 'entregue' && sep.sent_at) {
      const limit = addDays(new Date(sep.sent_at), 10);
      const days = differenceInDays(limit, new Date());
      isExpired = days < 0;

      deadlineInfo = { days, expired: isExpired, urgent: !isExpired && days <= 3 };
  }

  const isArchived = sep.status === 'finalizada' || (sep.status === 'entregue' && isExpired);

  const statusColors: any = {
      pendente: "border-amber-500/50 hover:border-amber-500",
      em_separacao: "border-amber-500/50 hover:border-amber-500", 
      entregue: "border-emerald-500/50 hover:border-emerald-500",
      finalizado: "border-zinc-500/50 hover:border-zinc-500" 
  };

  const bgStatus: any = {
      pendente: "bg-amber-500",
      em_separacao: "bg-amber-500",
      entregue: "bg-emerald-500",
      finalizado: "bg-zinc-500"
  };

  const displayStatus = isArchived ? 'Finalizado' : (sep.status === 'em_separacao' ? 'Em Separação' : sep.status);
  const statusKey = isArchived ? 'finalizado' : sep.status;

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
            deadlineInfo?.expired && !isArchived ? "border-red-300 dark:border-red-900/50" : (statusColors[statusKey] || "border-border")
        )}
    >
        <div className="flex justify-between items-start mb-3 pointer-events-none">
            <Badge variant="outline" className="font-mono bg-background shadow-sm border-muted-foreground/30">OP: {sep.production_order}</Badge>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{format(new Date(sep.created_at), "dd MMM")}</span>
        </div>

        <div className="flex-1 mb-2 pointer-events-none">
            <h3 className="text-xl font-black uppercase leading-tight tracking-tight text-foreground break-words whitespace-normal">{sep.client_name}</h3>
            {deadlineInfo && !isArchived && (
                <div className={cn(
                    "mt-2 inline-flex items-center gap-1.5 rounded-md py-1 px-2 text-[11px] font-bold border animate-in fade-in slide-in-from-left-2",
                    deadlineInfo.expired ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400" :
                    deadlineInfo.urgent ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400" :
                    "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
                )}
            >
                    {deadlineInfo.expired ? <Ban className="h-3 w-3"/> : <Clock className="h-3 w-3"/>}
                    {deadlineInfo.expired ? "Prazo Expirado" : `${deadlineInfo.days} dias p/ devolver`}
                </div>
            )}
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="truncate">{sep.destination}</span>
            </div>
        </div>

        <div className="space-y-3 pt-4 mt-4 border-t border-border/50 pointer-events-none">
            <div className="flex justify-between items-end gap-3">
                <div className="flex flex-col min-w-0">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Financeiro</span>
                    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                        <span className="text-sm font-black text-emerald-600 truncate" title={formatCurrency(totalSeparatedValue)}>{formatCompactCurrency(totalSeparatedValue)}</span>
                        <span className="text-xs font-semibold text-muted-foreground truncate" title={formatCurrency(totalRequestedValue)}>/ {formatCompactCurrency(totalRequestedValue)}</span>
                    </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Progresso</span>
                    <span className="text-xs font-bold text-foreground leading-none">{done}/{total} <span className="text-muted-foreground font-semibold">({progress.toFixed(0)}%)</span></span>
                </div>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div className={cn("h-full transition-all duration-500", bgStatus[statusKey] || "bg-primary")} style={{ width: `${progress}%` }} />
            </div>
        </div>

        <div className="absolute -top-3 -right-2 pointer-events-none">
             <Badge className={cn("shadow-md uppercase text-[10px] px-2 h-6", bgStatus[statusKey])}>{displayStatus}</Badge>
        </div>
    </m.div>
  );
};

// ===================== DETAILED ITEM ROW =====================
const SeparationItemDetailedRow = ({
  item,
  inputValue,
  onChange,
  canEdit,
  approvedDeduction = 0
}: {
  item: ISeparationItem;
  inputValue: string;
  onChange: (val: string) => void;
  canEdit: boolean;
  approvedDeduction?: number;
}) => {

  const dbPhysical = item.products?.stock?.quantity_on_hand ?? 0;
  const dbReserved = item.products?.stock?.quantity_reserved ?? 0;
  const dbAvailable = item.products?.stock_available ?? Math.max(0, dbPhysical - dbReserved);

  const unitPrice = Number(item.products?.unit_price) || 0; 
  const allowDecimal = isDecimalUnit(item.products?.unit);
  
  const dbReservedHere = Math.max(0, (item.quantity || 0) - approvedDeduction);
  
  const currentIncParsed = parseFloat(inputValue || "0") || 0;
  const projectedTotal = dbReservedHere + currentIncParsed;

  const requested = item.qty_requested || 0;
  const isComplete = projectedTotal >= requested;
  
  const remainingRequest = Math.max(0, requested - dbReservedHere);
  const maxAddable = Math.min(remainingRequest, dbAvailable);
  const maxRevertable = dbReservedHere;

  const totalValueSeparated = projectedTotal * unitPrice;

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;

    if (rawVal === '-' || rawVal === '') {
        onChange(rawVal); 
        return;
    }

    let valForCheck = allowDecimal ? parseFloat(rawVal) : parseInt(rawVal, 10);
    if (isNaN(valForCheck)) {
        onChange("");
        return;
    }
    
    if (valForCheck < 0 && Math.abs(valForCheck) > maxRevertable) {
        toast.warning(`Máximo para estornar: ${maxRevertable}`);
        onChange(String(-maxRevertable));
        return;
    }
    if (valForCheck > 0 && valForCheck > maxAddable) {
        toast.warning("Estoque disponível insuficiente.");
        onChange(String(maxAddable));
        return;
    }
    onChange(rawVal);
  };

  const hasChange = currentIncParsed !== 0;

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
            {approvedDeduction > 0 && (
                <span className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-1.5 flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 inline-flex px-2 py-0.5 rounded-md">
                    <RotateCcw className="h-3 w-3" /> {approvedDeduction} un. devolvida(s)
                </span>
            )}
        </div>

        <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                <span>Separado: <span className={cn("font-bold text-foreground", isComplete && "text-emerald-600 dark:text-emerald-400")}>{projectedTotal} / {requested}</span></span>
                <span>{formatCurrency(totalValueSeparated)}</span>
            </div>
            <CustomProgressBar value={projectedTotal} max={requested} indicatorColor={isComplete ? "bg-emerald-500" : "bg-primary"} className="h-1.5" />
        </div>
      </div>

      <div className="flex flex-col sm:items-end justify-between gap-4 min-w-[160px] pl-4 sm:border-l border-border/50">
         <div className="flex gap-6 text-sm sm:text-right w-full sm:w-auto justify-between sm:justify-end">
             <div className="flex flex-col">
                 <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mb-0.5">Disponível</span>
                 <span className="font-bold text-base">{dbAvailable}</span>
             </div>
             <div className="flex flex-col text-right">
                 <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mb-0.5">Reservado</span>
                 <span className={cn("font-bold text-base", hasChange && "text-primary")}>
                    {dbReservedHere}
                    {hasChange && <span className="text-xs ml-1 font-black bg-primary/10 px-1.5 py-0.5 rounded-md">({currentIncParsed > 0 ? '+' : ''}{currentIncParsed})</span>}
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
                        {currentIncParsed < 0 ? "Estornar" : "Adicionar"}
                    </span>
                    <Input 
                        type="number"
                        step={allowDecimal ? "any" : "1"}
                        className={cn(
                            "h-full w-20 border-0 text-center font-black text-xl shadow-none focus-visible:ring-0 rounded-xl bg-transparent",
                            currentIncParsed < 0 ? "text-red-500" : currentIncParsed > 0 ? "text-emerald-500" : "text-foreground"
                        )}
                        placeholder="0"
                        value={inputValue}
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
const DetailedView = ({
    sep,
    canEdit,
    canDelete,
    inputIncrements,
    setInputIncrements,
    onBack,
    onDelete,
    onEdit, 
    onOpenReturnModal,
    hasEdits,
    authorizeMutation,
    updateReturnStatusMutation,
    onSave,
    onDeliver
}: {
    sep: ISeparation;
    canEdit: boolean;
    canDelete: boolean;
    inputIncrements: Record<string, string>;
    setInputIncrements: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    onBack: () => void;
    onDelete: (id: string) => void;
    onEdit: (sep: ISeparation) => void; 
    onOpenReturnModal: () => void;
    hasEdits: boolean;
    authorizeMutation: any;
    updateReturnStatusMutation: any;
    onSave: () => void;
    onDeliver: () => void;
}) => {

    const [itemSearchTerm, setItemSearchTerm] = useState("");
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

    const isPending = sep.status === 'pendente' || sep.status === 'em_separacao';
    const isDelivered = sep.status === 'entregue';
    
    let returnStatus = { expired: false, daysLeft: 0, label: "" };
    let isArchived = false;

    if (sep.status === 'finalizada') isArchived = true;

    if (sep.sent_at) {
        const sentDate = new Date(sep.sent_at);
        const limitDate = addDays(sentDate, 10);
        const daysDiff = differenceInDays(limitDate, new Date());
        
        if (daysDiff < 0) {
            returnStatus = { expired: true, daysLeft: 0, label: "Prazo Expirado" };
            if(sep.status === 'entregue') isArchived = true;
        } else {
            returnStatus = { expired: false, daysLeft: daysDiff, label: `${daysDiff} dias restantes` };
        }
    }

    const { grandTotalRequested, grandTotalSeparated, progressPercent } = useMemo(() => {
        let req = 0;
        let sepTotal = 0;

        sep.items.forEach(item => {
            const price = Number(item.products?.unit_price) || 0;
            const requestedQty = Number(item.qty_requested) || 0;
            
            const approvedDeduction = sep.returns?.filter(r => r.product_id === item.product_id && r.status === 'aprovado').reduce((a, b) => a + b.quantity, 0) || 0;
            const dbQuantity = Math.max(0, (item.quantity || 0) - approvedDeduction);
            const currentIncrement = parseFloat(inputIncrements[item.id] || "0") || 0;
            const currentQuantity = Math.max(0, dbQuantity + currentIncrement);

            req += requestedQty * price;
            sepTotal += currentQuantity * price;
        });

        const pct = req > 0 ? (sepTotal / req) * 100 : 0;

        return {
            grandTotalRequested: req,
            grandTotalSeparated: sepTotal,
            progressPercent: Math.min(100, pct)
        };
    }, [sep, inputIncrements]); 

    const filteredItems = useMemo(() => {
        if (!itemSearchTerm) return sep.items;
        const lower = itemSearchTerm.toLowerCase();
        return sep.items.filter(item => {
            const name = item.products?.name?.toLowerCase() || "";
            const sku = item.products?.sku?.toLowerCase() || "";
            return name.includes(lower) || sku.includes(lower);
        });
    }, [sep.items, itemSearchTerm]);

    const generatePDF = (filter: 'all' | 'separated' | 'missing') => {
       
       let itemsToExport = sep.items;
       let subtitle = "Pedido Completo";

       if (filter === 'missing') {
           itemsToExport = sep.items.filter(item => item.qty_requested - item.quantity > 0);
           subtitle = "Itens Pendentes / Em Falta";
       } else if (filter === 'separated') {
           itemsToExport = sep.items.filter(item => item.quantity > 0);
           subtitle = "Somente Itens Separados";
       }

       if (itemsToExport.length === 0) {
           toast.warning("Não há itens para esta categoria selecionada.");
           return;
       }

       const doc = new jsPDF();
       doc.setFontSize(22);
       doc.setTextColor(0, 0, 0);
       doc.setFont("helvetica", "bold");
       doc.text("Ordem de Separação", 14, 20);
       
       doc.setFontSize(12);
       doc.setTextColor(100);
       doc.setFont("helvetica", "normal");
       doc.text(subtitle, 14, 28);
       
       doc.setFontSize(10);
       doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 34);
       
       doc.setFillColor(240, 240, 240);
       doc.rect(14, 40, 182, 28, 'F');
       doc.setFontSize(12);
       doc.setTextColor(0);
       doc.setFont("helvetica", "bold");
       doc.text(`Cliente: ${sep.client_name}`, 18, 48);
       doc.text(`OP: ${sep.production_order}`, 18, 56);
       doc.setFont("helvetica", "normal");
       doc.text(`Destino: ${sep.destination}`, 120, 48);
       doc.text(`Status: ${sep.status.toUpperCase()}`, 120, 56);
       doc.text(`Data Pedido: ${format(new Date(sep.created_at), "dd/MM/yyyy")}`, 18, 64);
       
       const totalItems = sep.items.length;
       const completedItems = sep.items.filter(i => i.quantity >= i.qty_requested).length;
       const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
       
       let startY = 75;
       doc.setFontSize(10);
       doc.text(`Progresso: ${progress.toFixed(0)}% Concluído`, 120, 64);
       
       const tableRows = itemsToExport.map(item => {
           const requested = item.qty_requested;
           const separated = item.quantity;
           const missing = Math.max(0, requested - separated);
           const stock = item.products?.stock?.quantity_on_hand ?? item.products?.stock_available ?? 0;
           const status = separated >= requested ? "Completo" : "Pendente";
           return [`${item.products?.sku}\n${item.products?.name}`, requested, separated, missing > 0 ? missing : "-", stock, status];
       });
       
       // @ts-ignore
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
           didParseCell: function(data: any) {
               if (data.section === 'body' && data.column.index === 5) {
                   if (data.cell.raw === 'Pendente') { data.cell.styles.textColor = [220, 53, 69]; } 
                   else { data.cell.styles.textColor = [40, 167, 69]; }
               }
           }
       });
       
       const pageCount = (doc as any).internal.getNumberOfPages();
       for(let i = 1; i <= pageCount; i++) {
           doc.setPage(i);
           doc.setFontSize(8);
           doc.setTextColor(150);
           doc.text("Fluxo Royale - Sistema de Controle de Estoque", 14, doc.internal.pageSize.height - 10);
           doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
       }
       doc.save(`Pedido_${sep.production_order}_${sep.client_name}.pdf`);
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
                              <Badge variant="outline" className="text-[10px] font-mono bg-muted/30 border-0">OP: {sep.production_order}</Badge>
                              <Badge className={cn("text-[10px] border-0 shadow-none", 
                                  isArchived ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" : 
                                  isPending ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" : 
                                  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              )}>
                                  {isArchived ? "Finalizado" : (sep.status === 'em_separacao' ? 'Em Separação' : sep.status)}
                              </Badge>
                          </div>
                          <h1 className="text-2xl md:text-3xl font-black tracking-tight truncate text-foreground break-words whitespace-normal">{sep.client_name}</h1>
                      </div>
                      
                      <div className="hidden lg:flex flex-col items-end mr-6 px-6 border-r border-border/50">
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mb-1">Valor Separado</span>
                          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none">
                              {formatCurrency(grandTotalSeparated)}
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

                      {isDelivered && !isArchived && (
                         <div className={cn(
                             "hidden md:flex ml-4 items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold",
                             returnStatus.expired ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400" : "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                         )}>
                             {returnStatus.expired ? <Ban className="h-4 w-4"/> : <Clock className="h-4 w-4"/>}
                             {returnStatus.label}
                         </div>
                      )}

                      {canEdit && isPending && (
                          <div className="flex items-center ml-2 border-l border-border/50 pl-2 gap-1">
                            <m.button 
                                whileTap={{ scale: 0.85 }}
                                className="flex items-center justify-center rounded-full h-12 w-12 text-muted-foreground hover:bg-primary/10 hover:text-primary shrink-0" 
                                onClick={() => onEdit(sep)}
                                title="Editar Pedido"
                            >
                                <Pencil className="h-5 w-5" />
                            </m.button>
                            {canDelete && (
                              <m.button 
                                  whileTap={{ scale: 0.85 }}
                                  className="flex items-center justify-center rounded-full h-12 w-12 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0" 
                                  onClick={() => onDelete(sep.id)}
                                  title="Excluir Pedido"
                              >
                                  <Trash2 className="h-5 w-5" />
                              </m.button>
                            )}
                          </div>
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
              </div>
          </m.div>

          <div className="flex-1 w-full px-4 sm:container py-8">
             <Tabs defaultValue="items">
                <TabsList className="grid w-full grid-cols-2 mb-8 max-w-sm rounded-xl h-12 p-1 bg-muted/50">
                   <TabsTrigger value="items" className="rounded-lg font-bold">Itens do Pedido</TabsTrigger>
                   <TabsTrigger value="returns" className="rounded-lg font-bold">Devoluções</TabsTrigger>
                </TabsList>

                <TabsContent value="items" className="space-y-4">
                   
                   {/* BARRA DE PESQUISA DE ITENS DENTRO DO PEDIDO */}
                   <div className="relative mb-6 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input 
                            placeholder="Buscar material no pedido por nome ou SKU..." 
                            value={itemSearchTerm}
                            onChange={(e) => setItemSearchTerm(e.target.value)}
                            className="pl-11 h-14 rounded-2xl bg-card border-border shadow-sm focus-visible:ring-primary/20 text-base"
                        />
                        {itemSearchTerm && (
                            <button 
                                onClick={() => setItemSearchTerm("")} 
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        )}
                   </div>

                   {filteredItems.length === 0 ? (
                       <div className="text-center py-12 bg-card rounded-3xl border border-dashed border-border">
                           <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
                           <h3 className="text-lg font-bold text-foreground mb-1">Nenhum material encontrado</h3>
                           <p className="text-sm text-muted-foreground">Não há resultados para a busca "{itemSearchTerm}".</p>
                       </div>
                   ) : (
                       filteredItems.map(item => {
                          const approvedQty = sep.returns
                              ?.filter(r => r.product_id === item.product_id && r.status === 'aprovado')
                              .reduce((acc, curr) => acc + curr.quantity, 0) || 0;

                          return (
                              <SeparationItemDetailedRow
                                 key={item.id}
                                 item={item}
                                 inputValue={inputIncrements[item.id] || ""}
                                 onChange={(val) => setInputIncrements(prev => ({ ...prev, [item.id]: val }))}
                                 canEdit={canEdit && isPending}
                                 approvedDeduction={approvedQty}
                              />
                          )
                       })
                   )}
                </TabsContent>

                <TabsContent value="returns">
                   {(!sep.returns || sep.returns.length === 0) ? (
                      <EmptyState 
                          title="Tudo certo por aqui!" 
                          description="Nenhum item deste pedido foi devolvido até o momento."
                          action={
                            (isDelivered || sep.status === 'finalizada') && !returnStatus.expired && canEdit ? (
                                <m.button whileTap={{ scale: 0.95 }} onClick={onOpenReturnModal} className="flex h-12 items-center justify-center bg-primary text-primary-foreground rounded-xl font-bold px-8">Registrar Devolução</m.button>
                            ) : null
                          }
                      />
                   ) : (
                      <div className="space-y-4">
                          {sep.returns.map(ret => (
                             <m.div 
                               initial={{ opacity: 0, scale: 0.95 }}
                               whileInView={{ opacity: 1, scale: 1 }}
                               viewport={{ once: false, margin: "-10% 0px -10% 0px" }}
                               key={ret.id} 
                               className="flex items-center justify-between p-5 rounded-3xl bg-card border border-transparent shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]"
                             >
                               <div>
                                  <p className="font-bold text-base mb-1">{ret.product_name}</p>
                                  <Badge variant="outline" className={cn(
                                      "border-0 px-2 py-0.5 text-[10px]",
                                      ret.status === 'aprovado' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30" : 
                                      ret.status === 'rejeitado' ? "bg-red-100 text-red-700 dark:bg-red-900/30" : 
                                      "bg-amber-100 text-amber-700 dark:bg-amber-900/30"
                                  )}>
                                      {ret.status.toUpperCase()}
                                  </Badge>
                               </div>
                               <div className="text-right flex items-center gap-6">
                                  <div className="flex flex-col items-end">
                                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Qtd Devolvida</span>
                                      <span className="text-2xl font-black">{ret.quantity}</span>
                                  </div>
                                  {canEdit && ret.status === 'pendente' && (
                                      <div className="flex gap-2 pl-4 border-l border-border/50">
                                         <m.button whileTap={{ scale: 0.85 }} className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" onClick={() => updateReturnStatusMutation.mutate({ separationId: sep.id, returnId: ret.id, status: 'aprovado' })}>
                                            <Check className="h-5 w-5" />
                                         </m.button>
                                         <m.button whileTap={{ scale: 0.85 }} className="flex items-center justify-center h-10 w-10 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:text-red-400" onClick={() => updateReturnStatusMutation.mutate({ separationId: sep.id, returnId: ret.id, status: 'rejeitado' })}>
                                            <X className="h-5 w-5" />
                                         </m.button>
                                      </div>
                                  )}
                               </div>
                             </m.div>
                          ))}
                          {(isDelivered || sep.status === 'finalizada') && !returnStatus.expired && canEdit && (
                             <div className="pt-4 flex justify-center">
                                 <m.button whileTap={{ scale: 0.95 }} onClick={onOpenReturnModal} className="flex h-12 items-center justify-center bg-secondary text-secondary-foreground rounded-xl font-bold px-8">
                                    <Plus className="mr-2 h-5 w-5" /> Nova Devolução
                                 </m.button>
                             </div>
                          )}
                      </div>
                   )}
                </TabsContent>
             </Tabs>
          </div>

          {canEdit && isPending && (
             <m.div 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: smoothCurve }}
                className="fixed bottom-6 left-4 right-4 lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-3xl bg-background/90 backdrop-blur-xl border border-border/50 rounded-[2rem] p-3 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] z-50 transition-all"
             >
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="hidden sm:flex flex-1 items-center px-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Valor Separado</span>
                            <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">{formatCurrency(grandTotalSeparated)}</span>
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
                            onClick={onDeliver}
                            disabled={authorizeMutation.isPending}
                        >
                            <Truck className="mr-2 h-5 w-5" />
                            Confirmar Entrega
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

       </m.div>
    );
};


// ===================== MAIN =====================
export default function Separations() {
  const queryClient = useQueryClient();
  const { canAccess, profile } = useAuth();
  const { socket } = useSocket() || {};

  // 🛡️ REGRAS DE PERMISSÃO ATUALIZADAS PARA O RBAC GRANULAR:
  const canAdd = canAccess("separacoes:add");
  const canEdit = canAccess("separacoes:edit");
  const canDelete = canAccess("separacoes:delete");
  
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const [inputIncrements, setInputIncrements] = useState<Record<string, string>>({});
  const [returnPayload, setReturnPayload] = useState<Record<string, string>>({});
  
  const [isPartialDeliveryModalOpen, setIsPartialDeliveryModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<"pendente" | "entregue" | "arquivadas">("pendente");
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);
  
  const [isNewSheetOpen, setIsNewSheetOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [editingSeparationId, setEditingSeparationId] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [productionOrder, setProductionOrder] = useState("");
  const [destination, setDestination] = useState(""); 

  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Record<string, number>>({});
  const [showStockOnly, setShowStockOnly] = useState(false); 

  // ===================== ESTADO DO DROPDOWN DA OP =====================
  const [isOpDropdownOpen, setIsOpDropdownOpen] = useState(false);
  const opInputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (opInputRef.current && !opInputRef.current.contains(event.target as Node)) {
              setIsOpDropdownOpen(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ===================== QUERY EXCLUSIVA DE CLIENTES =====================
  const { data: rawClients = [] } = useQuery({
      queryKey: ["clients-for-separations"],
      queryFn: async () => {
          try { 
              const res = await api.get("/clients", {
                  params: { limit: 10000, per_page: 10000, pagination: false }
              }); 
              return res.data;
          } catch (e) { 
              return []; 
          }
      },
  });

  const clientsData = useMemo(() => {
      if (Array.isArray(rawClients)) return rawClients;
      if (rawClients?.clients && Array.isArray(rawClients.clients)) return rawClients.clients;
      if (rawClients?.data && Array.isArray(rawClients.data)) return rawClients.data;
      return [];
  }, [rawClients]);

  const { data: separations = [], isLoading } = useQuery({
    queryKey: ["separations"],
    queryFn: async () => (await api.get("/separations")).data,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => (await api.get("/products")).data,
  });

  // ===================== LÓGICA DE VALIDAÇÃO E DROPDOWN =====================
  
  const availableOrders = useMemo(() => {
    const orders: { op: string, client: string, originalOp: string, client_service_id?: string }[] = [];

    clientsData.forEach((c: any) => {
        const clientName = String(c.nome || c.name || c.razao_social || c.client_name || c.client || "Cliente não informado").trim();
        
        if (Array.isArray(c.services)) {
            c.services.forEach((service: any) => {
                if (service.op_code && String(service.op_code).trim() !== "") {
                    const originalOp = String(service.op_code).trim();
                    const cleanOp = originalOp.replace(/^0+/, '').toLowerCase();
                    orders.push({ op: cleanOp, client: clientName, originalOp, client_service_id: service.id });
                }
            });
        }

        const rootOp = c.op || c.numero_op || c.op_code || c.order_number || c.production_order || c.codigo_op;
        if (rootOp && String(rootOp).trim() !== "") {
            const originalOp = String(rootOp).trim();
            const cleanOp = originalOp.replace(/^0+/, '').toLowerCase();
            if (!orders.some(o => o.op === cleanOp)) {
                orders.push({ op: cleanOp, client: clientName, originalOp, client_service_id: c.id });
            }
        }
    });

    const editingSep = (separations as ISeparation[]).find((s) => s.id === editingSeparationId);
    if (editingSeparationId && editingSep?.production_order) {
        const cleanOp = editingSep.production_order.replace(/^0+/, '').toLowerCase();
        if (!orders.some(o => o.op === cleanOp)) {
            // @ts-ignore
            orders.push({ op: cleanOp, client: editingSep.client_name, originalOp: editingSep.production_order, client_service_id: editingSep.client_service_id });
        }
    }

    const uniqueOrdersMap = new Map();
    orders.forEach(o => {
        if (!uniqueOrdersMap.has(o.op)) {
            uniqueOrdersMap.set(o.op, o);
        }
    });
    return Array.from(uniqueOrdersMap.values()).sort((a, b) => a.originalOp.localeCompare(b.originalOp));
    
  }, [clientsData, separations, editingSeparationId]);

  const filteredOrders = useMemo(() => {
      if (!productionOrder) return availableOrders;
      
      const lowerTerm = productionOrder.toLowerCase().trim();
      const cleanTerm = lowerTerm.replace(/^0+/, ''); 
      
      return availableOrders.filter(o =>
          o.op.includes(cleanTerm) ||
          o.client.toLowerCase().includes(lowerTerm)
      );
  }, [availableOrders, productionOrder]);

  const isOpValid = useMemo(() => {
      if (!productionOrder.trim()) return false;
      const opKey = productionOrder.trim().toLowerCase().replace(/^0+/, '');
      return availableOrders.some(o => o.op === opKey);
  }, [productionOrder, availableOrders]);


  const handleOpChange = (val: string) => {
      setProductionOrder(val);
      setIsOpDropdownOpen(true);
      
      const opKey = val.trim().toLowerCase().replace(/^0+/, '');
      const matchedOrder = availableOrders.find(o => o.op === opKey);
      
      if (matchedOrder && matchedOrder.client !== "Cliente não informado") {
          setClientName(matchedOrder.client);
      }
  };


  const selectedSeparation = useMemo<ISeparation | null>(() => {
    if (!selectedId) return null;
    return (separations as ISeparation[]).find((s) => s.id === selectedId) ?? null;
  }, [selectedId, separations]);

  const filteredSeparations = useMemo(() => {
    const term = deferredSearch.toLowerCase().trim();
    return (separations as ISeparation[])
      .filter((s) => {
        const match =
          (s.production_order || "").toLowerCase().includes(term) ||
          (s.client_name || "").toLowerCase().includes(term);
        
        if (!match) return false;

        let isExpired = false;
        if (s.status === 'entregue' && s.sent_at) {
            const limit = addDays(new Date(s.sent_at), 10);
            if (differenceInDays(new Date(), limit) > 0) isExpired = true;
        }

        if (activeTab === "pendente") {
            return s.status === "pendente" || s.status === "em_separacao";
        }
        
        if (activeTab === "entregue") return s.status === "entregue" && !isExpired;
        if (activeTab === "arquivadas") return s.status === "finalizada" || (s.status === "entregue" && isExpired);

        return false;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [separations, deferredSearch, activeTab]);

  const filteredCatalogProducts = useMemo(() => {
    let result = products;

    if (showStockOnly) {
        result = result.filter((p: any) => {
            const stockPhysical = p.stock?.quantity_on_hand ?? 0;
            const stockReserved = p.stock?.quantity_reserved ?? 0;
            const stockAvailable = p.stock_available ?? Math.max(0, stockPhysical - stockReserved);
            return stockAvailable > 0;
        });
    }

    if (productSearchTerm) {
        const lowerTerm = productSearchTerm.toLowerCase();
        result = result.filter((p: any) => 
            p.name.toLowerCase().includes(lowerTerm) || 
            p.sku.toLowerCase().includes(lowerTerm)
        );
    }

    return result.slice(0, 50);
  }, [products, productSearchTerm, showStockOnly]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["separations"] });
        queryClient.invalidateQueries({ queryKey: ["products-list"] });
      }, Math.random() * 2000);
    };
    socket.on("separations_update", handleUpdate);
    return () => {
      socket.off("separations_update", handleUpdate);
    };
  }, [socket, queryClient]);

  const resetSelection = useCallback(() => {
      setSelectedId(null);
      setInputIncrements({});
      setReturnPayload({});
  }, []);

  const resetForm = useCallback(() => {
      setIsNewSheetOpen(false);
      setIsMobileCartOpen(false);
      setClientName(""); 
      setProductionOrder(""); 
      setDestination("");
      setSelectedProducts({});
      setProductSearchTerm("");
      setEditingSeparationId(null);
      setIsOpDropdownOpen(false);
  }, []);

  const handleEditSeparation = (sep: ISeparation) => {
      setEditingSeparationId(sep.id);
      setProductionOrder(sep.production_order);
      setClientName(sep.client_name);
      setDestination(sep.destination); 
      
      const cart: Record<string, number> = {};
      sep.items.forEach(item => {
          cart[item.product_id] = Number(item.qty_requested);
      });
      setSelectedProducts(cart);
      
      setIsNewSheetOpen(true);
  };

  const createSeparationMutation = useMutation({
    mutationFn: async (data: any) => await api.post("/separations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["separations"] });
      toast.success("Solicitação salva com sucesso!");
      resetForm();
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const editSeparationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => await api.put(`/separations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["separations"] });
      toast.success("Pedido atualizado com sucesso!");
      resetForm();
    },
    onError: () => toast.error("Erro ao atualizar o pedido."),
  });

  const deleteSeparationMutation = useMutation({
    mutationFn: async (id: string) => await api.delete(`/separations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["separations"] });
      toast.success("Excluído com sucesso.");
      setDeleteId(null);
      resetSelection();
    },
    onError: () => toast.error("Erro ao excluir."),
  });

  const authorizeMutation = useMutation({
    mutationFn: async ({ id, items, statusAction }: any) => {
      await api.put(`/separations/${id}/authorize`, { items, action: statusAction });
    },
    onSuccess: (_, v) => {
      queryClient.invalidateQueries({ queryKey: ["separations"] });
      queryClient.invalidateQueries({ queryKey: ["products-list"] });
      toast.success(v.statusAction === "entregar" ? "Saída Confirmada!" : "Reservas atualizadas!");
      setInputIncrements({});
      if(v.statusAction === 'entregar') {
          setIsPartialDeliveryModalOpen(false);
          resetSelection(); 
      }
    },
    onError: () => toast.error("Erro na operação"),
  });

  const createReturnMutation = useMutation({
    mutationFn: async ({ id, items }: any) => await api.post(`/separations/${id}/return`, { items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["separations"] });
      queryClient.invalidateQueries({ queryKey: ["products-list"] });
      toast.success("Devolução registrada!");
      setIsReturnModalOpen(false);
      setReturnPayload({});
    },
    onError: () => toast.error("Erro na devolução"),
  });

  const updateReturnStatusMutation = useMutation({
    mutationFn: async ({ separationId, returnId, status }: any) => {
      const response = await api.put(`/separations/returns/${returnId}`, { status });
      return response.data;
    },
    onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ["separations"] });
        queryClient.invalidateQueries({ queryKey: ["products-list"] });
        if (variables.status === 'aprovado') {
            toast.success("Devolução aceita: Item retornado ao estoque!");
        } else {
            toast.success("Status de devolução atualizado");
        }
    },
    onError: (error: any) => {
        const msg = error.response?.data?.error || error.message || "Erro ao atualizar devolução";
        toast.error(msg);
    }
  });

  const handleSaveAuth = () => {
    if (!selectedSeparation) return;
    const payload = selectedSeparation.items.map((i) => {
      const inc = parseFloat(inputIncrements[i.id] || "0") || 0;
      return {
        id: i.id,
        quantity: i.quantity + inc,
      };
    });
    authorizeMutation.mutate({ id: selectedSeparation.id, items: payload, statusAction: "reservar" });
  };

  const handleDeliverCheck = () => {
    if (!selectedSeparation) return;
    const isFullyReady = selectedSeparation.items.every((i) => {
        const inc = parseFloat(inputIncrements[i.id] || "0") || 0;
        return i.quantity + inc >= i.qty_requested;
    });
    
    if (!isFullyReady) {
        setIsPartialDeliveryModalOpen(true);
    } else {
        executeDelivery();
    }
  };

  const executeDelivery = () => {
    if (!selectedSeparation) return;
    const payload = selectedSeparation.items.map((i) => {
        const inc = parseFloat(inputIncrements[i.id] || "0") || 0;
        return {
            id: i.id,
            quantity: i.quantity + inc,
        };
    });
    authorizeMutation.mutate({ id: selectedSeparation.id, items: payload, statusAction: "entregar" });
  };

  const handleReturnSubmit = () => {
    if (!selectedSeparation) return;
    const itemsToReturn = Object.entries(returnPayload)
      .map(([pid, qtyStr]) => ({ product_id: pid, quantity: parseFloat(qtyStr) || 0 }))
      .filter((i) => i.quantity > 0);
    
    if (itemsToReturn.length === 0) return toast.warning("Informe a quantidade.");
    createReturnMutation.mutate({ id: selectedSeparation.id, items: itemsToReturn });
  };

  const addItemToCart = (productId: string) => {
    setSelectedProducts(prev => ({
        ...prev,
        [productId]: (prev[productId] || 0) + 1
    }));
  };

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

  const clearCart = () => {
      setSelectedProducts({});
      toast.info("Carrinho limpo");
  };

  const totalItemsInCart = Number(Object.values(selectedProducts).reduce((a, b) => a + b, 0).toFixed(2));
  const totalUniqueItems = Object.keys(selectedProducts).length;

  const hasExceedingItemsInCart = useMemo(() => {
    return Object.entries(selectedProducts).some(([pid, qty]) => {
        const prod = (products as any[]).find(p => p.id === pid);
        if (!prod) return false;
        const stockPhysical = prod.stock?.quantity_on_hand ?? 0;
        const stockReserved = prod.stock?.quantity_reserved ?? 0;
        const stockAvailable = prod.stock_available ?? Math.max(0, stockPhysical - stockReserved);
        return qty > stockAvailable;
    });
  }, [selectedProducts, products]);

  const hasEdits = Object.values(inputIncrements).some(v => {
      const num = parseFloat(v);
      return !isNaN(num) && num !== 0;
  });

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden">
        
        {!selectedSeparation && (
            <m.header 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: smoothCurve }}
              className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50"
            >
                <div className="container px-4 py-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                            <Box className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black leading-none tracking-tight">Quadro de Gestão</h1>
                            <p className="text-sm font-medium text-muted-foreground mt-0.5">Controle de Solicitações</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {(canAdd || canEdit) && (
                            <m.button 
                                whileTap={{ scale: 0.9 }}
                                onClick={() => { resetForm(); setIsNewSheetOpen(true); }} 
                                className="flex items-center justify-center bg-primary text-primary-foreground rounded-2xl font-bold shadow-lg shadow-primary/20 h-12 px-6"
                            >
                                <Plus className="mr-2 h-5 w-5" /> Nova Separação
                            </m.button>
                        )}
                    </div>
                </div>
            </m.header>
        )}

        <main className="container px-4 py-8">
           <AnimatePresence mode="wait">
              {selectedSeparation ? (
                  <DetailedView 
                      key="detail"
                      sep={selectedSeparation}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      inputIncrements={inputIncrements}
                      setInputIncrements={setInputIncrements}
                      onBack={resetSelection}
                      onDelete={setDeleteId} 
                      onEdit={handleEditSeparation} 
                      onOpenReturnModal={() => setIsReturnModalOpen(true)}
                      hasEdits={hasEdits}
                      authorizeMutation={authorizeMutation}
                      updateReturnStatusMutation={updateReturnStatusMutation}
                      onSave={handleSaveAuth}
                      onDeliver={handleDeliverCheck} 
                  />
              ) : (
                  <m.div 
                      key="list"
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6"
                  >
                      <m.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: smoothCurve, delay: 0.1 }}
                        className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center"
                      >
                         <div className="relative w-full md:max-w-md group bg-background rounded-2xl shadow-sm border border-border focus-within:border-primary/50 focus-within:ring-4 ring-primary/10 transition-all">
                            <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input 
                                placeholder="Buscar cliente ou OP..." 
                                className="pl-12 h-12 border-0 bg-transparent shadow-none text-base focus-visible:ring-0"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                         </div>
                         <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full md:w-auto bg-muted/40 p-1 rounded-2xl">
                             <TabsList className="bg-transparent border-0 h-10 w-full md:w-auto grid grid-cols-3 gap-1">
                                 <TabsTrigger value="pendente" className="rounded-xl font-bold data-[state=active]:shadow-sm">Ativos</TabsTrigger>
                                 <TabsTrigger value="entregue" className="rounded-xl font-bold data-[state=active]:shadow-sm">Entregues</TabsTrigger>
                                 <TabsTrigger value="arquivadas" className="rounded-xl font-bold data-[state=active]:shadow-sm">Arquivados</TabsTrigger>
                             </TabsList>
                         </Tabs>
                      </m.div>

                      <div>
                          {filteredSeparations.length === 0 ? (
                             <EmptyState title="Tudo limpo por aqui!" description="Não encontramos nenhum pedido com os filtros selecionados." />
                          ) : (
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-24">
                                 {filteredSeparations.map(sep => (
                                     <SeparationCard 
                                        key={sep.id} 
                                        separation={sep} 
                                        onClick={() => setSelectedId(sep.id)} 
                                     />
                                 ))}
                             </div>
                          )}
                      </div>
                  </m.div>
              )}
           </AnimatePresence>
        </main>

        <Sheet open={isNewSheetOpen} onOpenChange={(open) => { if(!open) resetForm(); else setIsNewSheetOpen(true); }}>
            <SheetContent className="w-full sm:w-screen sm:max-w-none flex flex-col h-full p-0 border-none shadow-2xl bg-background" side="bottom">
                
                <div className="px-5 py-4 border-b border-border/50 bg-background/80 backdrop-blur-xl z-30 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            {editingSeparationId ? <Pencil className="h-5 w-5 text-primary" /> : <ShoppingCart className="h-5 w-5 text-primary" />}
                        </div>
                        <div>
                            <h2 className="text-xl font-black leading-none">{editingSeparationId ? "Editar Pedido" : "Novo Pedido"}</h2>
                            <p className="text-xs font-medium text-muted-foreground mt-1 hidden sm:block">
                                {editingSeparationId ? "Atualize os itens ou quantidades do pedido" : "Selecione os itens para o almoxarifado"}
                            </p>
                        </div>
                    </div>
                    <m.button whileTap={{ scale: 0.85 }} className="flex items-center justify-center h-10 w-10 rounded-full bg-muted/50 hover:bg-muted" onClick={resetForm}>
                        <X className="h-5 w-5" />
                    </m.button>
                </div>

                <div className="flex-1 flex overflow-hidden relative bg-muted/5">
                    <div className={cn(
                        "flex-1 overflow-y-auto px-4 sm:px-8 py-8 space-y-10 lg:border-r border-border/50 bg-background/50 scroll-smooth",
                        isMobileCartOpen ? "hidden lg:block" : "block w-full"
                    )}>
                        <section className="max-w-5xl mx-auto space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">1. Identificação</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                
                                {/* 🟢 CAMPO DA OP OBRIGATÓRIA */}
                                <div className="space-y-2 group relative" ref={opInputRef}>
                                    <Label className="text-sm font-bold ml-1">Número da OP *</Label>
                                    <div className="relative">
                                        <Input 
                                            value={productionOrder} 
                                            onChange={e => handleOpChange(e.target.value)} 
                                            onFocus={() => setIsOpDropdownOpen(true)}
                                            placeholder="Selecione ou digite a OP..." 
                                            className={cn(
                                                "h-14 rounded-2xl bg-muted/30 border-transparent focus:ring-4 transition-all text-lg font-medium px-5",
                                                productionOrder && !isOpValid ? "border-red-500 focus:border-red-500 ring-red-500/10" : "focus:border-primary ring-primary/10"
                                            )}
                                        />
                                        
                                        {productionOrder && !isOpValid && (
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md animate-in fade-in">
                                                OP Inexistente
                                            </span>
                                        )}
                                        
                                        {productionOrder && isOpValid && (
                                            <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500 animate-in zoom-in" />
                                        )}
                                    </div>
                                    
                                    <AnimatePresence>
                                        {isOpDropdownOpen && filteredOrders.length > 0 && (
                                            <m.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="absolute z-50 w-full mt-1 bg-background border border-border shadow-2xl rounded-2xl max-h-64 overflow-y-auto"
                                            >
                                                {filteredOrders.map((order, idx) => (
                                                    <div 
                                                        key={idx}
                                                        className="p-3 hover:bg-primary/5 cursor-pointer border-b border-border/50 last:border-0 transition-colors"
                                                        onClick={() => {
                                                            setProductionOrder(order.originalOp);
                                                            if(!clientName && order.client !== "Cliente não informado") {
                                                                setClientName(order.client);
                                                            }
                                                            setIsOpDropdownOpen(false);
                                                        }}
                                                    >
                                                        <div className="text-sm font-bold text-foreground truncate">{order.client}</div>
                                                        <div className="text-xs font-mono font-semibold text-muted-foreground mt-0.5">OP: {order.originalOp}</div>
                                                    </div>
                                                ))}
                                            </m.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <div className="space-y-2 group">
                                    <Label className="text-sm font-bold ml-1">Cliente / Destino *</Label>
                                    <Input 
                                        value={clientName} 
                                        onChange={e => setClientName(e.target.value)} 
                                        placeholder="Ex: Cliente Alpha" 
                                        className="h-14 rounded-2xl bg-muted/30 border-transparent focus:border-primary focus:ring-4 ring-primary/10 transition-all text-lg font-medium px-5"
                                    />
                                </div>
                            </div>
                        </section>

                        <Separator className="max-w-5xl mx-auto opacity-50" />

                        <section className="max-w-5xl mx-auto space-y-6 pb-32 lg:pb-10">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">2. Seleção de Produtos</h3>
                            
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
                                        <p className="text-muted-foreground mt-2">Tente ajustar os filtros ou a busca.</p>
                                    </div>
                                ) : (
                                    <AnimatePresence>
                                        {filteredCatalogProducts.map((prod: any) => (
                                            <CatalogItem 
                                                key={prod.id}
                                                product={prod}
                                                quantityInCart={selectedProducts[prod.id] || 0}
                                                onAdd={() => addItemToCart(prod.id)}
                                                onRemove={() => removeItemFromCart(prod.id)}
                                                onUpdateQuantity={(val) => updateCartQuantity(prod.id, val)}
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
                                Ver Carrinho ({totalItemsInCart})
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
                                    <h3 className="font-black text-xl flex items-center gap-2">Lista do Pedido</h3>
                                    <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">{totalUniqueItems} {totalUniqueItems === 1 ? 'tipo selecionado' : 'tipos selecionados'}</p>
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
                                    <ShoppingCart className="h-16 w-16 mb-4 text-muted-foreground" />
                                    <p className="text-lg font-bold">Nenhum item na lista</p>
                                    <p className="text-sm mt-2 max-w-[200px]">Os itens que você adicionar ao lado aparecerão aqui.</p>
                                </div>
                            ) : (
                                Object.entries(selectedProducts).map(([pid, qty]) => {
                                    const prod = (products as any[]).find((p) => p.id === pid);
                                    if (!prod) return null;
                                    
                                    const stockPhysical = prod.stock?.quantity_on_hand ?? 0;
                                    const stockReserved = prod.stock?.quantity_reserved ?? 0;
                                    const stockAvailable = prod.stock_available ?? Math.max(0, stockPhysical - stockReserved);
                                    
                                    const isExceeding = qty > stockAvailable;
                                    const allowDecimal = isDecimalUnit(prod.unit);

                                    return (
                                        <CartItemRow 
                                            key={pid}
                                            prod={prod}
                                            qty={qty}
                                            allowDecimal={allowDecimal}
                                            isExceeding={isExceeding}
                                            stockAvailable={stockAvailable}
                                            onUpdate={(val: number) => updateCartQuantity(pid, val)}
                                            onRemove={() => removeItemFromCart(pid)}
                                            onAdd={() => addItemToCart(pid)}
                                        />
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
                                            Atenção: A quantidade de alguns itens excede o estoque atual. O pedido ficará com status pendente.
                                        </p>
                                    </m.div>
                                )}

                                <div className="flex items-center justify-between pb-1 sm:pb-2 border-b border-border/50">
                                    <span className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] sm:text-xs">Quantidade Total Solicitada</span>
                                    <strong className="text-2xl sm:text-3xl text-foreground font-black">{totalItemsInCart}</strong>
                                </div>
                                
                                <m.button 
                                    whileTap={{ scale: 0.95 }}
                                    className="flex items-center justify-center w-full h-14 sm:h-16 bg-primary text-primary-foreground rounded-2xl font-black text-base sm:text-lg shadow-[0_10px_30px_-10px_rgba(var(--primary),0.5)] disabled:opacity-50"
                                    disabled={
                                        createSeparationMutation.isPending || 
                                        editSeparationMutation.isPending || 
                                        totalItemsInCart === 0 || 
                                        !clientName ||
                                        !isOpValid 
                                    }
                                    onClick={() => {
                                        if (!isOpValid) {
                                            toast.error("A OP informada não está cadastrada no sistema. Por favor, verifique.");
                                            return;
                                        }
                                        
                                        const opTyped = productionOrder.trim();
                                        const matchedOrder = availableOrders.find(o => o.op === opTyped.toLowerCase().replace(/^0+/, ''));
                                        const matchedOp = matchedOrder?.originalOp || opTyped;
                                        const matchedServiceId = matchedOrder?.client_service_id || null;

                                        const itemsPayload = Object.entries(selectedProducts).map(([pid, qty]) => ({
                                            product_id: pid,
                                            quantity: qty,
                                            op_code: matchedOp
                                        }));

                                        const payload = {
                                            production_order: matchedOp,
                                            op_code: matchedOp,
                                            client_service_id: matchedServiceId,
                                            client_name: clientName,
                                            destination: editingSeparationId ? destination : (profile?.sector || "Setor"),
                                            items: itemsPayload
                                        };

                                        if (editingSeparationId) {
                                            editSeparationMutation.mutate({
                                                id: editingSeparationId,
                                                data: payload
                                            });
                                        } else {
                                            createSeparationMutation.mutate(payload);
                                        }
                                    }}
                                >
                                    {(createSeparationMutation.isPending || editSeparationMutation.isPending) ? (
                                        <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                                    ) : (
                                        <Check className="mr-3 h-6 w-6" />
                                    )}
                                    {editingSeparationId ? "Salvar Alterações do Pedido" : "Confirmar Solicitação"}
                                </m.button>
                            </div>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>

        <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
           <AlertDialogContent className="rounded-[2rem]">
              <AlertDialogHeader>
                 <AlertDialogTitle className="text-destructive flex items-center gap-2 text-xl font-black">
                    <Trash2 className="h-6 w-6" /> Excluir Pedido
                 </AlertDialogTitle>
                 <AlertDialogDescription className="text-base">
                    Tem certeza que deseja excluir esta solicitação? Esta ação removerá o pedido permanentemente e não pode ser desfeita.
                 </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-4 gap-3">
                 <AlertDialogCancel className="rounded-xl h-12 font-bold flex-1">Cancelar</AlertDialogCancel>
                 <AlertDialogAction 
                    onClick={() => deleteId && deleteSeparationMutation.mutate(deleteId)} 
                    className="bg-destructive hover:bg-destructive/90 text-white rounded-xl h-12 font-bold flex-1"
                 >
                    {deleteSeparationMutation.isPending ? "Excluindo..." : "Sim, Excluir"}
                 </AlertDialogAction>
              </AlertDialogFooter>
           </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={isPartialDeliveryModalOpen} onOpenChange={setIsPartialDeliveryModalOpen}>
           <AlertDialogContent className="rounded-[2rem]">
               <AlertDialogHeader>
                   <AlertDialogTitle className="flex items-center gap-2 text-amber-600 text-xl font-black">
                       <AlertTriangle className="h-6 w-6" />
                       Entrega Parcial
                   </AlertDialogTitle>
                   <AlertDialogDescription className="text-base">
                       Este pedido não está 100% completo.
                       <br/><br/>
                       Deseja finalizar a entrega mesmo assim? Os itens restantes continuarão como pendência.
                   </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter className="mt-4 gap-3">
                   <AlertDialogCancel className="rounded-xl h-12 font-bold flex-1">Revisar</AlertDialogCancel>
                   <AlertDialogAction 
                       onClick={executeDelivery}
                       className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl h-12 font-bold flex-1"
                   >
                       Confirmar Parcial
                   </AlertDialogAction>
               </AlertDialogFooter>
           </AlertDialogContent>
        </AlertDialog>
        
        <Dialog open={isReturnModalOpen} onOpenChange={setIsReturnModalOpen}>
            <DialogContent className="rounded-[2rem]">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black">Devolver Itens</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-4">
                     {selectedSeparation?.items.map(item => {
                         const returned = selectedSeparation.returns?.filter(r => r.product_id === item.product_id && r.status !== 'rejeitado').reduce((a, b) => a + b.quantity, 0) || 0;
                         const available = item.quantity - returned;
                         if (available <= 0) return null;
                         const allowDecimal = isDecimalUnit(item.products?.unit);
                         
                         return (
                             <div key={item.id} className="flex justify-between items-center bg-muted/30 p-3 rounded-2xl">
                                 <div className="min-w-0 pr-3">
                                     <div className="font-bold text-sm truncate">{item.products?.name}</div>
                                     <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mt-1">Separado: {available}</div>
                                 </div>
                                 <Input 
                                     type="number" 
                                     step={allowDecimal ? "any" : "1"}
                                     className="w-24 h-12 rounded-xl text-center font-black text-lg focus-visible:ring-primary/20 bg-background" 
                                     placeholder="0" 
                                     max={available}
                                     value={returnPayload[item.product_id] || ""}
                                     onChange={e => {
                                         const rawVal = e.target.value;
                                         let valForCheck = parseFloat(rawVal);
                                         if (!isNaN(valForCheck) && valForCheck > available) {
                                            setReturnPayload(p => ({...p, [item.product_id]: String(available)}));
                                            return;
                                         }
                                         setReturnPayload(p => ({...p, [item.product_id]: rawVal}));
                                     }}
                                 />
                             </div>
                         )
                     })}
                </div>
                <DialogFooter className="mt-6">
                    <m.button whileTap={{ scale: 0.95 }} onClick={handleReturnSubmit} disabled={createReturnMutation.isPending} className="flex items-center justify-center w-full rounded-xl h-14 font-black text-base bg-primary text-primary-foreground disabled:opacity-50">
                        Confirmar Devolução
                    </m.button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

      </div>
    </LazyMotion>
  );
}
