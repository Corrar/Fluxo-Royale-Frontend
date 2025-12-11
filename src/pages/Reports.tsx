import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Download, FileSpreadsheet, CalendarRange, Info } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";

export default function Reports() {
  // Definir datas padrão (Mês atual)
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  // 1. BUSCAR DATAS DISPONÍVEIS
  const { data: availableDates } = useQuery({
    queryKey: ["available-dates"],
    queryFn: async () => {
      const response = await api.get("/reports/available-dates");
      return response.data;
    },
  });

  // 2. GERAR RELATÓRIO
  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get("/reports/general", {
        params: { startDate, endDate }
      });
      return response.data;
    },
    onSuccess: (data) => {
      const wb = XLSX.utils.book_new();

      // Abas detalhadas
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.entradas || []), "Entradas");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.saidas_separacoes || []), "Saídas - Manuais");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.saidas_solicitacoes || []), "Saídas - Solicitações");

      // Aba Consolidada Power BI
      const basePowerBI = [
        ...(data.entradas || []).map((item: any) => ({
          Data: new Date(item.data).toLocaleDateString('pt-BR'),
          Produto: item.produto,
          SKU: item.sku || 'N/A',
          Quantidade: Number(item.quantidade),
          Destino: 'Estoque',
          Tipo_Movimento: 'Entrada',
          Origem: item.origem
        })),
        ...(data.saidas_separacoes || []).map((item: any) => ({
          Data: new Date(item.data).toLocaleDateString('pt-BR'),
          Produto: item.produto,
          SKU: item.sku || 'N/A',
          Quantidade: Number(item.quantidade) * -1, // Saída negativa para saldo
          Destino: item.destino_setor,
          Tipo_Movimento: 'Saída',
          Origem: 'Estoque'
        })),
        ...(data.saidas_solicitacoes || []).map((item: any) => ({
          Data: new Date(item.data).toLocaleDateString('pt-BR'),
          Produto: item.produto,
          SKU: item.sku || 'N/A',
          Quantidade: Number(item.quantidade) * -1,
          Destino: item.destino_setor,
          Tipo_Movimento: 'Saída',
          Origem: 'Estoque'
        }))
      ];

      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(basePowerBI), "Base_Dados_PowerBI");

      XLSX.writeFile(wb, `Relatorio_Geral_${startDate}_a_${endDate}.xlsx`);
      toast.success("Relatório gerado com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao gerar relatório. Verifique a conexão.");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Relatórios Gerenciais</h1>
        <p className="text-muted-foreground">Exporte movimentações por período personalizado.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="border rounded-lg p-6 bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-6">
            <FileSpreadsheet className="h-5 w-5" />
            <span className="font-medium">Configurar Intervalo</span>
          </div>

          <div className="space-y-4">
            
            {/* Aviso de Datas Disponíveis */}
            {availableDates?.min_date && (
              <div className="bg-blue-50 text-blue-700 p-3 rounded-md flex gap-2 text-sm items-start">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Dados Disponíveis no Sistema:</p>
                  <p>
                    De <strong>{format(new Date(availableDates.min_date), "dd/MM/yyyy")}</strong> até <strong>{format(new Date(availableDates.max_date || new Date()), "dd/MM/yyyy")}</strong>
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <div className="relative">
                  <CalendarRange className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Data Final</Label>
                <div className="relative">
                  <CalendarRange className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <Button 
              onClick={() => generateMutation.mutate()} 
              disabled={generateMutation.isPending} 
              className="w-full bg-green-600 hover:bg-green-700 text-white mt-4"
            >
              <Download className="h-4 w-4 mr-2" />
              {generateMutation.isPending ? "Gerando..." : "Baixar Relatório Excel"}
            </Button>
          </div>
        </div>

        <div className="border rounded-lg p-6 bg-muted/30 flex flex-col justify-center items-center text-center space-y-4">
          <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Relatório Completo</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
              O arquivo inclui abas detalhadas de Entradas e Saídas, além de uma aba consolidada ("Base_Dados_PowerBI") com sinais positivos (entrada) e negativos (saída) para cálculo de saldo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}