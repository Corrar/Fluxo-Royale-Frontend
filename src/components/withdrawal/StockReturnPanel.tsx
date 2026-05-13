import { useState } from 'react';
import { api } from '@/services/api';
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Undo2, Search, Loader2 } from "lucide-react";

interface Material {
  product_id: string;
  name: string;
  sku: string;
  total_withdrawn: string;
  total_returned: string;
  available_to_return: string;
}

export const StockReturnPanel = () => {
  const [opCode, setOpCode] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSearch = async () => {
    if (!opCode.trim()) return toast.error("Por favor, introduza o código da OP.");
    
    setIsLoading(true);
    try {
      const response = await api.get(`/stock/returns/op/${opCode.trim()}`);
      setMaterials(response.data);
      setReturnQuantities({});
      toast.success('Materiais carregados com sucesso.');
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
        toast.warning('A quantidade não pode ser maior do que o que foi levantado.');
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
      await api.post('/stock/returns', { op_code: opCode.trim(), returns: itemsToReturn });
      toast.success('Devolução registada com sucesso! O stock foi atualizado.');
      handleSearch();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao registar a devolução.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="p-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400">
          <Undo2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Devolução de Materiais de OP</h2>
          <p className="text-sm text-muted-foreground">
            Devolva materiais que sobraram de uma Ordem de Produção ao stock.
          </p>
        </div>
      </div>
      
      <div className="flex gap-4 mb-6">
        <Input 
          placeholder="Código da OP (Ex: OP-1234)" 
          value={opCode} 
          onChange={(e) => setOpCode(e.target.value)} 
          className="max-w-xs"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
          Procurar Origem
        </Button>
      </div>

      {materials.length > 0 && (
        <div className="space-y-4 border rounded-lg p-4 bg-muted/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-center">Levantado</TableHead>
                <TableHead className="text-center">Disponível</TableHead>
                <TableHead className="w-32">A Devolver</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((mat) => {
                const max = Number(mat.available_to_return);
                return (
                  <TableRow key={mat.product_id}>
                    <TableCell className="font-medium">{mat.name}</TableCell>
                    <TableCell>{mat.sku || '-'}</TableCell>
                    <TableCell className="text-center">{mat.total_withdrawn}</TableCell>
                    <TableCell className="text-center font-bold text-green-600">{max}</TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        min="0" 
                        max={max}
                        value={returnQuantities[mat.product_id] || ''}
                        onChange={(e) => handleQuantityChange(mat.product_id, e.target.value, max)}
                        className="w-full text-center"
                        placeholder="0"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          <div className="flex justify-end pt-4">
            <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700 text-white">
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Undo2 className="w-4 h-4 mr-2" />}
              Efetivar Devolução
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
