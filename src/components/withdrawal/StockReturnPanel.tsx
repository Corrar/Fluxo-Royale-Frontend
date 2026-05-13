import { useState } from 'react';
import { api } from '@/services/api';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2, Undo2, FileText, Download } from "lucide-react";
import jsPDF from "jspdf";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Material {
  product_id: string;
  name: string;
  sku: string;
  total_withdrawn: string;
  total_returned: string;
  available_to_return: string;
}

type DevolucaoResumo = {
  op: string;
  data: string;
  totais: { produto: string; quantidade: number }[];
};

export const StockReturnPanel = () => {
  const [opCode, setOpCode] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estado para o Dialog do PDF
  const [resumo, setResumo] = useState<DevolucaoResumo | null>(null);

  const handleSearch = async () => {
    if (!opCode.trim()) return toast.error("Por favor, introduza o código da OP.");
    
    setIsLoading(true);
    try {
      const response = await api.get(`/stock/returns/op/${opCode.trim()}`);
      setMaterials(response.data);
      setReturnQuantities({});
      toast.success('Materiais localizados. Indique o que será devolvido.');
    } catch (error: any) {
      setMaterials([]);
      toast.error(error.response?.data?.message || 'OP não encontrada ou sem saldo para devolução.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuantityChange = (productId: string, value: string, maxLimit: number) => {
    const numValue = Number(value);
    if (numValue > maxLimit) {
        toast.warning(`Limite ultrapassado. O máximo disponível para devolução é ${maxLimit}.`);
        return;
    }
    setReturnQuantities(prev => ({ ...prev, [productId]: numValue }));
  };

  const handleSubmit = async () => {
    const itemsToReturn = Object.entries(returnQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, quantity]) => ({
        product_id: productId,
        quantity,
        observation: 'Devolvido via painel'
      }));

    if (itemsToReturn.length === 0) {
      return toast.warning('Indique pelo menos 1 quantidade para devolver.');
    }

    setIsSubmitting(true);
    try {
      // 1. Enviar para a Base de Dados
      await api.post('/stock/returns', { op_code: opCode.trim(), returns: itemsToReturn });
      toast.success('Devolução registada com sucesso e stock atualizado!');
      
      // 2. Preparar os dados para o Resumo / PDF
      const totais = itemsToReturn.map(item => {
         const mat = materials.find(m => m.product_id === item.product_id);
         return { produto: mat?.name || 'Desconhecido', quantidade: item.quantity };
      });

      setResumo({
        op: opCode.trim(),
        data: new Date().toLocaleString("pt-BR"),
        totais
      });

      // 3. Atualizar a listagem limpando os campos
      handleSearch();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao registar a devolução.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadPdf = () => {
    if (!resumo) return;
    const doc = new jsPDF();
    const totalGeral = resumo.totais.reduce((s, t) => s + t.quantidade, 0);

    doc.setFontSize(16);
    doc.text("Resumo de Devolucao", 14, 18);
    doc.setFontSize(10);
    doc.text(`Data: ${resumo.data}`, 14, 28);
    doc.text(`Ordem de Producao (OP): ${resumo.op}`, 14, 35);

    doc.setFontSize(12);
    doc.text("Materiais Devolvidos ao Armazem", 14, 52);
    doc.setFontSize(10);
    doc.line(14, 55, 196, 55);
    doc.text("Material", 14, 62);
    doc.text("Quantidade", 160, 62);
    doc.line(14, 65, 196, 65);

    let y = 72;
    resumo.totais.forEach((t) => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(String(t.produto).slice(0, 80), 14, y);
      doc.text(String(t.quantidade), 160, y);
      y += 7;
    });
    doc.line(14, y, 196, y);
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.text("Total de Pecas Devolvidas", 14, y);
    doc.text(String(totalGeral), 160, y);

    doc.save(`devolucao-${resumo.op}.pdf`);
  };

  return (
    <div className="space-y-6">
      
      {/* Zona de Busca da OP */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label className="mb-2 block text-muted-foreground">Ordem de Produção (OP)</Label>
          <div className="flex gap-2">
            <Input 
              placeholder="Ex: OP-1234" 
              value={opCode} 
              onChange={(e) => setOpCode(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="bg-background/50 focus:bg-background transition-colors"
            />
            <Button onClick={handleSearch} disabled={isLoading} variant="outline" className="shrink-0 bg-background/50">
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabela de Resultados (Lógica Real da BD) */}
      {materials.length > 0 && (
        <div className="space-y-4 animate-in fade-in duration-500">
          <Label className="mb-3 block text-base font-semibold">Materiais passíveis de devolução</Label>
          <div className="rounded-lg border bg-background/30 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-center">Levantado</TableHead>
                  <TableHead className="text-center">Disponível</TableHead>
                  <TableHead className="w-32 text-right pr-4">A Devolver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((mat) => {
                  const max = Number(mat.available_to_return);
                  return (
                    <TableRow key={mat.product_id}>
                      <TableCell className="font-medium">
                        {mat.name}
                        <div className="text-[10px] text-muted-foreground mt-0.5">{mat.sku || 'Sem SKU'}</div>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">{mat.total_withdrawn}</TableCell>
                      <TableCell className="text-center font-bold text-emerald-600 dark:text-emerald-400">{max}</TableCell>
                      <TableCell className="pr-4">
                        <Input 
                          type="number" 
                          min="0" 
                          max={max}
                          value={returnQuantities[mat.product_id] || ''}
                          onChange={(e) => handleQuantityChange(mat.product_id, e.target.value, max)}
                          className="w-full text-center bg-background focus:ring-[#facc15]"
                          placeholder="0"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          
          <Button onClick={handleSubmit} disabled={isSubmitting} size="lg" className="w-full bg-[#facc15] hover:bg-[#eab308] text-[#1e1b4b] font-bold text-base shadow-lg hover:shadow-xl transition-all">
            {isSubmitting ? <Loader2 className="size-5 mr-2 animate-spin" /> : <Undo2 className="size-5 mr-2" />}
            Confirmar e Abater Custos da OP
          </Button>
        </div>
      )}

      {/* Dialog de Resumo e Download de PDF (Igual ao happy-stock-in) */}
      <Dialog open={!!resumo} onOpenChange={(o) => !o && setResumo(null)}>
        <DialogContent className="max-w-2xl border-border/60 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileText className="size-5 text-[#facc15]" /> Resumo da Devolução Confirmada
            </DialogTitle>
            <DialogDescription>
              A devolução foi inserida no sistema. O custo destes itens foi abatido da {resumo?.op}.
            </DialogDescription>
          </DialogHeader>

          {resumo && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm p-4 bg-muted/20 rounded-lg">
                <div><div className="text-muted-foreground">Ordem de Produção</div><div className="font-bold text-base text-primary">{resumo.op}</div></div>
                <div><div className="text-muted-foreground">Data/Hora</div><div className="font-medium">{resumo.data}</div></div>
              </div>

              <div className="rounded-lg border bg-background/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material Devolvido</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumo.totais.map((t) => (
                      <TableRow key={t.produto}>
                        <TableCell>{t.produto}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-500">+{t.quantidade}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setResumo(null)}>Fechar</Button>
            <Button onClick={downloadPdf} className="bg-[#facc15] hover:bg-[#eab308] text-[#1e1b4b] font-bold">
              <Download className="size-4 mr-2" /> Baixar Comprovativo PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
