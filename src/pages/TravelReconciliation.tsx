import { useState } from "react";
import * as XLSX from 'xlsx';
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  AlertTriangle, 
  ArrowLeft, 
  Upload, 
  FileSpreadsheet, 
  Plus, 
  Trash2,
  ArrowRightLeft
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// Definição do tipo de item
interface TravelItem {
  sku: string;
  name: string;
  quantity: number;
  unit: string; // Novo campo
}

interface ComparisonResult extends TravelItem {
  returnedQuantity: number;
  status: 'ok' | 'missing' | 'extra';
  difference: number;
}

export default function TravelReconciliation() {
  const navigate = useNavigate();

  // Estados de Dados (Listas)
  const [outboundList, setOutboundList] = useState<TravelItem[]>([]);
  const [inboundList, setInboundList] = useState<TravelItem[]>([]);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult[]>([]);
  
  // Estados para Itens Manuais (Inputs) - Agora com 'unit'
  const [manualOutbound, setManualOutbound] = useState({ sku: "", name: "", quantity: "", unit: "" });
  const [manualInbound, setManualInbound] = useState({ sku: "", name: "", quantity: "", unit: "" });

  // --- 1. BUSCAR PRODUTOS (Para Auto-Complete) ---
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await api.get("/products")).data,
    staleTime: 1000 * 60 * 10,
  });

  const findProduct = (sku: string) => products.find((p: any) => p.sku === sku);

  // --- HANDLER INTELIGENTE DE SKU (Auto-Preencher Nome e Unidade) ---
  const handleSkuChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'outbound' | 'inbound') => {
    const newSku = e.target.value;
    const setInput = type === 'outbound' ? setManualOutbound : setManualInbound;
    const currentInput = type === 'outbound' ? manualOutbound : manualInbound;

    // Atualiza o SKU
    const updatedInput = { ...currentInput, sku: newSku };
    
    // Tenta achar o produto para auto-preencher
    const found = findProduct(newSku);
    if (found) {
      updatedInput.name = found.name;
      updatedInput.unit = found.unit || "un"; // Preenche unidade
    }

    setInput(updatedInput);
  };

  // --- LEITURA DE EXCEL (Melhorada para ler unidade) ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'outbound' | 'inbound') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      const formattedData: TravelItem[] = data.map((row: any) => ({
        sku: String(row['sku'] || row['SKU'] || row['Codigo'] || row['Código'] || row['id'] || "Unknown"),
        name: String(row['name'] || row['Nome'] || row['Produto'] || row['Descricao'] || "Item sem nome"),
        quantity: Number(row['quantity'] || row['qtd'] || row['Qtd'] || row['Quantidade'] || 0),
        unit: String(row['unit'] || row['unidade'] || row['un'] || row['medida'] || "un") // Tenta ler unidade
      })).filter(item => item.quantity > 0);

      if (type === 'outbound') {
        setOutboundList(formattedData);
        toast.success(`${formattedData.length} itens carregados na Saída.`);
      } else {
        setInboundList(formattedData);
        toast.success(`${formattedData.length} itens carregados no Retorno.`);
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- ADICIONAR ITEM MANUAL ---
  const addManualItem = (type: 'outbound' | 'inbound') => {
    const itemData = type === 'outbound' ? manualOutbound : manualInbound;
    const setList = type === 'outbound' ? setOutboundList : setInboundList;
    const setInput = type === 'outbound' ? setManualOutbound : setManualInbound;

    if (!itemData.sku || !itemData.quantity) {
      toast.warning("Preencha SKU e Quantidade");
      return;
    }

    const isRegistered = findProduct(itemData.sku);
    if (!isRegistered) {
      toast.warning(`Aviso: SKU "${itemData.sku}" não encontrado!`, {
        description: "Adicionado manualmente. Verifique o código.",
        duration: 4000,
      });
    }

    const newItem: TravelItem = {
      sku: itemData.sku,
      name: itemData.name || "Item Manual",
      quantity: parseFloat(itemData.quantity),
      unit: itemData.unit || "un"
    };

    setList(prev => {
      const existing = prev.find(i => i.sku === newItem.sku);
      if (existing) {
        // Soma quantidade se já existir na lista temporária
        return prev.map(i => i.sku === newItem.sku ? { ...i, quantity: i.quantity + newItem.quantity } : i);
      }
      return [...prev, newItem];
    });

    setInput({ sku: "", name: "", quantity: "", unit: "" }); // Limpar inputs
  };

  // --- REMOVER ITEM ---
  const removeItem = (sku: string, type: 'outbound' | 'inbound') => {
    const setList = type === 'outbound' ? setOutboundList : setInboundList;
    setList(prev => prev.filter(i => i.sku !== sku));
  };

  // --- LÓGICA DE CONFRONTO ---
  const handleCompare = () => {
    if (outboundList.length === 0) {
      toast.error("A lista de SAÍDA está vazia.");
      return;
    }

    const results: ComparisonResult[] = [];
    const inboundMap = new Map(inboundList.map(i => [i.sku, i.quantity]));

    // 1. Verifica itens que saíram
    outboundList.forEach(outItem => {
      const returnedQty = inboundMap.get(outItem.sku) || 0;
      const diff = returnedQty - outItem.quantity;
      
      let status: 'ok' | 'missing' | 'extra' = 'ok';
      if (diff < 0) status = 'missing';
      if (diff > 0) status = 'extra';

      results.push({
        ...outItem,
        returnedQuantity: returnedQty,
        difference: diff,
        status
      });

      inboundMap.delete(outItem.sku);
    });

    // 2. Verifica itens que voltaram mas não saíram
    inboundList.forEach(inItem => {
      if (inboundMap.has(inItem.sku)) {
        results.push({
          sku: inItem.sku,
          name: inItem.name,
          quantity: 0,
          unit: inItem.unit,
          returnedQuantity: inItem.quantity,
          difference: inItem.quantity,
          status: 'extra'
        });
      }
    });

    setComparisonResult(results);
    toast.success("Confronto realizado com sucesso!");
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/")}><ArrowLeft className="mr-2 h-4 w-4"/> Voltar</Button>
        <div>
          <h1 className="text-3xl font-bold">Confronto de Viagem</h1>
          <p className="text-muted-foreground">Compare o material enviado com o retorno físico.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* --- COLUNA 1: SAÍDA (Ida) --- */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-500" /> 
              Lista de Saída (Ida)
            </CardTitle>
            <CardDescription>O que foi levado para a viagem?</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">Upload Excel</TabsTrigger>
                <TabsTrigger value="manual">Lista Manual</TabsTrigger>
              </TabsList>

              {/* TAB UPLOAD (SAÍDA) */}
              <TabsContent value="upload" className="space-y-4 mt-4">
                <div className="bg-muted p-4 rounded-lg border border-dashed text-center">
                  <Label htmlFor="outbound-file" className="cursor-pointer block">
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm font-medium">Carregar Planilha de Saída</span>
                      <span className="text-xs text-muted-foreground">Colunas: SKU, Nome, Qtd, Unidade</span>
                    </div>
                  </Label>
                  <Input id="outbound-file" type="file" accept=".xlsx, .xls" className="hidden" onChange={(e) => handleFileUpload(e, 'outbound')} />
                </div>
              </TabsContent>

              {/* TAB MANUAL (SAÍDA) - COM CAMPO UNIDADE */}
              <TabsContent value="manual" className="space-y-4 mt-4">
                <div className="flex gap-2 items-end">
                  <div className="grid gap-1 w-24">
                    <Label>SKU</Label>
                    <Input placeholder="Cód." value={manualOutbound.sku} onChange={(e) => handleSkuChange(e, 'outbound')} />
                  </div>
                  <div className="grid gap-1 flex-1">
                    <Label>Produto</Label>
                    <Input placeholder="Nome" value={manualOutbound.name} onChange={e => setManualOutbound({...manualOutbound, name: e.target.value})} />
                  </div>
                  <div className="grid gap-1 w-20">
                    <Label>Un.</Label>
                    <Input placeholder="un" value={manualOutbound.unit} onChange={e => setManualOutbound({...manualOutbound, unit: e.target.value})} />
                  </div>
                  <div className="grid gap-1 w-20">
                    <Label>Qtd.</Label>
                    <Input type="number" placeholder="0" value={manualOutbound.quantity} onChange={e => setManualOutbound({...manualOutbound, quantity: e.target.value})} />
                  </div>
                  <Button onClick={() => addManualItem('outbound')} className="bg-blue-600 hover:bg-blue-700"><Plus className="h-4 w-4" /></Button>
                </div>
              </TabsContent>

              {/* LISTA DE SAÍDA */}
              {outboundList.length > 0 && (
                <div className="rounded-md border h-64 overflow-hidden mt-4">
                  <ScrollArea className="h-full">
                    <Table>
                      <TableHeader className="bg-muted sticky top-0">
                        <TableRow>
                          <TableHead>Item (Saída)</TableHead>
                          <TableHead className="text-right">Qtd.</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {outboundList.map((item, idx) => (
                          <TableRow key={`${item.sku}-${idx}`}>
                            <TableCell>
                              <div className="font-medium text-xs">{item.name}</div>
                              <div className="text-[10px] text-muted-foreground">{item.sku}</div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-blue-600">
                              {item.quantity} <span className="text-xs text-gray-400 font-normal">{item.unit}</span>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => removeItem(item.sku, 'outbound')} className="h-6 w-6">
                                <Trash2 className="h-3 w-3 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </Tabs>
          </CardContent>
        </Card>

        {/* --- COLUNA 2: RETORNO (Volta) --- */}
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-orange-500" /> 
              Lista de Retorno (Volta)
            </CardTitle>
            <CardDescription>O que voltou fisicamente?</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">Upload Excel</TabsTrigger>
                <TabsTrigger value="manual">Lista Manual</TabsTrigger>
              </TabsList>
              
              {/* TAB UPLOAD (RETORNO) */}
              <TabsContent value="upload" className="space-y-4 mt-4">
                <div className="bg-muted p-4 rounded-lg border border-dashed text-center">
                  <Label htmlFor="inbound-file" className="cursor-pointer block">
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm font-medium">Carregar Planilha de Retorno</span>
                    </div>
                  </Label>
                  <Input id="inbound-file" type="file" accept=".xlsx, .xls" className="hidden" onChange={(e) => handleFileUpload(e, 'inbound')} />
                </div>
              </TabsContent>

              {/* TAB MANUAL (RETORNO) - COM CAMPO UNIDADE */}
              <TabsContent value="manual" className="space-y-4 mt-4">
                <div className="flex gap-2 items-end">
                  <div className="grid gap-1 w-24">
                    <Label>SKU</Label>
                    <Input placeholder="Cód." value={manualInbound.sku} onChange={(e) => handleSkuChange(e, 'inbound')} />
                  </div>
                  <div className="grid gap-1 flex-1">
                    <Label>Produto</Label>
                    <Input placeholder="Nome" value={manualInbound.name} onChange={e => setManualInbound({...manualInbound, name: e.target.value})} />
                  </div>
                  <div className="grid gap-1 w-20">
                    <Label>Un.</Label>
                    <Input placeholder="un" value={manualInbound.unit} onChange={e => setManualInbound({...manualInbound, unit: e.target.value})} />
                  </div>
                  <div className="grid gap-1 w-20">
                    <Label>Qtd.</Label>
                    <Input type="number" placeholder="0" value={manualInbound.quantity} onChange={e => setManualInbound({...manualInbound, quantity: e.target.value})} />
                  </div>
                  <Button onClick={() => addManualItem('inbound')} className="bg-orange-600 hover:bg-orange-700"><Plus className="h-4 w-4" /></Button>
                </div>
              </TabsContent>

              {/* LISTA DE RETORNO */}
              {inboundList.length > 0 && (
                <div className="rounded-md border h-64 overflow-hidden mt-4">
                  <ScrollArea className="h-full">
                    <Table>
                      <TableHeader className="bg-muted sticky top-0">
                        <TableRow>
                          <TableHead>Item (Volta)</TableHead>
                          <TableHead className="text-right">Qtd.</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inboundList.map((item, idx) => (
                          <TableRow key={`${item.sku}-${idx}`}>
                            <TableCell>
                              <div className="font-medium text-xs">{item.name}</div>
                              <div className="text-[10px] text-muted-foreground">{item.sku}</div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-orange-600">
                              {item.quantity} <span className="text-xs text-gray-400 font-normal">{item.unit}</span>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => removeItem(item.sku, 'inbound')} className="h-6 w-6">
                                <Trash2 className="h-3 w-3 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button size="lg" onClick={handleCompare} className="w-full md:w-1/3 text-lg font-bold bg-slate-800 hover:bg-slate-900 shadow-xl">
          REALIZAR CONFRONTO
        </Button>
      </div>

      {/* --- RESULTADO DO CONFRONTO --- */}
      {comparisonResult.length > 0 && (
        <Card className="animate-in slide-in-from-bottom-10 fade-in duration-500">
          <CardHeader>
            <CardTitle>Resultado da Análise</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Qtd. Saída</TableHead>
                  <TableHead className="text-center">Qtd. Volta</TableHead>
                  <TableHead className="text-center">Diferença</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonResult.map((res) => (
                  <TableRow key={res.sku} className={res.status === 'missing' ? 'bg-red-50/50 dark:bg-red-900/10' : ''}>
                    <TableCell className="font-mono">{res.sku}</TableCell>
                    <TableCell>
                      {res.name}
                      <div className="text-[10px] text-muted-foreground">{res.unit}</div>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">{res.quantity}</TableCell>
                    <TableCell className="text-center font-bold">{res.returnedQuantity}</TableCell>
                    <TableCell className="text-center">
                      <span className={res.difference < 0 ? "text-red-500 font-bold" : res.difference > 0 ? "text-blue-500 font-bold" : "text-gray-400"}>
                        {res.difference > 0 ? `+${res.difference}` : res.difference}
                      </span>
                    </TableCell>
                    <TableCell>
                      {res.status === 'ok' && <Badge className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1"/> OK</Badge>}
                      {res.status === 'missing' && <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1"/> Falta</Badge>}
                      {res.status === 'extra' && <Badge className="bg-blue-600">Sobrou</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
               <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                 <CheckCircle2 className="h-4 w-4 text-green-600" />
                 <AlertTitle>Itens Corretos</AlertTitle>
                 <AlertDescription className="text-2xl font-bold text-green-700">
                   {comparisonResult.filter(r => r.status === 'ok').length}
                 </AlertDescription>
               </Alert>
               <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
                 <AlertTriangle className="h-4 w-4 text-red-600" />
                 <AlertTitle>Itens Faltantes</AlertTitle>
                 <AlertDescription className="text-2xl font-bold text-red-700">
                   {comparisonResult.filter(r => r.status === 'missing').length}
                 </AlertDescription>
               </Alert>
               <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                 <Plus className="h-4 w-4 text-blue-600" />
                 <AlertTitle>Itens Sobrantes</AlertTitle>
                 <AlertDescription className="text-2xl font-bold text-blue-700">
                   {comparisonResult.filter(r => r.status === 'extra').length}
                 </AlertDescription>
               </Alert>
            </div>

          </CardContent>
        </Card>
      )}
    </div>
  );
}