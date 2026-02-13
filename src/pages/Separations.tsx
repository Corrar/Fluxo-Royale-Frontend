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

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

import {
  Plus,
  Trash2,
  Clock,
  Search,
  Save,
  User,
  Truck,
  Check,
  Loader2,
  Sparkles,
  X,
  ArrowLeft,
  CheckCircle2,
  Box,
  Ban,
  AlertCircle,
  AlertTriangle,
  RotateCcw
} from "lucide-react";

import { format, differenceInDays, addDays } from "date-fns";
import { cn } from "@/lib/utils";

import {
  LazyMotion,
  domAnimation,
  m,
  AnimatePresence,
} from "framer-motion";

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
  <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-xl border-muted bg-muted/5 min-h-[200px]">
    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
      <Sparkles className="h-6 w-6 text-muted-foreground" />
    </div>
    <h3 className="text-lg font-semibold">{title}</h3>
    <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">{description}</p>
    {action}
  </div>
);

// ===================== PRODUCT SELECTOR (CORRIGIDO) =====================
const ProductSelector = ({
  products,
  value,
  onChange,
}: {
  products: IProduct[];
  value: string;
  onChange: (val: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(""); // Estado para controlar a busca
  const selectedProduct = products?.find((p) => p.id === value);

  // Filtra os produtos na memória antes de renderizar
  // Isso permite buscar em TODA a lista, mas exibir apenas 50 resultados para não travar
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    // Se não tiver termo de busca, retorna os primeiros 50
    if (!searchTerm) return products.slice(0, 50);

    const lowerTerm = searchTerm.toLowerCase();
    return products
      .filter((product) => 
        product.name.toLowerCase().includes(lowerTerm) || 
        product.sku.toLowerCase().includes(lowerTerm)
      )
      .slice(0, 50); // Limita os resultados da busca a 50 itens
  }, [products, searchTerm]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex-1 justify-between w-full h-11 px-3 text-left font-normal",
            !selectedProduct && "text-muted-foreground"
          )}
        >
          {selectedProduct ? (
            <span className="truncate">{selectedProduct.name}</span>
          ) : (
            <span>Selecionar produto...</span>
          )}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[300px] p-0" align="start">
        {/* shouldFilter={false} é CRUCIAL: diz ao componente para não filtrar sozinho, 
            pois já fizemos isso no filteredProducts */}
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Buscar SKU ou nome..." 
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            {filteredProducts.length === 0 && (
               <CommandEmpty>Produto não encontrado.</CommandEmpty>
            )}
            
            <CommandGroup>
              {filteredProducts.map((product) => {
                const stock = product.stock?.quantity_on_hand ?? product.stock_available ?? 0;
                const isSelected = value === product.id;
                return (
                  <CommandItem
                    key={product.id}
                    value={product.id} // Usamos ID para controlar a seleção
                    onSelect={() => {
                      onChange(product.id);
                      setOpen(false);
                      setSearchTerm(""); // Limpa a busca ao selecionar
                    }}
                    className="py-3"
                  >
                    <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      <span className="truncate font-medium">{product.name}</span>
                      <span className="text-xs text-muted-foreground">
                        SKU: {product.sku} • Estoque: {stock} {product.unit}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// ===================== COMPONENT: DETAILED ITEM ROW =====================
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
  
  // Quantidade REALMENTE reservada no momento
  const dbReservedHere = Math.max(0, (item.quantity || 0) - approvedDeduction);
  
  const requested = item.qty_requested || 0;
  const isComplete = dbReservedHere >= requested;

  const remainingRequest = Math.max(0, requested - dbReservedHere);
  
  // MÁXIMO para ADICIONAR (Positivo)
  const maxAddable = Math.min(remainingRequest, dbOnHand);
  
  // MÁXIMO para ESTORNAR (Negativo - só pode tirar o que já reservou)
  const maxRevertable = dbReservedHere;

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val)) val = 0;
    
    // 1. Bloqueio de Estorno Excessivo (Não pode tirar mais do que tem)
    if (val < 0 && Math.abs(val) > maxRevertable) {
        toast.warning(`Máximo para estornar: ${maxRevertable}`);
        val = -maxRevertable;
    }

    // 2. Bloqueio de Adição Excessiva
    if (val > 0 && val > maxAddable) {
        toast.warning(`Máximo para adicionar: ${maxAddable}`);
        val = maxAddable;
    }

    onChange(String(val));
  };

  const hasChange = inputValue !== 0;
  const projected = dbReservedHere + inputValue;

  return (
    <div className={cn(
      "relative flex flex-col sm:flex-row gap-4 p-4 rounded-xl border bg-card shadow-sm transition-all duration-200",
      isComplete ? "border-emerald-500/40 bg-emerald-50/10" : "border-border hover:border-primary/40",
      hasChange && "ring-1 ring-primary border-primary bg-primary/5"
    )}>
      
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
           <Badge variant="outline" className="text-[10px] font-mono h-5 px-1">{item.products?.sku}</Badge>
           {isComplete && <span className="text-emerald-600 text-xs font-bold flex items-center gap-1"><CheckCircle2 className="h-3 w-3"/> OK</span>}
        </div>
        <div className="font-semibold text-base leading-snug">{item.products?.name}</div>
        
        {approvedDeduction > 0 && (
            <span className="text-[10px] text-red-500 font-medium mt-1 block flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> {approvedDeduction} devolvido(s).
            </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4 min-w-[300px]">
        <div className="bg-muted/30 rounded-lg p-2 flex flex-col items-center justify-center border border-border/50">
           <span className="text-[10px] uppercase font-bold text-muted-foreground">Solicitado</span>
           <span className="text-lg font-bold text-foreground">{requested}</span>
        </div>

        <div className={cn(
            "rounded-lg p-2 flex flex-col items-center justify-center border transition-colors",
            isComplete ? "bg-emerald-100/20 border-emerald-200 text-emerald-700 dark:text-emerald-400" : 
            "bg-amber-100/10 border-amber-200 text-amber-700 dark:text-amber-400"
        )}>
           <span className="text-[10px] uppercase font-bold opacity-80">Reservado</span>
           <div className="flex items-center gap-1">
               <span className="text-lg font-bold">{dbReservedHere}</span>
               {hasChange && <span className={cn("text-xs animate-pulse font-bold", inputValue < 0 ? "text-red-500" : "text-emerald-600")}>
                   → {projected}
               </span>}
           </div>
           
           {!isComplete && (
             <div className="flex items-center gap-1 mt-1 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-full animate-in fade-in zoom-in duration-300">
                <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
                <span className="text-[10px] font-bold text-red-600 dark:text-red-400">
                    Falta {remainingRequest}
                </span>
             </div>
           )}
        </div>

        <div className="bg-blue-50/20 rounded-lg p-2 flex flex-col items-center justify-center border border-blue-100/20 text-blue-600 dark:text-blue-300">
           <span className="text-[10px] uppercase font-bold opacity-80">Estoque</span>
           <span className="text-lg font-bold">{dbOnHand}</span>
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-col justify-center sm:border-l pl-0 sm:pl-4 pt-2 sm:pt-0 border-border/50">
            <label className="text-[10px] text-muted-foreground mb-1 text-center sm:text-left">
                {inputValue < 0 ? "Estornar (-)" : "Adicionar (+)"}
            </label>
            <Input 
                type="number"
                // Permite negativo até o total reservado
                min={-maxRevertable} 
                max={maxAddable}
                className={cn(
                    "h-12 w-full sm:w-24 text-center font-bold text-lg rounded-lg transition-colors",
                    inputValue < 0 ? "bg-red-50 border-red-200 text-red-600" : 
                    hasChange ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-muted/50 border-transparent"
                )}
                placeholder="0"
                value={inputValue === 0 ? "" : inputValue}
                onChange={handleInputChange}
            />
            {inputValue < 0 ? (
                <span className="text-[10px] text-center text-red-500 mt-1 flex justify-center items-center gap-1">
                    <RotateCcw className="h-3 w-3"/> Devolvendo
                </span>
            ) : (
                <span className="text-[10px] text-center text-muted-foreground mt-1">Máx: {maxAddable}</span>
            )}
        </div>
      )}
    </div>
  );
};


// ===================== CARD PRINCIPAL (LISTA) =====================
const SeparationCard = ({
  separation: sep,
  onClick,
}: {
  separation: ISeparation;
  onClick: () => void;
}) => {
  const total = sep.items.length;
  const done = sep.items.filter(i => {
      const approvedReturns = sep.returns?.filter(r => r.product_id === i.product_id && r.status === 'aprovado').reduce((a, b) => a + b.quantity, 0) || 0;
      const netQty = Math.max(0, i.quantity - approvedReturns);
      return netQty >= i.qty_requested;
  }).length;
  
  const progress = total > 0 ? (done / total) * 100 : 0;
  
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

  // Lógica "Arquivado/Finalizado"
  const isArchived = sep.status === 'finalizada' || (sep.status === 'entregue' && isExpired);

  const statusColors = {
      pendente: "border-amber-500/50 hover:border-amber-500",
      em_separacao: "border-amber-500/50 hover:border-amber-500", 
      entregue: "border-emerald-500/50 hover:border-emerald-500",
      // Arquivado ganha cor neutra (Zinc)
      finalizado: "border-zinc-500/50 hover:border-zinc-500" 
  };

  const bgStatus = {
      pendente: "bg-amber-500",
      em_separacao: "bg-amber-500",
      entregue: "bg-emerald-500",
      // Arquivado
      finalizado: "bg-zinc-500"
  };

  // Determina label e estilo
  const displayStatus = isArchived ? 'Finalizado' : (sep.status === 'em_separacao' ? 'Em Separação' : sep.status);
  const statusKey = isArchived ? 'finalizado' : sep.status;

  return (
    <div 
        onClick={onClick}
        className={cn(
            "group relative flex flex-col justify-between rounded-2xl border-2 bg-card p-5 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1",
            deadlineInfo?.expired && !isArchived ? "border-red-300 dark:border-red-900/50" : (statusColors[statusKey as keyof typeof statusColors] || "border-border")
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

        <div className="flex-1 mb-4">
            <h3 className="text-xl font-black uppercase leading-tight tracking-tight text-foreground line-clamp-2">
                {sep.client_name}
            </h3>
            
            {deadlineInfo && !isArchived && (
                <div className={cn(
                    "mt-2 inline-flex items-center gap-1.5 rounded-md py-1 px-2 text-[11px] font-bold border animate-in fade-in slide-in-from-left-2",
                    deadlineInfo.expired ? "bg-red-100 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400" :
                    deadlineInfo.urgent ? "bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400" :
                    "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
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

        <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>{done}/{total} itens</span>
                <span>{progress.toFixed(0)}%</span>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                    className={cn("h-full transition-all duration-500", bgStatus[statusKey as keyof typeof bgStatus] || "bg-primary")} 
                    style={{ width: `${progress}%` }} 
                />
            </div>
        </div>

        <div className="absolute -top-3 -right-2">
             <Badge className={cn("shadow-md uppercase text-[10px] px-2 h-6", bgStatus[statusKey as keyof typeof bgStatus])}>
                {displayStatus}
             </Badge>
        </div>
    </div>
  );
};


// ===================== DETAILED VIEW =====================
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

    return (
       <m.div 
         initial={{ opacity: 0, x: 20 }} 
         animate={{ opacity: 1, x: 0 }} 
         exit={{ opacity: 0, x: 20 }}
         className="bg-background min-h-screen flex flex-col"
       >
          <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b shadow-sm">
              <div className="container py-4">
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
                      
                      {isDelivered && !isArchived && (
                         <div className={cn(
                             "ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold",
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
                            className="rounded-full h-10 w-10 shadow-sm" 
                            onClick={() => onDelete(sep.id)}
                            title="Excluir Solicitação"
                          >
                              <Trash2 className="h-5 w-5" />
                          </Button>
                      )}
                  </div>
              </div>
          </div>

          <div className="flex-1 container py-6 pb-32">
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

          {isWarehouseMode && isPending && (
             <div className="fixed bottom-0 w-full bg-background border-t p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.1)] z-40">
                <div className="container max-w-4xl flex gap-3">
                    <Button 
                        variant="secondary" 
                        size="lg"
                        className="flex-1 font-bold border-2 border-transparent hover:border-primary/20"
                        disabled={!hasEdits || authorizeMutation.isPending}
                        onClick={onSave}
                    >
                        {authorizeMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5" />}
                        Salvar Alterações
                    </Button>
                    <Button 
                        size="lg"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/20"
                        onClick={onDeliver}
                        disabled={authorizeMutation.isPending}
                    >
                        <Truck className="mr-2 h-5 w-5" />
                        Finalizar / Entregar
                    </Button>
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
  
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [productionOrder, setProductionOrder] = useState("");
  const [items, setItems] = useState<Array<{ product_id: string; quantity: string }>>([
    { product_id: "", quantity: "" },
  ]);

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

  const filteredProducts = useMemo(() => {
    return (products as IProduct[]).filter((p) => p.name.toLowerCase().includes("") || p.sku.toLowerCase().includes(""));
  }, [products]);

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
      toast.success("Solicitação salva!");
      setIsNewModalOpen(false);
      setClientName(""); setProductionOrder(""); setItems([{ product_id: "", quantity: "" }]);
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
      // CORREÇÃO: Rota singular padrão
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

  const hasEdits = Object.values(inputIncrements).some(v => v !== 0);

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen bg-background text-foreground font-sans">
        
        {!selectedSeparation && (
            <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
                <div className="container py-4 flex items-center justify-between gap-4">
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
                            <Button onClick={() => setIsNewModalOpen(true)} className="rounded-full font-bold shadow-sm">
                                <Plus className="mr-2 h-4 w-4" /> Novo Pedido
                            </Button>
                        )}
                    </div>
                </div>
            </header>
        )}

        <main className="container py-6">
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
                         <div className="relative w-full sm:max-w-xs">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
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

        {/* Modal Novo Pedido */}
        <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
           <DialogContent className="max-w-2xl">
              <DialogHeader>
                 <DialogTitle>Novo Pedido</DialogTitle>
                 <DialogDescription>Preencha os dados abaixo.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <Label>Número OP</Label>
                    <Input value={productionOrder} onChange={e => setProductionOrder(e.target.value)} placeholder="00000" />
                 </div>
                 <div className="space-y-1">
                    <Label>Cliente</Label>
                    <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nome do Cliente" />
                 </div>
              </div>
              <ScrollArea className="h-[250px] border rounded-md p-2 bg-muted/10">
                 <div className="space-y-2">
                    {items.map((item, idx) => (
                       <div key={idx} className="flex gap-2 items-end bg-background p-2 rounded border">
                          <div className="flex-1 space-y-1">
                             <Label className="text-[10px]">Produto</Label>
                             <ProductSelector 
                                products={products} 
                                value={item.product_id}
                                onChange={(val) => {
                                   const n = [...items]; n[idx].product_id = val; setItems(n);
                                }}
                             />
                          </div>
                          <div className="w-20 space-y-1">
                             <Label className="text-[10px]">Qtd</Label>
                             <Input type="number" value={item.quantity} onChange={e => {
                                const n = [...items]; n[idx].quantity = e.target.value; setItems(n);
                             }} />
                          </div>
                          <Button variant="ghost" size="icon" className="text-red-500" onClick={() => {
                             if(items.length > 1) setItems(items.filter((_, i) => i !== idx));
                          }}>
                             <Trash2 className="h-4 w-4" />
                          </Button>
                       </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setItems([...items, { product_id: "", quantity: "" }])} className="w-full">
                       <Plus className="mr-2 h-4 w-4" /> Adicionar Item
                    </Button>
                 </div>
              </ScrollArea>
              <DialogFooter>
                 <Button variant="outline" onClick={() => setIsNewModalOpen(false)}>Cancelar</Button>
                 <Button onClick={() => {
                    if(!productionOrder || !clientName) return toast.error("Preencha OP e Cliente");
                    const validItems = items.filter(i => i.product_id && Number(i.quantity) > 0);
                    if(validItems.length === 0) return toast.error("Adicione itens válidos");
                    createSeparationMutation.mutate({
                       production_order: productionOrder,
                       client_name: clientName,
                       destination: profile?.sector || "Setor",
                       items: validItems.map(i => ({ product_id: i.product_id, quantity: Number(i.quantity) }))
                    });
                 }} disabled={createSeparationMutation.isPending}>
                    {createSeparationMutation.isPending && <Loader2 className="animate-spin mr-2" />} Criar
                 </Button>
              </DialogFooter>
           </DialogContent>
        </Dialog>

        {/* Modal Confirmação de Exclusão */}
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

        {/* Novo Modal de Confirmação de Entrega Parcial */}
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
        
        {/* Modal de Devolução */}
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
