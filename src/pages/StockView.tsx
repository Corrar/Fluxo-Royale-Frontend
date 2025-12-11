import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Package, Box } from "lucide-react";

export default function StockView() {
  const [searchTerm, setSearchTerm] = useState("");

  // 1. BUSCAR ESTOQUE (Usamos a mesma rota que já existe)
  const { data: stocks, isLoading } = useQuery({
    queryKey: ["stocks"],
    queryFn: async () => {
      const response = await api.get("/stock");
      return response.data;
    },
  });

  // 2. FILTRAGEM INTELIGENTE
  const filteredStocks = useMemo(() => {
    if (!stocks) return [];
    if (!searchTerm) return stocks;

    const term = searchTerm.toLowerCase();
    return stocks.filter((stock: any) => {
      const productName = stock.products?.name?.toLowerCase() || "";
      const productSku = stock.products?.sku?.toLowerCase() || "";
      return productName.includes(term) || productSku.includes(term);
    });
  }, [stocks, searchTerm]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Consulta de Estoque</h1>
        <p className="text-muted-foreground">Verifique a disponibilidade de materiais no almoxarifado</p>
      </div>

      {/* Barra de Pesquisa */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome ou SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          autoFocus
        />
      </div>

      {/* Tabela de Estoque (Somente Leitura) */}
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Qtd. Disponível</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Box className="h-4 w-4 animate-bounce" /> Carregando estoque...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredStocks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                  {searchTerm ? "Nenhum produto encontrado com esse nome" : "Estoque vazio"}
                </TableCell>
              </TableRow>
            ) : (
              filteredStocks.map((stock: any) => {
                // Cálculo: Disponível = Em Mãos - Reservado
                const disponivel = Number(stock.quantity_on_hand) - Number(stock.quantity_reserved);
                const isAvailable = disponivel > 0;

                return (
                  <TableRow key={stock.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        {stock.products?.name}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {stock.products?.sku}
                    </TableCell>
                    <TableCell>{stock.products?.unit}</TableCell>
                    <TableCell>
                      <span className={`font-bold ${isAvailable ? "text-green-600" : "text-red-500"}`}>
                        {disponivel}
                      </span>
                    </TableCell>
                    <TableCell>
                      {isAvailable ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Disponível
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-100 text-gray-500 border-gray-200">
                          Esgotado
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}