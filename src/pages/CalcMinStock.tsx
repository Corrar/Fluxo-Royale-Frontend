import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Calculator, TrendingUp, Info, CalendarClock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

export default function CalcMinStock() {
  const [days, setDays] = useState([30]); // Valor padrão: 30 dias (array pois o Slider usa array)

  const calculateMutation = useMutation({
    mutationFn: async () => {
      // Envia o período selecionado para o backend
      const response = await api.post("/stock/calculate-min", { days: days[0] });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success("Sucesso", {
        description: data.message,
        duration: 5000,
      });
    },
    onError: (error: any) => {
      toast.error("Erro", {
        description: error.response?.data?.error || "Falha ao realizar o cálculo.",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Cálculo de Estoque Mínimo</h1>
        <p className="text-muted-foreground">
          Defina o período de análise e ajuste os níveis de segurança automaticamente.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-blue-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <Calculator className="h-5 w-5" />
              Parâmetros do Cálculo
            </CardTitle>
            <CardDescription>
              Escolha o intervalo de tempo histórico para calcular a média de consumo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Seletor de Período */}
            <div className="space-y-4 pt-2">
              <div className="flex justify-between items-center">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" /> Período de Análise
                </Label>
                <span className="text-2xl font-bold text-blue-600">{days[0]} dias</span>
              </div>
              
              <Slider
                value={days}
                onValueChange={setDays}
                min={7}
                max={365}
                step={1}
                className="py-4"
              />
              
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Mín: 1 semana (7d)</span>
                <span>Máx: 1 ano (365d)</span>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-md border border-blue-100 text-sm text-blue-800 flex gap-3">
              <Info className="h-5 w-5 shrink-0 mt-0.5" />
              <p>
                O sistema analisará todas as saídas dos últimos <strong>{days[0]} dias</strong>, 
                calculará a média diária e multiplicará por 7 (dias de segurança).
              </p>
            </div>

            <Button 
              size="lg" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 text-lg shadow-lg transition-all"
              onClick={() => calculateMutation.mutate()}
              disabled={calculateMutation.isPending}
            >
              {calculateMutation.isPending ? (
                <span className="flex items-center gap-2">Calculando...</span>
              ) : (
                "Calcular e Atualizar Agora"
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Entenda a Matemática
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="bg-slate-100 p-2 rounded-full font-bold w-8 h-8 flex items-center justify-center">1</div>
                <p className="text-sm text-muted-foreground pt-1">
                  Soma do consumo (saídas) no período de <strong>{days[0]} dias</strong>.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-slate-100 p-2 rounded-full font-bold w-8 h-8 flex items-center justify-center">2</div>
                <p className="text-sm text-muted-foreground pt-1">
                  Divisão pelo período selecionado ({days[0]}) para achar a <strong>Média Diária</strong>.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-slate-100 p-2 rounded-full font-bold w-8 h-8 flex items-center justify-center">3</div>
                <p className="text-sm text-muted-foreground pt-1">
                  Multiplicação por <strong>7 (Dias de Segurança)</strong> para cobrir imprevistos.
                </p>
              </div>
              
              <div className="mt-4 border-t pt-4">
                <p className="text-xs text-center text-muted-foreground italic">
                  Exemplo: Se em {days[0]} dias foram gastos {days[0] * 2} parafusos, a média é 2/dia. 
                  O novo mínimo será 14 (2 * 7).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}