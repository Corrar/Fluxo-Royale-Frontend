import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Separations() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [destination, setDestination] = useState("");
  const [items, setItems] = useState<Array<{ product_id: string; quantity: string }>>([
    { product_id: "", quantity: "" },
  ]);
  const [activeTab, setActiveTab] = useState<"pendente" | "concluida">("pendente");

  const { data: separations, isLoading } = useQuery({
    queryKey: ["separations"],
    queryFn: async () => {
      const response = await api.get("/separations");
      return response.data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const response = await api.get("/products");
      return response.data;
    },
  });

  const createSeparationMutation = useMutation({
    mutationFn: async (data: { destination: string; items: Array<{ product_id: string; quantity: number }> }) => {
      await api.post("/separations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["separations"] });
      queryClient.invalidateQueries({ queryKey: ["stocks"] });
      toast.success("Separação criada com sucesso!");
      setIsDialogOpen(false);
      setDestination("");
      setItems([{ product_id: "", quantity: "" }]);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Erro ao criar separação");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.put(`/separations/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["separations"] });
      queryClient.invalidateQueries({ queryKey: ["stocks"] });
      toast.success("Status atualizado com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar status");
    },
  });

  const handleAddItem = () => setItems([...items, { product_id: "", quantity: "" }]);
  const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  
  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter(item => item.product_id && item.quantity);
    if (validItems.length === 0) {
      toast.error("Adicione pelo menos um item");
      return;
    }
    createSeparationMutation.mutate({
      destination,
      items: validItems.map(item => ({
        product_id: item.product_id,
        quantity: parseFloat(item.quantity),
      })),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Separações</h1>
          <p className="text-muted-foreground">Gerencie a separação de materiais</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Separação</Button></DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova Separação</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="destination">Destino *</Label>
                <Input id="destination" value={destination} onChange={(e) => setDestination(e.target.value)} required placeholder="Ex: Setor de Manutenção" />
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Itens da Separação</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddItem}><Plus className="h-4 w-4 mr-2" />Adicionar Item</Button>
                </div>
                {items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-2">
                      <Select value={item.product_id} onValueChange={(value) => handleItemChange(index, "product_id", value)}>
                        <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                        <SelectContent>
                          {products?.map((product: any) => (
                            <SelectItem key={product.id} value={product.id}>{product.name} ({product.sku})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-32 space-y-2">
                      <Input type="number" step="0.01" placeholder="Qtd" value={item.quantity} onChange={(e) => handleItemChange(index, "quantity", e.target.value)} />
                    </div>
                    {items.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(index)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit">Criar Separação</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "pendente" | "concluida")}>
        <TabsList>
          <TabsTrigger value="pendente">Separações Ativas</TabsTrigger>
          <TabsTrigger value="concluida">Separações Enviadas</TabsTrigger>
        </TabsList>
        
        {["pendente", "concluida"].map((status) => (
          <TabsContent key={status} value={status}>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead>Status</TableHead>
                    {status === 'pendente' && <TableHead>Ação</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? <TableRow><TableCell colSpan={5} className="text-center">Carregando...</TableCell></TableRow> : 
                   separations?.filter((s: any) => s.status === status).length === 0 ? 
                   <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma separação encontrada</TableCell></TableRow> :
                   separations?.filter((s: any) => s.status === status).map((separation: any) => (
                    <TableRow key={separation.id}>
                      <TableCell>{format(new Date(separation.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell>{separation.destination}</TableCell>
                      <TableCell>
                        <ul className="text-sm space-y-1">
                          {separation.separation_items?.map((item: any) => (
                            <li key={item.id}>{item.quantity} {item.products?.unit} - {item.products?.name}</li>
                          ))}
                        </ul>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={separation.status === "pendente" ? "bg-yellow-100 text-yellow-800 border-yellow-300" : "bg-green-100 text-green-800 border-green-300"}>
                          {separation.status === "pendente" ? "Pendente" : "Concluída"}
                        </Badge>
                      </TableCell>
                      {status === 'pendente' && (
                        <TableCell>
                          <Select value={separation.status} onValueChange={(value) => updateStatusMutation.mutate({ id: separation.id, status: value })}>
                            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pendente">Pendente</SelectItem>
                              <SelectItem value="concluida">Concluir</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}