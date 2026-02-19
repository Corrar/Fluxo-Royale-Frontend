import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useDeferredValue,
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
} from "@/components/ui/dialog";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
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
  Filter,
  XCircle,
  Zap,
  DollarSign
} from "lucide-react";

import { format, differenceInDays, addDays } from "date-fns";
import { cn } from "@/lib/utils";

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

// ===================== UI HELPERS =====================
const EmptyState = ({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-xl border-muted bg-muted/5 min-h-[300px] animate-in fade-in zoom-in duration-300">
    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
      <Package className="h-8 w-8 text-muted-foreground/50" />
    </div>
    <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
    <p className="text-sm text-muted-foreground max-w-sm mt-2 mb-6">{description}</p>
    {action}
  </div>
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
  const stock = product.stock?.quantity_on_hand ?? product.stock_available ?? 0;
  const hasStock = stock > 0;
  const minStock = product.min_stock || 10;
  
  const stockColor = stock === 0 ? "bg-muted" : stock < minStock ? "bg-amber-500" : "bg-emerald-500";

  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value);
    if (isNaN(val)) val = 0;
    
    if (val > stock) {
        toast.warning(`Estoque máximo disponível: ${stock}`);
        val = stock;
    }
    onUpdateQuantity(val);
  };

  return (
    <m.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group relative flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl border bg-card transition-all duration-200 hover:shadow-md",
        quantityInCart > 0 ? "border-primary ring-1 ring-primary/10 shadow-sm bg-primary/[0.02]" : "hover:border-primary/30"
      )}
    >
      <div className={cn("absolute left-0 top-4 bottom-4 w-1 rounded-r-full transition-colors", 
          hasStock ? "bg-transparent group-hover:bg-primary/50" : "bg-destructive/50"
      )} />

      <div className="flex-1 min-w-0 pr-4 pl-3 w-full">
        <div className="flex items-center justify-between sm:justify-start gap-2 mb-1.5">
          <Badge variant="secondary" className="font-mono text-[10px] tracking-wider text-muted-foreground bg-muted/50 border-0">
            {product.sku}
          </Badge>
          {!hasStock && <Badge variant="destructive" className="text-[10px] h-5 px-1.5">Esgotado</Badge>}
        </div>
        
        <h4 className="font-semibold text-sm leading-snug text-foreground mb-2">{product.name}</h4>
        
        <div className="flex items-center gap-3">
            <div className="flex-1 max-w-[120px]">
                <CustomProgressBar value={stock} max={minStock * 2} indicatorColor={stockColor} />
            </div>
            <span className={cn("text-xs font-medium", !hasStock ? "text-destructive" : "text-muted-foreground")}>
                {stock} {product.unit} disp.
            </span>
        </div>
      </div>

      <div className="flex items-center justify-end w-full sm:w-auto mt-3 sm:mt-0 gap-3 pl-3">
        {quantityInCart > 0 ? (
          <div className="flex items-center bg-background border rounded-lg shadow-sm p-0.5">
            <Button
              variant="ghost" 
              size="icon"
              onClick={onRemove}
              className="h-8 w-8 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <Minus className="h-4 w-4" />
            </Button>
            
            <Input 
                type="number"
                className="h-8 w-14 border-0 text-center font-bold p-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent shadow-none"
                value={quantityInCart}
                onChange={handleManualInput}
                min={0}
                max={stock}
            />

            <Button 
              variant="ghost"
              size="icon"
              onClick={onAdd}
              className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary transition-colors"
              disabled={!hasStock || quantityInCart >= stock}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button 
            size="sm" 
            className={cn(
                "rounded-full transition-all duration-300 font-medium px-5 h-9",
                hasStock ? "bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:scale-105" : "opacity-50 cursor-not-allowed"
            )}
            onClick={onAdd}
            disabled={!hasStock}
          >
            Adicionar
          </Button>
        )}
      </div>
    </m.div>
  );
};

// ===================== SEPARATION CARD =====================
const SeparationCard = ({
  separation: sep,
  onClick,
}: {
  separation: ISeparation;
  onClick: () => void;
}) => {
  // Lógica original de itens
  const total = sep.items.length;
  const done = sep.items.filter(i => {
      const approvedReturns = sep.returns?.filter(r => r.product_id === i.product_id && r.status === 'aprovado').reduce((a, b) => a + b.quantity, 0) || 0;
      const netQty = Math.max(0, i.quantity - approvedReturns);
      return netQty >= i.qty_requested;
  }).length;
  const progress = total > 0 ? (done / total) * 100 : 0;
  
  // NOVA LÓGICA: Cálculo financeiro do card
  let totalRequestedValue = 0;
  let totalSeparatedValue = 0;

  sep.items.forEach(item => {
      const price = Number(item.products?.unit_price) || 0;
      const requestedQty = Number(item.qty_requested) || 0;
      const approvedDeduction = sep.returns?.filter(r => r.product_id === item.product_id && r.status === 'aprovado').reduce((a, b) => a + b.quantity, 0) || 0;
      
      // Quantidade salva no banco (menos as devoluções)
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

      deadlineInfo = {
          days,
          expired: isExpired,
          urgent: !isExpired && days <= 3
      };
  }

  const isArchived = sep.status === 'finalizada' || (sep.status === 'entregue' && isExpired);

  const statusColors = {
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
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        onClick={onClick}
        className={cn(
            "group relative flex flex-col justify-between rounded-2xl border-2 bg-card p-5 cursor-pointer transition-all duration-300 shadow-sm hover:shadow-xl",
            deadlineInfo?.expired && !isArchived ? "border-red-300 dark:border-red-900/50" : (statusColors[statusKey] || "border-border")
        )}
    >
        <div className="flex justify-between items-start mb-3">
            <Badge variant="outline" className="font-mono bg-background shadow-sm border-muted-foreground/30">
                OP: {sep.production_order}
            </Badge>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                {format(new Date(sep.created_at), "dd MMM")}
            </span>
        </div>

        <div className="flex-1 mb-2">
            <h3 className="text-xl font-black uppercase leading-tight tracking-tight text-foreground line-clamp-2">
                {sep.client_name}
            </h3>
            
            {deadlineInfo && !isArchived && (
                <div className={cn(
                    "mt-2 inline-flex items-center gap-1.5 rounded-md py-1 px-2 text-[11px] font-bold border animate-in fade-in slide-in-from-left-2",
                    deadlineInfo.expired ? "bg-red-100 border-red-200 text-red-700" :
                    deadlineInfo.urgent ? "bg-amber-100 border-amber-200 text-amber-700" :
                    "bg-blue-50 border-blue-200 text-blue-700"
                )}>
                    {deadlineInfo.expired ? <Ban className="h-3 w-3"/> : <Clock className="h-3 w-3"/>}
                    {deadlineInfo.expired ? "Prazo Expirado" : `${deadlineInfo.days} dias p/ devolver`}
                </div>
            )}

            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="truncate">{sep.destination}</span>
            </div>
        </div>

        {/* NOVA SEÇÃO: Resumo Financeiro e Progresso */}
        <div className="space-y-3 pt-4 mt-4 border-t border-border/50">
            <div className="flex justify-between items-end">
                <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Financeiro</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-sm font-black text-emerald-600 leading-none">{formatCurrency(totalSeparatedValue)}</span>
                        <span className="text-xs font-semibold text-muted-foreground leading-none">/ {formatCurrency(totalRequestedValue)}</span>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Progresso</span>
                    <span className="text-xs font-bold text-foreground leading-none">{done}/{total} itens ({progress.toFixed(0)}%)</span>
                </div>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                    className={cn("h-full transition-all duration-500", bgStatus[statusKey] || "bg-primary")} 
                    style={{ width: `${progress}%` }} 
                />
            </div>
        </div>

        <div className="absolute -top-3 -right-2">
             <Badge className={cn("shadow-md uppercase text-[10px] px-2 h-6", bgStatus[statusKey])}>
                {displayStatus}
             </Badge>
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
  inputValue: number;
  onChange: (val: string) => void;
  isWarehouse: boolean;
  canEdit: boolean;
  approvedDeduction?: number;
}) => {
  const dbOnHand = item.products?.stock?.quantity_on_hand ?? item.products?.stock_available ?? 0;
  const unitPrice = Number(item.products?.unit_price) || 0; 
  
  const dbReservedHere = Math.max(0, (item.quantity || 0) - approvedDeduction);
  const projectedTotal = dbReservedHere + inputValue;

  const requested = item.qty_requested || 0;
  const isComplete = projectedTotal >= requested;
  
  const remainingRequest = Math.max(0, requested - dbReservedHere);
  
  const maxAddable = Math.min(remainingRequest, dbOnHand);
  const maxRevertable = dbReservedHere;

  const totalValueRequested = requested * unitPrice;
  const totalValueSeparated = projectedTotal * unitPrice;

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    if (rawVal === '-' || rawVal === '') {
        onChange(rawVal); 
        return;
    }

    let val = parseFloat(rawVal);
    if (isNaN(val)) val = 0;
    
    if (val < 0 && Math.abs(val) > maxRevertable) {
        toast.warning(`Máximo para estornar: ${maxRevertable}`);
        val = -maxRevertable;
    }
    if (val > 0 && val > maxAddable) {
        toast.warning(`Máximo para adicionar: ${maxAddable}`);
        val = maxAddable;
    }
    onChange(String(val));
  };

  const hasChange = inputValue !== 0;

  const quickFill = () => {
      if (maxAddable > 0) onChange(String(maxAddable));
      else toast.info("Estoque insuficiente ou pedido já completo.");
  };

  return (
    <div className={cn(
      "relative flex flex-col sm:flex-row gap-4 p-4 rounded-xl border bg-card shadow-sm transition-all duration-300",
      isComplete ? "border-emerald-500/40 bg-emerald-50/10 shadow-emerald-500/10" : "border-border hover:border-primary/40",
      hasChange && "ring-2 ring-primary border-primary bg-primary/5"
    )}>
      
      {/* Coluna do Produto */}
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
           <Badge variant="outline" className="text-[10px] font-mono h-5 px-1.5 bg-background">{item.products?.sku}</Badge>
           {isComplete && (
               <span className="text-emerald-600 text-xs font-bold flex items-center gap-1 bg-emerald-100 px-2 py-0.5 rounded-full animate-in zoom-in">
                   <CheckCircle2 className="h-3 w-3"/> OK
               </span>
           )}
        </div>
        
        <div>
            <div className="font-semibold text-base leading-snug">{item.products?.name}</div>
            {approvedDeduction > 0 && (
                <span className="text-[10px] text-red-500 font-medium mt-1 flex items-center gap-1">
                    <RotateCcw className="h-3 w-3" /> {approvedDeduction} devolvido(s).
                </span>
            )}
        </div>

        {/* Barra de Progresso Visual e Financeira */}
        <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                <span>Progresso: {projectedTotal} / {requested}</span>
                <span className={cn("font-bold", isComplete ? "text-emerald-600" : "text-primary")}>
                    {formatCurrency(totalValueSeparated)} / {formatCurrency(totalValueRequested)}
                </span>
            </div>
            <CustomProgressBar value={projectedTotal} max={requested} indicatorColor={isComplete ? "bg-emerald-500" : "bg-primary"} className={isComplete ? "bg-emerald-100" : ""} />
        </div>
      </div>

      {/* Coluna de Ações e Infos */}
      <div className="flex flex-col sm:items-end justify-between gap-3 min-w-[140px]">
         
         <div className="flex gap-4 text-sm text-right">
             <div className="flex flex-col">
                 <span className="text-[10px] text-muted-foreground font-bold uppercase">Estoque</span>
                 <span className="font-bold">{dbOnHand}</span>
             </div>
             <div className="flex flex-col">
                 <span className="text-[10px] text-muted-foreground font-bold uppercase">Reservado</span>
                 <span className={cn("font-bold", hasChange && "text-primary")}>
                    {dbReservedHere}
                    {hasChange && <span className="text-xs ml-1 opacity-80">({inputValue > 0 ? '+' : ''}{inputValue})</span>}
                 </span>
             </div>
         </div>

         {canEdit && (
            <div className="flex items-center gap-2">
                {!isComplete && maxAddable > 0 && (
                    <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-10 w-10 text-amber-500 border-amber-200 hover:bg-amber-50 hover:text-amber-600"
                        onClick={quickFill}
                        title="Completar Automaticamente"
                    >
                        <Zap className="h-4 w-4 fill-amber-500" />
                    </Button>
                )}
                
                <div className="relative group">
                    <Input 
                        type="number"
                        className={cn(
                            "h-10 w-24 text-center font-bold text-lg transition-all",
                            inputValue < 0 ? "border-red-500 text-red-600 bg-red-50" : 
                            inputValue > 0 ? "border-emerald-500 text-emerald-600 bg-emerald-50" : 
                            "bg-background"
                        )}
                        placeholder="0"
                        value={inputValue === 0 ? "" : inputValue}
                        onChange={handleInputChange}
                    />
                    <span className="absolute -top-2.5 left-2 bg-background px-1 text-[9px] text-muted-foreground group-hover:text-primary transition-colors">
                        {inputValue < 0 ? "Estorno" : "Adicionar"}
                    </span>
                </div>
            </div>
         )}
      </div>
    </div>
  );
};

// ===================== DETAILED VIEW (COM TOTALIZADORES GERAIS) =====================
const DetailedView = ({
    sep,
    isWarehouseMode,
    inputIncrements,
    setInputIncrements,
    onBack,
    onDelete,
    onOpenReturnModal,
    hasEdits,
    authorizeMutation,
    updateReturnStatusMutation,
    onSave,
    onDeliver
}: {
    sep: ISeparation;
    isWarehouseMode: boolean;
    inputIncrements: Record<string, number>;
    setInputIncrements: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    onBack: () => void;
    onDelete: (id: string) => void;
    onOpenReturnModal: () => void;
    hasEdits: boolean;
    authorizeMutation: any;
    updateReturnStatusMutation: any;
    onSave: () => void;
    onDeliver: () => void;
}) => {
    const isPending = sep.status === 'pendente' || sep.status === 'em_separacao';
    const isDelivered = sep.status === 'entregue';
    
    let returnStatus = { expired: false, daysLeft: 0, label: "" };
    let isArchived = false;

    if (sep.status === 'finalizada') {
        isArchived = true;
    }

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
            const currentIncrement = inputIncrements[item.id] || 0;
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

    const generatePDF = () => {
        const doc = new jsPDF();
        
        doc.setFontSize(22);
        doc.setTextColor(0, 0, 0);
        doc.text("Ordem de Separação", 14, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 26);

        doc.setFillColor(240, 240, 240);
        doc.rect(14, 32, 182, 28, 'F');
        
        doc.setFontSize(12);
        doc.setTextColor(0);
        
        doc.setFont("helvetica", "bold");
        doc.text(`Cliente: ${sep.client_name}`, 18, 40);
        doc.text(`OP: ${sep.production_order}`, 18, 48);
        
        doc.setFont("helvetica", "normal");
        doc.text(`Destino: ${sep.destination}`, 120, 40);
        doc.text(`Status: ${sep.status.toUpperCase()}`, 120, 48);
        doc.text(`Data Pedido: ${format(new Date(sep.created_at), "dd/MM/yyyy")}`, 18, 56);

        const totalItems = sep.items.length;
        const completedItems = sep.items.filter(i => i.quantity >= i.qty_requested).length;
        const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

        doc.setFontSize(10);
        doc.text(`Progresso: ${progress.toFixed(0)}% Concluído`, 120, 56);

        const tableRows = sep.items.map(item => {
            const requested = item.qty_requested;
            const separated = item.quantity;
            const missing = Math.max(0, requested - separated);
            const stock = item.products?.stock?.quantity_on_hand ?? item.products?.stock_available ?? 0;
            const status = separated >= requested ? "Completo" : "Pendente";

            return [
                `${item.products?.sku}\n${item.products?.name}`,
                requested,
                separated,
                missing > 0 ? missing : "-",
                stock,
                status
            ];
        });

        // @ts-ignore
        autoTable(doc, {
            startY: 65,
            head: [['Produto / SKU', 'Solicitado', 'Separado', 'Falta', 'Estoque Atual', 'Status']],
            body: tableRows,
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 9, valign: 'middle', cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 70 },
                1: { halign: 'center' },
                2: { halign: 'center', fontStyle: 'bold' },
                3: { halign: 'center', textColor: [220, 53, 69] },
                4: { halign: 'center' },
                5: { halign: 'center' }
            },
            didParseCell: function(data: any) {
                if (data.section === 'body' && data.column.index === 5) {
                    if (data.cell.raw === 'Pendente') {
                        data.cell.styles.textColor = [220, 53, 69];
                    } else {
                        data.cell.styles.textColor = [40, 167, 69];
                    }
                }
            }
        });

        const pageCount = (doc as any).internal.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text('Fluxo Royale - Sistema de Controle de Estoque', 14, doc.internal.pageSize.height - 10);
            doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
        }

        doc.save(`Pedido_${sep.production_order}_${sep.client_name}.pdf`);
    };

    return (
       <m.div 
         initial={{ opacity: 0, y: 15 }} 
         animate={{ opacity: 1, y: 0 }} 
         exit={{ opacity: 0, y: -15 }}
         className="bg-background min-h-screen flex flex-col w-full"
       >
          <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b shadow-sm">
              <div className="w-full px-3 sm:container sm:px-8 py-4">
                  <div className="flex items-center gap-4 mb-2">
                      <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-muted/50 rounded-full h-10 w-10">
                          <ArrowLeft className="h-5 w-5" />
                      </Button>
                      <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-muted-foreground">OP: {sep.production_order}</span>
                              <Badge variant={isArchived ? "secondary" : (isPending ? "default" : "secondary")} className={isArchived ? "bg-zinc-500 text-white hover:bg-zinc-600" : ""}>
                                  {isArchived ? "Finalizado" : (sep.status === 'em_separacao' ? 'Em Separação' : sep.status)}
                              </Badge>
                          </div>
                          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight truncate">{sep.client_name}</h1>
                      </div>
                      
                      <div className="hidden lg:flex flex-col items-end mr-4 px-4 border-r">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Separado</span>
                          <span className="text-lg font-bold text-emerald-600">
                              {formatCurrency(grandTotalSeparated)}
                          </span>
                      </div>
                      <div className="hidden lg:flex flex-col items-end mr-4">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Pedido</span>
                          <span className="text-base font-medium">
                              {formatCurrency(grandTotalRequested)}
                          </span>
                      </div>

                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="hidden sm:flex gap-2 mr-2 border-dashed border-2"
                        onClick={generatePDF}
                      >
                          <FileText className="h-4 w-4 text-red-500" />
                          Exportar PDF
                      </Button>
                      
                      <Button variant="ghost" size="icon" className="sm:hidden shrink-0" onClick={generatePDF}>
                          <Download className="h-5 w-5 text-muted-foreground" />
                      </Button>

                      {isDelivered && !isArchived && (
                         <div className={cn(
                             "hidden md:flex ml-auto items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold",
                             returnStatus.expired ? "bg-red-50 border-red-200 text-red-600" : "bg-blue-50 border-blue-200 text-blue-600"
                         )}>
                             {returnStatus.expired ? <Ban className="h-4 w-4"/> : <Clock className="h-4 w-4"/>}
                             {returnStatus.label}
                         </div>
                      )}

                      {isWarehouseMode && isPending && (
                          <Button 
                            variant="destructive" 
                            size="icon" 
                            className="rounded-full h-10 w-10 shadow-sm ml-2 shrink-0" 
                            onClick={() => onDelete(sep.id)}
                            title="Excluir Solicitação"
                          >
                              <Trash2 className="h-5 w-5" />
                          </Button>
                      )}
                  </div>

                  <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mt-3">
                      <div 
                          className="h-full bg-emerald-500 transition-all duration-500 ease-out" 
                          style={{ width: `${progressPercent}%` }} 
                      />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
                      <span>Progresso Financeiro</span>
                      <span>{progressPercent.toFixed(1)}%</span>
                  </div>
              </div>
          </div>

          <div className="flex-1 w-full px-2 sm:container sm:px-8 py-6 pb-40">
             <Tabs defaultValue="items">
                <TabsList className="grid w-full grid-cols-2 mb-6 max-w-md">
                   <TabsTrigger value="items">Itens do Pedido ({sep.items.length})</TabsTrigger>
                   <TabsTrigger value="returns">Devoluções ({sep.returns?.length || 0})</TabsTrigger>
                </TabsList>

                <TabsContent value="items" className="space-y-4">
                   {sep.items.map(item => {
                      const approvedQty = sep.returns
                          ?.filter(r => r.product_id === item.product_id && r.status === 'aprovado')
                          .reduce((acc, curr) => acc + curr.quantity, 0) || 0;

                      return (
                          <SeparationItemDetailedRow
                             key={item.id}
                             item={item}
                             inputValue={inputIncrements[item.id] || 0}
                             onChange={(val) => setInputIncrements(prev => ({ ...prev, [item.id]: parseFloat(val) }))}
                             isWarehouse={isWarehouseMode}
                             canEdit={isWarehouseMode && isPending}
                             approvedDeduction={approvedQty}
                          />
                      )
                   })}
                </TabsContent>

                <TabsContent value="returns">
                   {(!sep.returns || sep.returns.length === 0) ? (
                      <EmptyState 
                          title="Sem devoluções" 
                          description="Nenhum item devolvido."
                          action={
                            (isDelivered || sep.status === 'finalizada') && !returnStatus.expired && !isWarehouseMode ? (
                                <Button onClick={onOpenReturnModal} className="mt-4">Nova Devolução</Button>
                            ) : null
                          }
                      />
                   ) : (
                      <div className="space-y-3">
                          {sep.returns.map(ret => (
                             <div key={ret.id} className="flex items-center justify-between p-4 border rounded-xl bg-card">
                               <div>
                                  <p className="font-bold uppercase text-sm">{ret.product_name}</p>
                                  <Badge variant={ret.status === 'aprovado' ? 'default' : ret.status === 'rejeitado' ? 'destructive' : 'secondary'} className="mt-1 text-[10px]">
                                     {ret.status}
                                  </Badge>
                               </div>
                               <div className="text-right">
                                  <span className="block text-[10px] text-muted-foreground uppercase font-bold">Qtd</span>
                                  <span className="text-xl font-bold">{ret.quantity}</span>
                               </div>
                               {isWarehouseMode && ret.status === 'pendente' && (
                                  <div className="flex gap-2 ml-4">
                                     <Button size="icon" className="h-8 w-8 bg-emerald-500" onClick={() => updateReturnStatusMutation.mutate({ separationId: sep.id, returnId: ret.id, status: 'aprovado' })}>
                                        <Check className="h-4 w-4" />
                                     </Button>
                                     <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => updateReturnStatusMutation.mutate({ separationId: sep.id, returnId: ret.id, status: 'rejeitado' })}>
                                        <X className="h-4 w-4" />
                                     </Button>
                                  </div>
                               )}
                             </div>
                          ))}
                          {(isDelivered || sep.status === 'finalizada') && !returnStatus.expired && !isWarehouseMode && (
                             <Button onClick={onOpenReturnModal} className="w-full mt-4" variant="outline">
                                <Plus className="mr-2 h-4 w-4" /> Nova Devolução
                             </Button>
                          )}
                      </div>
                   )}
                </TabsContent>
             </Tabs>
          </div>

          {/* RODAPÉ FLUTUANTE ESTILO ILHA - TAMANHO CORRIGIDO */}
          {isWarehouseMode && isPending && (
             <div className="fixed bottom-24 left-3 right-3 lg:left-1/2 lg:-translate-x-1/2 lg:bottom-8 lg:w-full lg:max-w-2xl bg-card/95 backdrop-blur-md border rounded-3xl p-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] z-50">
                <div className="flex flex-col gap-2">
                    <div className="flex lg:hidden justify-between items-center text-sm px-2 pb-1 border-b border-border/50">
                        <span className="text-muted-foreground font-medium">Total Separado:</span>
                        <span className="font-bold text-emerald-600">{formatCurrency(grandTotalSeparated)}</span>
                    </div>

                    <div className="flex gap-2 w-full">
                        <Button 
                            variant="secondary" 
                            className="flex-1 h-12 sm:h-14 px-2 sm:px-4 rounded-2xl font-bold border-2 border-transparent hover:border-primary/20 min-w-0"
                            disabled={!hasEdits || authorizeMutation.isPending}
                            onClick={onSave}
                        >
                            {authorizeMutation.isPending ? <Loader2 className="animate-spin mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5 shrink-0" /> : <Save className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5 shrink-0" />}
                            <span className="truncate text-sm sm:text-base">Salvar<span className="hidden sm:inline"> Alterações</span></span>
                        </Button>
                        <Button 
                            className="flex-1 h-12 sm:h-14 px-2 sm:px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/20 min-w-0"
                            onClick={onDeliver}
                            disabled={authorizeMutation.isPending}
                        >
                            <Truck className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                            <span className="truncate text-sm sm:text-base">Entregar</span>
                        </Button>
                    </div>
                </div>
             </div>
          )}
       </m.div>
    );
};


// ===================== MAIN =====================
export default function Separations() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { socket } = useSocket() || {};

  const isRealAlmoxarife = profile?.role === "almoxarife" || profile?.role === "admin";
  const [isWarehouseMode, setIsWarehouseMode] = useState(false);
  
  useEffect(() => {
    if (isRealAlmoxarife) setIsWarehouseMode(true);
  }, [isRealAlmoxarife]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inputIncrements, setInputIncrements] = useState<Record<string, number>>({});
  const [returnPayload, setReturnPayload] = useState<Record<string, number>>({});
  
  const [isPartialDeliveryModalOpen, setIsPartialDeliveryModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<"pendente" | "entregue" | "arquivadas">("pendente");
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);
  
  const [isNewSheetOpen, setIsNewSheetOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [productionOrder, setProductionOrder] = useState("");
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Record<string, number>>({});
  const [showStockOnly, setShowStockOnly] = useState(false); 

  const { data: separations = [], isLoading } = useQuery({
    queryKey: ["separations"],
    queryFn: async () => (await api.get("/separations")).data,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => (await api.get("/products")).data,
  });

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
            const stock = p.stock?.quantity_on_hand ?? p.stock_available ?? 0;
            return stock > 0;
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
      queryClient.invalidateQueries({ queryKey: ["separations"] });
      queryClient.invalidateQueries({ queryKey: ["products-list"] });
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

  const createSeparationMutation = useMutation({
    mutationFn: async (data: any) => await api.post("/separations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["separations"] });
      toast.success("Solicitação salva com sucesso!");
      setIsNewSheetOpen(false);
      setClientName(""); 
      setProductionOrder(""); 
      setSelectedProducts({});
      setProductSearchTerm("");
    },
    onError: () => toast.error("Erro ao salvar"),
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
        console.error("Erro na devolução:", error);
        const msg = error.response?.data?.error || error.message || "Erro ao atualizar devolução";
        toast.error(msg);
    }
  });

  const handleSaveAuth = () => {
    if (!selectedSeparation) return;
    const payload = selectedSeparation.items.map((i) => ({
      id: i.id,
      quantity: i.quantity + (inputIncrements[i.id] || 0),
    }));
    authorizeMutation.mutate({ id: selectedSeparation.id, items: payload, statusAction: "reservar" });
  };

  const handleDeliverCheck = () => {
    if (!selectedSeparation) return;
    const isFullyReady = selectedSeparation.items.every(
      (i) => i.quantity + (inputIncrements[i.id] || 0) >= i.qty_requested
    );
    
    if (!isFullyReady) {
        setIsPartialDeliveryModalOpen(true);
    } else {
        executeDelivery();
    }
  };

  const executeDelivery = () => {
    if (!selectedSeparation) return;
    const payload = selectedSeparation.items.map((i) => ({
        id: i.id,
        quantity: i.quantity + (inputIncrements[i.id] || 0),
    }));
    authorizeMutation.mutate({ id: selectedSeparation.id, items: payload, statusAction: "entregar" });
  };

  const handleReturnSubmit = () => {
    if (!selectedSeparation) return;
    const itemsToReturn = Object.entries(returnPayload)
      .map(([pid, qty]) => ({ product_id: pid, quantity: qty }))
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

  const totalItemsInCart = Object.values(selectedProducts).reduce((a, b) => a + b, 0);
  const totalUniqueItems = Object.keys(selectedProducts).length;

  const hasEdits = Object.values(inputIncrements).some(v => v !== 0);

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden">
        
        {!selectedSeparation && (
            <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container px-3 sm:px-8 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                            <Box className="h-6 w-6" />
                        </div>
                        <div className="hidden sm:block">
                            <h1 className="text-xl font-bold leading-none">Separação</h1>
                            <p className="text-xs text-muted-foreground">Controle de Estoque</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {isRealAlmoxarife && (
                            <div className="flex items-center gap-2 mr-2 bg-muted/50 p-1 rounded-lg px-2 border">
                                <Label htmlFor="wh-mode" className="text-xs font-semibold cursor-pointer">Almoxarifado</Label>
                                <Switch id="wh-mode" checked={isWarehouseMode} onCheckedChange={setIsWarehouseMode} />
                            </div>
                        )}
                        {!isWarehouseMode && (
                            <Button onClick={() => setIsNewSheetOpen(true)} className="rounded-full font-bold shadow-sm bg-primary hover:bg-primary/90">
                                <Plus className="mr-2 h-4 w-4" /> Novo Pedido
                            </Button>
                        )}
                    </div>
                </div>
            </header>
        )}

        <main className="container px-3 sm:px-8 py-6">
           <AnimatePresence mode="wait">
              {selectedSeparation ? (
                  <DetailedView 
                      key="detail"
                      sep={selectedSeparation}
                      isWarehouseMode={isWarehouseMode}
                      inputIncrements={inputIncrements}
                      setInputIncrements={setInputIncrements}
                      onBack={resetSelection}
                      onDelete={setDeleteId} 
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
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      className="space-y-6"
                  >
                      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-card p-4 rounded-xl border shadow-sm">
                         <div className="relative w-full sm:max-w-xs group">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input 
                                placeholder="Filtrar pedidos..." 
                                className="pl-9 bg-muted/30 border-transparent focus:bg-background focus:border-primary transition-all"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                         </div>
                         <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full sm:w-auto">
                             <TabsList>
                                 <TabsTrigger value="pendente">Pendentes</TabsTrigger>
                                 <TabsTrigger value="entregue">Entregues</TabsTrigger>
                                 <TabsTrigger value="arquivadas">Arquivadas</TabsTrigger>
                             </TabsList>
                         </Tabs>
                      </div>

                      {filteredSeparations.length === 0 ? (
                         <EmptyState title="Tudo limpo!" description="Nenhum pedido encontrado com os filtros atuais." />
                      ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                             {filteredSeparations.map(sep => (
                                 <SeparationCard 
                                    key={sep.id} 
                                    separation={sep} 
                                    onClick={() => setSelectedId(sep.id)} 
                                 />
                             ))}
                         </div>
                      )}
                  </m.div>
              )}
           </AnimatePresence>
        </main>

        {/* --- SHEET DE CRIAÇÃO --- */}
        <Sheet open={isNewSheetOpen} onOpenChange={setIsNewSheetOpen}>
            <SheetContent className="w-full sm:max-w-xl flex flex-col h-full p-0 border-l shadow-2xl" side="right">
                <div className="px-6 py-5 border-b bg-background/95 backdrop-blur z-10 flex-none">
                    <SheetHeader>
                        <SheetTitle className="text-xl font-bold flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5 text-primary" />
                            Nova Solicitação
                        </SheetTitle>
                        <SheetDescription>Preencha os dados e monte o pedido.</SheetDescription>
                    </SheetHeader>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 bg-muted/5">
                    <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">1</div>
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Dados do Pedido</h3>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-muted-foreground">Número da OP</Label>
                                <Input 
                                    value={productionOrder} 
                                    onChange={e => setProductionOrder(e.target.value)} 
                                    placeholder="Ex: 12345" 
                                    className="h-11 bg-background border-muted-foreground/20 focus:border-primary transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-muted-foreground">Cliente</Label>
                                <Input 
                                    value={clientName} 
                                    onChange={e => setClientName(e.target.value)} 
                                    placeholder="Ex: Cliente A" 
                                    className="h-11 bg-background border-muted-foreground/20 focus:border-primary transition-all"
                                />
                            </div>
                        </div>
                    </section>

                    <Separator className="my-6" />

                    <section className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                        <div className="flex items-center justify-between sticky top-0 bg-muted/5 pt-2 pb-2 z-10">
                            <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">2</div>
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Catálogo</h3>
                            </div>
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                                {totalUniqueItems} selecionado(s)
                            </Badge>
                        </div>
                        
                        <div className="flex flex-col gap-3 sticky top-0 z-10 bg-muted/5 pb-2 pt-2 backdrop-blur-sm">
                            <div className="relative shadow-sm">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar por nome ou SKU..." 
                                    value={productSearchTerm}
                                    onChange={e => setProductSearchTerm(e.target.value)}
                                    className="pl-10 h-10 bg-background border-muted-foreground/20 focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch id="stock-filter" checked={showStockOnly} onCheckedChange={setShowStockOnly} />
                                <Label htmlFor="stock-filter" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
                                    <Filter className="h-3 w-3" /> Apenas com estoque
                                </Label>
                            </div>
                        </div>

                        <div className="space-y-3 min-h-[300px]">
                            {filteredCatalogProducts.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-xl bg-background/50">
                                    <Search className="h-8 w-8 mb-2 opacity-20" />
                                    <p className="text-sm font-medium">Nenhum produto encontrado</p>
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

                <div className="border-t bg-background p-6 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-20 flex-none mt-auto">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Itens Totais</span>
                                <strong className="text-lg text-foreground">{totalItemsInCart}</strong>
                            </div>
                            {totalItemsInCart > 0 && (
                                <Button variant="ghost" size="sm" onClick={clearCart} className="text-xs text-destructive hover:bg-destructive/10 h-6">
                                    <XCircle className="h-3 w-3 mr-1" /> Limpar
                                </Button>
                            )}
                        </div>
                        
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" size="lg" className="flex-1 h-12" onClick={() => setIsNewSheetOpen(false)}>
                                Cancelar
                            </Button>
                            <Button 
                                size="lg"
                                className="flex-[2] h-12 font-bold text-base shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
                                disabled={createSeparationMutation.isPending || totalItemsInCart === 0 || !productionOrder || !clientName}
                                onClick={() => {
                                    const itemsPayload = Object.entries(selectedProducts).map(([pid, qty]) => ({
                                        product_id: pid,
                                        quantity: qty
                                    }));
                                    createSeparationMutation.mutate({
                                        production_order: productionOrder,
                                        client_name: clientName,
                                        destination: profile?.sector || "Setor",
                                        items: itemsPayload
                                    });
                                }}
                            >
                                {createSeparationMutation.isPending ? (
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                ) : (
                                    <Check className="mr-2 h-5 w-5" />
                                )}
                                Confirmar Pedido
                            </Button>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>

        <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
           <AlertDialogContent>
              <AlertDialogHeader>
                 <AlertDialogTitle className="text-destructive flex items-center gap-2">
                    <Trash2 className="h-5 w-5" /> Excluir Pedido
                 </AlertDialogTitle>
                 <AlertDialogDescription>
                    Tem certeza que deseja excluir esta solicitação? Esta ação removerá o pedido permanentemente e não pode ser desfeita.
                 </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                 <AlertDialogCancel>Cancelar</AlertDialogCancel>
                 <AlertDialogAction 
                    onClick={() => deleteId && deleteSeparationMutation.mutate(deleteId)} 
                    className="bg-destructive hover:bg-destructive/90 text-white"
                 >
                    {deleteSeparationMutation.isPending ? "Excluindo..." : "Sim, Excluir"}
                 </AlertDialogAction>
              </AlertDialogFooter>
           </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={isPartialDeliveryModalOpen} onOpenChange={setIsPartialDeliveryModalOpen}>
           <AlertDialogContent>
               <AlertDialogHeader>
                   <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                       <AlertTriangle className="h-5 w-5" />
                       Entrega Parcial Detectada
                   </AlertDialogTitle>
                   <AlertDialogDescription>
                       Este pedido não está 100% completo. Alguns itens ainda possuem pendências.
                       <br/><br/>
                       Deseja finalizar a entrega mesmo assim? Os itens restantes continuarão pendentes ou serão ajustados conforme a regra de negócio.
                   </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                   <AlertDialogCancel>Voltar e Revisar</AlertDialogCancel>
                   <AlertDialogAction 
                       onClick={executeDelivery}
                       className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                   >
                       Confirmar Entrega Parcial
                   </AlertDialogAction>
               </AlertDialogFooter>
           </AlertDialogContent>
        </AlertDialog>
        
        <Dialog open={isReturnModalOpen} onOpenChange={setIsReturnModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Devolver Itens</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                     {selectedSeparation?.items.map(item => {
                         const returned = selectedSeparation.returns?.filter(r => r.product_id === item.product_id && r.status !== 'rejeitado').reduce((a, b) => a + b.quantity, 0) || 0;
                         const available = item.quantity - returned;
                         if (available <= 0) return null;
                         return (
                             <div key={item.id} className="flex justify-between items-center border-b pb-2">
                                 <div>
                                     <div className="font-semibold text-sm">{item.products?.name}</div>
                                     <div className="text-xs text-muted-foreground">Disp: {available}</div>
                                 </div>
                                 <Input 
                                     type="number" className="w-20" placeholder="0" max={available}
                                     value={returnPayload[item.product_id] || ""}
                                     onChange={e => {
                                         let v = parseFloat(e.target.value);
                                         if(v > available) v = available;
                                         setReturnPayload(p => ({...p, [item.product_id]: v}));
                                     }}
                                 />
                             </div>
                         )
                     })}
                </div>
                <DialogFooter>
                    <Button onClick={handleReturnSubmit} disabled={createReturnMutation.isPending}>Confirmar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

      </div>
    </LazyMotion>
  );
}
