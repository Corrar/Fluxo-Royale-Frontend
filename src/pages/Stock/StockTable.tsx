import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings2, Pencil, Lock, PackageX, FileEdit } from "lucide-react";

// IMPORTAÇÃO DA NOSSA NOVA TIPAGEM
import { StockItem } from "@/types/stock";

interface StockTableProps {
  paginatedStocks: StockItem[];
  isLoading: boolean;
  canEditItem: (stock: StockItem) => boolean;
  canEditCost: boolean;
  canViewSalesPrice: boolean;
  canEditSalesPrice: boolean;
  handleOpenAdjust: (stock: StockItem) => void;
  handleOpenCostPrice: (stock: StockItem) => void;
  handleOpenSalesPrice: (stock: StockItem) => void;
  handleOpenReserve: (stock: StockItem) => void;
}

export function StockTable({
  paginatedStocks, isLoading, canEditItem, canEditCost, canViewSalesPrice, canEditSalesPrice, 
  handleOpenAdjust, handleOpenCostPrice, handleOpenSalesPrice, handleOpenReserve
}: StockTableProps) {

  const TableSkeleton = () => (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <TableRow key={i} className="border-b/50">
          <TableCell><Skeleton className="h-5 w-[180px] rounded-md" /></TableCell>
          <TableCell><Skeleton className="h-4 w-[90px] rounded-md" /></TableCell>
          <TableCell><Skeleton className="h-5 w-[50px] rounded-md" /></TableCell>
          <TableCell><Skeleton className="h-5 w-[50px] rounded-md" /></TableCell>
          <TableCell><Skeleton className="h-5 w-[60px] rounded-md" /></TableCell>
          {canEditCost && <TableCell><Skeleton className="h-5 w-[70px] rounded-md" /></TableCell>}
          {canViewSalesPrice && <TableCell><Skeleton className="h-5 w-[70px] rounded-md" /></TableCell>}
          <TableCell><Skeleton className="h-5 w-[80px] rounded-full" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-8 w-[140px] rounded-md ml-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  );

  return (
    <>
      {/* ========================================================= */}
      {/* VIEW DESKTOP: TABELA MINIMALISTA (CLEAN SAAS STYLE)       */}
      {/* ========================================================= */}
      <div className="hidden md:block border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#0f0f11] shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50 dark:bg-slate-900/20 border-b border-slate-200 dark:border-slate-800">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 h-10">Produto</TableHead>
              <TableHead className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 h-10">SKU</TableHead>
              <TableHead className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 h-10 text-right">Físico</TableHead>
              <TableHead className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 h-10 text-right">Reservas</TableHead>
              <TableHead className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 h-10 text-right">Livre</TableHead>
              {canEditCost && <TableHead className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 h-10 text-right">Custo</TableHead>}
              {canViewSalesPrice && <TableHead className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 h-10 text-right">Venda</TableHead>}
              <TableHead className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 h-10 pl-6">Estado</TableHead>
              <TableHead className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 h-10 text-right pr-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableSkeleton /> : paginatedStocks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <PackageX className="h-10 w-10 mb-3 opacity-20" />
                    <p className="text-sm">Nenhum produto encontrado.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedStocks.map((stock: StockItem) => {
              const available = (Number(stock.quantity_on_hand) || 0) - (Number(stock.quantity_reserved) || 0);
              const isLow = stock.products?.min_stock && available < stock.products.min_stock;
              const isZero = Number(stock.quantity_on_hand) === 0;

              return (
                <TableRow key={stock.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors border-b-slate-100 dark:border-b-slate-800/60">
                  
                  {/* Produto & Tags */}
                  <TableCell className="py-3 max-w-[250px]">
                    <div className="flex flex-col gap-1.5">
                      <span className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate" title={stock.products?.name}>
                        {stock.products?.name}
                      </span>
                      {stock.products?.tags && stock.products.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {stock.products.tags.slice(0, 2).map((t: string) => (
                            <span key={t} className="text-[10px] font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded">
                              {t}
                            </span>
                          ))}
                          {stock.products.tags.length > 2 && (
                            <span className="text-[10px] font-medium text-slate-400">+{stock.products.tags.length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  
                  {/* SKU */}
                  <TableCell className="py-3">
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{stock.products?.sku}</span>
                  </TableCell>
                  
                  {/* Físico */}
                  <TableCell className="py-3 text-right">
                    <span className="text-sm text-slate-700 dark:text-slate-300">{stock.quantity_on_hand}</span>
                  </TableCell>

                  {/* Reservado */}
                  <TableCell className="py-3 text-right">
                    <span className={`text-sm ${Number(stock.quantity_reserved) > 0 ? 'text-amber-600 dark:text-amber-500 font-medium' : 'text-slate-400'}`}>
                      {stock.quantity_reserved}
                    </span>
                  </TableCell>

                  {/* Livre */}
                  <TableCell className="py-3 text-right">
                    <span className={`text-sm font-semibold ${isZero ? 'text-red-600' : 'text-slate-900 dark:text-slate-100'}`}>
                      {available.toFixed(2)}
                    </span>
                  </TableCell>
                  
                  {/* Custos e Preços */}
                  {canEditCost && (
                    <TableCell className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 group/edit">
                        <span className="text-sm text-slate-600 dark:text-slate-300">
                          {stock.products?.unit_price ? `R$ ${Number(stock.products.unit_price).toFixed(2)}` : "-"}
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/edit:opacity-100 transition-opacity" onClick={() => handleOpenCostPrice(stock)}>
                          <Pencil className="h-3 w-3 text-slate-400 hover:text-slate-900 dark:hover:text-white" />
                        </Button>
                      </div>
                    </TableCell>
                  )}

                  {canViewSalesPrice && (
                    <TableCell className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 group/edit">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {stock.products?.sales_price ? `R$ ${Number(stock.products.sales_price).toFixed(2)}` : "-"}
                        </span>
                        {canEditSalesPrice && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/edit:opacity-100 transition-opacity" onClick={() => handleOpenSalesPrice(stock)}>
                            <Pencil className="h-3 w-3 text-slate-400 hover:text-slate-900 dark:hover:text-white" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}

                  {/* Estado (Status Dot Elegante) */}
                  <TableCell className="py-3 pl-6">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${isZero ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : isLow ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'}`} />
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {isZero ? 'Zerado' : isLow ? 'Baixo' : 'OK'}
                      </span>
                    </div>
                  </TableCell>
                  
                  {/* Ações (Botões Limpos Ghost) */}
                  <TableCell className="text-right py-3 pr-4">
                    {canEditItem(stock) && (
                      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800"
                          onClick={() => handleOpenAdjust(stock)}
                        >
                          <FileEdit className="h-3.5 w-3.5 mr-1.5" /> Físico
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800"
                          onClick={() => handleOpenReserve(stock)}
                        >
                          <Lock className="h-3.5 w-3.5 mr-1.5" /> Reservas
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* ========================================================= */}
      {/* VIEW MOBILE: CARDS MODERNOS COM DASHBOARD INTEGRADO       */}
      {/* ========================================================= */}
      <div className="md:hidden space-y-4">
        {isLoading ? (
           Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 w-full rounded-xl" />)
        ) : (
          paginatedStocks.map((stock: StockItem) => {
            const available = (Number(stock.quantity_on_hand) || 0) - (Number(stock.quantity_reserved) || 0);
            const isLow = stock.products?.min_stock && Number(stock.quantity_on_hand) < stock.products.min_stock;
            const isZero = Number(stock.quantity_on_hand) === 0;

            return (
              <Card key={stock.id} className="overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm rounded-xl bg-white dark:bg-[#111]">
                {/* Linha de Status Discreta no topo */}
                <div className={`h-1 w-full ${isZero ? 'bg-red-500' : isLow ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                
                <CardHeader className="p-4 pb-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <CardTitle className="text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100">
                        {stock.products?.name}
                      </CardTitle>
                      <p className="text-xs font-mono text-slate-400 mt-1">{stock.products?.sku}</p>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="p-4 pt-0">
                  {/* Dashboard de Valores (Clean) */}
                  <div className="grid grid-cols-3 gap-2 text-center text-sm mb-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Físico</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{stock.quantity_on_hand}</span>
                    </div>
                    <div className="flex flex-col items-center border-l border-r border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Reservado</span>
                      <span className={`font-medium ${Number(stock.quantity_reserved) > 0 ? 'text-amber-600' : 'text-slate-700 dark:text-slate-300'}`}>
                        {stock.quantity_reserved}
                      </span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Livre</span>
                      <span className={`font-semibold ${isZero ? 'text-red-600' : 'text-slate-900 dark:text-slate-100'}`}>
                        {available.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Preços (Se tiver permissão) */}
                  {(canEditCost || canViewSalesPrice) && (
                    <div className="flex justify-between items-center mb-4 px-1">
                      {canEditCost && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Custo:</span>
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">R$ {Number(stock.products?.unit_price || 0).toFixed(2)}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenCostPrice(stock)}><Pencil className="h-3 w-3 text-slate-400" /></Button>
                        </div>
                      )}
                      {canViewSalesPrice && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Venda:</span>
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">R$ {Number(stock.products?.sales_price || 0).toFixed(2)}</span>
                          {canEditSalesPrice && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenSalesPrice(stock)}><Pencil className="h-3 w-3 text-slate-400" /></Button>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Botões de Ação Mobile Modernos */}
                  {canEditItem(stock) && (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <Button 
                        variant="outline" 
                        className="w-full h-9 text-xs font-medium text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => handleOpenAdjust(stock)}
                      >
                        <FileEdit className="h-3.5 w-3.5 mr-2 text-slate-400" /> Físico
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full h-9 text-xs font-medium text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => handleOpenReserve(stock)}
                      >
                        <Lock className="h-3.5 w-3.5 mr-2 text-slate-400" /> Reservas
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </>
  );
}
