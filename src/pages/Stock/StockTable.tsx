import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Settings2, Pencil, Lock } from "lucide-react";

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
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-[140px]" /></TableCell>
          <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
          <TableCell><Skeleton className="h-4 w-[40px]" /></TableCell>
          <TableCell><Skeleton className="h-4 w-[40px]" /></TableCell>
          <TableCell><Skeleton className="h-4 w-[40px]" /></TableCell>
          {canEditCost && <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>}
          {canViewSalesPrice && <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>}
          <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-8 w-[90px] ml-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  );

  return (
    <>
      {/* --- VIEW DESKTOP: TABELA --- */}
      <div className="hidden md:block border rounded-lg bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Físico</TableHead>
              <TableHead>Reservado</TableHead>
              <TableHead>Disponível</TableHead>
              {canEditCost && <TableHead>Custo (R$)</TableHead>}
              {canViewSalesPrice && <TableHead className="text-blue-600">Venda (R$)</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableSkeleton /> : paginatedStocks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                  Nenhum produto encontrado.
                </TableCell>
              </TableRow>
            ) : paginatedStocks.map((stock: StockItem) => {
              // Agora o TypeScript sabe que stock.quantity_on_hand é um número!
              const available = (Number(stock.quantity_on_hand) || 0) - (Number(stock.quantity_reserved) || 0);
              const isLow = stock.products?.min_stock && available < stock.products.min_stock;
              const isZero = Number(stock.quantity_on_hand) === 0;

              return (
                <TableRow key={stock.id}>
                  <TableCell className="font-medium">
                    {stock.products?.name}
                    {stock.products?.tags && stock.products.tags.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {stock.products.tags.map((t: string) => (
                          <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground">{t}</span>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{stock.products?.sku}</TableCell>
                  <TableCell>{stock.quantity_on_hand}</TableCell>
                  <TableCell className="text-amber-600 font-medium">{stock.quantity_reserved}</TableCell>
                  <TableCell className="font-bold">{available.toFixed(2)}</TableCell>
                  
                  {canEditCost && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{stock.products?.unit_price ? `R$ ${Number(stock.products.unit_price).toFixed(2)}` : "-"}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenCostPrice(stock)}>
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  )}

                  {canViewSalesPrice && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-blue-700">{stock.products?.sales_price ? `R$ ${Number(stock.products.sales_price).toFixed(2)}` : "-"}</span>
                        {canEditSalesPrice && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenSalesPrice(stock)}><Pencil className="h-3 w-3 text-muted-foreground" /></Button>}
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    {isZero ? (
                      <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100">Zerado</Badge>
                    ) : isLow ? (
                      <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200">Baixo</Badge>
                    ) : (
                      <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-200">OK</Badge>
                    )}
                  </TableCell>
                  
                  <TableCell className="text-right">
                    {canEditItem(stock) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Settings2 className="h-4 w-4 mr-2" /> Ações
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenAdjust(stock)}>
                            <Settings2 className="h-4 w-4 mr-2" /> Ajustar Físico
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenReserve(stock)}>
                            <Lock className="h-4 w-4 mr-2 text-amber-600" /> Gerenciar Reserva
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* --- VIEW MOBILE: CARDS --- */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
           Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-lg" />)
        ) : (
          paginatedStocks.map((stock: StockItem) => {
            const available = (Number(stock.quantity_on_hand) || 0) - (Number(stock.quantity_reserved) || 0);
            const isLow = stock.products?.min_stock && Number(stock.quantity_on_hand) < stock.products.min_stock;
            const isZero = Number(stock.quantity_on_hand) === 0;

            return (
              <Card key={stock.id} className={`shadow-sm ${isZero ? "border-l-4 border-l-red-500" : isLow ? "border-l-4 border-l-amber-500" : ""}`}>
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base font-bold line-clamp-2">{stock.products?.name}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono mt-1">{stock.products?.sku}</p>
                    </div>
                    {canEditItem(stock) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><Settings2 className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenAdjust(stock)}>Ajustar Físico</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenReserve(stock)}>Gerenciar Reserva</DropdownMenuItem>
                          {canEditCost && <DropdownMenuItem onClick={() => handleOpenCostPrice(stock)}>Alterar Custo</DropdownMenuItem>}
                          {canEditSalesPrice && <DropdownMenuItem onClick={() => handleOpenSalesPrice(stock)}>Alterar Preço Venda</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2 space-y-2 text-sm">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Físico:</span>
                    <span className="font-semibold">{stock.quantity_on_hand} {stock.products?.unit}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Reservado:</span>
                    <span className="text-amber-600 font-semibold">{stock.quantity_reserved} {stock.products?.unit}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Disponível:</span>
                    <span className={available > 0 ? "font-bold text-emerald-600" : "font-bold text-red-600"}>
                      {available.toFixed(2)}
                    </span>
                  </div>
                  {canViewSalesPrice && (
                    <div className="flex justify-between">
                       <span className="text-muted-foreground">Preço:</span>
                       <span className="font-bold text-blue-600">R$ {Number(stock.products?.sales_price || 0).toFixed(2)}</span>
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