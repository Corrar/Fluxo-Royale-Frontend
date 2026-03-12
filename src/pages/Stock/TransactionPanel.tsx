import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCcw, TrendingUp, TrendingDown, Package, Search, Trash2, CheckCircle2 } from "lucide-react";

// IMPORTAÇÃO DOS TIPOS
import { StockItem, CartItem } from "@/types/stock";

interface TransactionPanelProps {
  viewMode: "entry" | "exit";
  setViewMode: (mode: "entry" | "exit" | "table") => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filteredStocks: StockItem[]; 
  cart: CartItem[]; 
  setCart: (cart: CartItem[]) => void;
  destination: string;
  setDestination: (dest: string) => void;
  sectors: string[];
  addToCart: (stock: StockItem) => void; 
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, newQty: number) => void;
  handleConfirmTransaction: () => void;
  isPending: boolean;
  resetTransaction: () => void;
}

export function TransactionPanel({
  viewMode, setViewMode, searchTerm, setSearchTerm, filteredStocks,
  cart, setCart, destination, setDestination, sectors,
  addToCart, removeFromCart, updateQuantity, handleConfirmTransaction,
  isPending, resetTransaction
}: TransactionPanelProps) {
  
  const isEntry = viewMode === "entry";
  const themeClass = isEntry ? "text-emerald-600" : "text-red-600";
  const bgClass = isEntry ? "bg-emerald-50" : "bg-red-50";
  const borderClass = isEntry ? "border-emerald-200" : "border-red-200";

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500 pb-10 min-h-[calc(100vh-4rem)]">
      
      {/* Header do Modo */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shrink-0">
        <div className="flex items-center gap-3 w-full">
          <Button variant="outline" size="icon" onClick={resetTransaction}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              {isEntry ? <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-emerald-600" /> : <TrendingDown className="h-5 w-5 md:h-6 md:w-6 text-red-600" />}
              {isEntry ? "Entrada" : "Saída"}
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden md:block">
              {isEntry ? "Adicionar materiais ao almoxarifado" : "Registrar retirada manual de materiais"}
            </p>
          </div>

          <div className="flex bg-muted p-1 rounded-lg shrink-0">
             <Button size="sm" variant={isEntry ? "default" : "ghost"} className={isEntry ? "bg-emerald-600" : ""} onClick={() => { setViewMode("entry"); setCart([]); }}>Entrada</Button>
             <Button size="sm" variant={!isEntry ? "default" : "ghost"} className={!isEntry ? "bg-red-600" : ""} onClick={() => { setViewMode("exit"); setCart([]); }}>Saída</Button>
          </div>
        </div>
      </div>

      {/* GRID RESPONSIVO */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 flex-1">
        
        {/* COLUNA 1: PRODUTOS */}
        <Card className="lg:col-span-3 flex flex-col h-[400px] lg:h-[calc(100vh-10rem)] border-muted-foreground/20 shadow-sm overflow-hidden order-1">
          <CardHeader className="pb-3 bg-muted/10 shrink-0 p-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" /> Produtos
            </CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input 
                placeholder="Buscar..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-2 space-y-2">
            {/* AQUI TAMBÉM REMOVEMOS O ANY */}
            {filteredStocks.map((stock: StockItem) => {
               const available = (Number(stock.quantity_on_hand) || 0) - (Number(stock.quantity_reserved) || 0);
               return (
                <div 
                  key={stock.id} 
                  className="flex flex-col p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-all active:scale-95"
                  onClick={() => addToCart(stock)}
                >
                  <span className="font-medium text-sm whitespace-normal break-words leading-tight">{stock.products?.name}</span>
                  <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                    <span className="font-mono">{stock.products?.sku}</span>
                    <span className={isEntry ? "" : (available > 0 ? "text-emerald-600 font-bold" : "text-red-500 font-bold")}>
                      {isEntry ? stock.quantity_on_hand : available} {stock.products?.unit}
                    </span>
                  </div>
                </div>
               );
            })}
          </CardContent>
        </Card>

        {/* COLUNA 2: ITENS DA TRANSAÇÃO */}
        <div className="lg:col-span-6 flex flex-col h-auto lg:h-[calc(100vh-10rem)] gap-4 order-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              Carrinho <Badge variant="secondary">{cart.length} itens</Badge>
            </h3>
            
            {!isEntry && (
              <div className="w-full md:w-64">
                <Select value={destination} onValueChange={setDestination}>
                  <SelectTrigger className="h-10 border-red-200 bg-red-50/50">
                    <SelectValue placeholder="Selecione o Destino..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto pr-1 min-h-[200px]">
            {cart.length === 0 ? (
              <div className="h-full min-h-[200px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
                <Package className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">Toque nos produtos para adicionar</p>
              </div>
            ) : (
              cart.map((item: CartItem) => {
                const finalStock = isEntry 
                  ? Number(item.current_stock) + Number(item.quantity) 
                  : Number(item.current_stock) - Number(item.quantity);

                return (
                  <Card key={item.product_id} className={`overflow-hidden transition-all ${isEntry ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-red-500'}`}>
                    <div className="p-3 md:p-4 flex flex-col sm:flex-row items-start gap-3 md:gap-4">
                      <div className="flex items-start gap-3 w-full sm:w-auto flex-1">
                          <div className={`mt-1 h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${bgClass} ${themeClass}`}>
                            <Package className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1 pt-1">
                            <h4 className="font-bold text-sm leading-tight whitespace-normal break-words">{item.name}</h4>
                            <span className="text-xs text-muted-foreground font-mono mt-1 inline-block">{item.sku}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-1 text-muted-foreground hover:text-red-500 sm:hidden" onClick={() => removeFromCart(item.product_id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                      </div>

                      <div className="flex items-center justify-between w-full sm:w-auto gap-4 mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-muted/20 shrink-0">
                         <div className="text-center hidden sm:block">
                           <span className="text-[10px] text-muted-foreground block">Atual</span>
                           <span className="font-semibold text-sm">{item.current_stock}</span>
                         </div>
                         
                         <div className={`flex items-center gap-1 px-3 py-1 rounded-md ${bgClass} border ${borderClass} flex-1 sm:flex-none justify-center`}>
                           <span className={`text-sm font-bold ${themeClass} mr-1`}>{isEntry ? "+" : "-"}</span>
                           <Input 
                             type="number"
                             inputMode="decimal"
                             className={`h-8 w-20 text-center font-bold bg-transparent border-none focus-visible:ring-0 p-0 ${themeClass} text-lg`}
                             value={item.quantity}
                             onChange={(e) => updateQuantity(item.product_id, parseFloat(e.target.value) || 0)}
                           />
                         </div>

                         <div className="text-center hidden sm:block">
                           <span className="text-[10px] text-muted-foreground block">Novo</span>
                           <span className="font-bold text-sm">{finalStock}</span>
                         </div>

                         <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-500 hidden sm:inline-flex" onClick={() => removeFromCart(item.product_id)}>
                           <Trash2 className="h-4 w-4" />
                         </Button>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* COLUNA 3: RESUMO */}
        <Card className="lg:col-span-3 flex flex-col h-fit lg:sticky lg:top-4 border-muted-foreground/20 shadow-md order-3 mb-6 lg:mb-0">
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-base flex items-center gap-2">Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/30 p-2 rounded-lg text-center">
                <span className="text-xs text-muted-foreground block mb-1">Itens</span>
                <span className="text-xl font-bold">{cart.length}</span>
              </div>
              <div className={`p-2 rounded-lg text-center ${bgClass} border ${borderClass}`}>
                <span className={`text-xs block mb-1 ${themeClass}`}>Total Qtd.</span>
                <span className={`text-xl font-bold ${themeClass}`}>
                  {isEntry ? "+" : "-"}{cart.reduce((acc, item) => acc + item.quantity, 0)}
                </span>
              </div>
            </div>

            <div className={`p-3 rounded-md flex items-start gap-3 ${cart.length > 0 ? "bg-green-50 text-green-800" : "bg-muted text-muted-foreground"}`}>
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p className="text-xs leading-tight">
                {cart.length > 0 ? "Pronto para confirmar." : "Adicione itens..."}
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 p-4 pt-0">
            <Button 
              className={`w-full h-12 text-lg font-bold shadow-lg ${isEntry ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" : "bg-red-600 hover:bg-red-700 shadow-red-200"}`}
              onClick={handleConfirmTransaction}
              disabled={cart.length === 0 || isPending}
            >
              {isPending ? "Processando..." : (isEntry ? "Confirmar Entrada" : "Confirmar Saída")}
            </Button>
            <Button variant="ghost" className="w-full" onClick={resetTransaction}>
              Cancelar
            </Button>
          </CardFooter>
        </Card>

      </div>
    </div>
  );
}