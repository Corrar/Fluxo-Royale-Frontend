import { useState, useMemo, useEffect } from "react";
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// Importação atualizada para incluir o deleteTravel
import { api, deleteTravel } from "@/services/api"; 
import { useSocket } from "@/contexts/SocketContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  AlertTriangle, ArrowLeft, FileSpreadsheet, Plus, Trash2,
  FileText, Download, MapPin, Users, Search, Minus, Package, PackageSearch,
  CheckCircle2, Clock, Car, ChevronRight, HardHat, CalendarDays, MoreVertical,
  DollarSign, Upload, ArrowRightLeft, Edit, Trash, ShoppingCart,
  Receipt, ArrowDownRight, ArrowUpLeft
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { exportToExcel } from "@/utils/exportUtils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { cn } from "@/lib/utils";

// --- TIPAGENS ---
interface Product { 
  id: string; 
  sku: string; 
  name: string; 
  unit: string; 
  stock?: {
    quantity_on_hand: number;
    quantity_reserved: number;
  };
  [key: string]: any; 
}

interface TravelItemInput {
  product_id: string; 
  sku: string; 
  name: string; 
  quantity: number | string; 
  unit: string; 
  available_stock: number; 
  price: number; 
}

interface TravelOrderItem {
  [key: string]: any; 
}

interface TravelOrder {
  id: string; 
  technicians: string; 
  city: string; 
  status: 'pending' | 'reconciled' | 'awaiting_stock';
  created_at: string; 
  updated_at: string; 
  items: TravelOrderItem[];
}

type ViewMode = 'list' | 'new' | 'edit' | 'reconcile' | 'view';

// --- SUPER EXTRATORES ---
const parseSafeNumber = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  
  let str = String(val).trim().replace(/[R$\s]/g, '');
  const commaIndex = str.lastIndexOf(',');
  const dotIndex = str.lastIndexOf('.');
  if (commaIndex > dotIndex) {
      str = str.replace(/\./g, '').replace(',', '.'); 
  } else if (dotIndex > commaIndex && commaIndex !== -1) {
      str = str.replace(/,/g, ''); 
  }
  
  const cleanStr = str.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleanStr);
  return isNaN(parsed) ? 0 : parsed;
};

const extractValidPrice = (...args: any[]): number => {
    const props = ['sales_price', 'selling_price', 'unit_price', 'cost_price', 'preco', 'preco_unitario', 'price', 'valor'];
    for (const obj of args) {
        if (!obj) continue;
        if (typeof obj === 'number' || typeof obj === 'string') {
            const num = parseSafeNumber(obj);
            if (num > 0) return num;
        }
        if (typeof obj === 'object') {
            for (const prop of props) {
                if (obj[prop] !== undefined && obj[prop] !== null) {
                    const num = parseSafeNumber(obj[prop]);
                    if (num > 0) return num;
                }
            }
        }
    }
    return 0;
};

const extractQtyOut = (item: any): number => {
    if (!item) return 0;
    const props = ['quantity_out', 'quantity', 'quantidade', 'quantidade_out', 'qtd'];
    for (const prop of props) {
        if (item[prop] !== undefined && item[prop] !== null && item[prop] !== '') {
            return parseSafeNumber(item[prop]);
        }
    }
    return 0;
};

const extractQtyRet = (item: any): number => {
    if (!item) return 0;
    const props = ['quantity_returned', 'returnedQuantity', 'returned_quantity', 'quantidade_retornada', 'quantidade_voltou'];
    for (const prop of props) {
        if (item[prop] !== undefined && item[prop] !== null && item[prop] !== '') {
            return parseSafeNumber(item[prop]);
        }
    }
    return 0;
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
};

const getAvailableStock = (product?: Product) => {
  if (!product || !product.stock) return 0;
  return Math.max(0, Number(product.stock.quantity_on_hand) - Number(product.stock.quantity_reserved));
};

export default function TravelReconciliation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedOrder, setSelectedOrder] = useState<TravelOrder | null>(null);

  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

  // Estado para guardar o espelho do acerto após o sucesso
  const [reconciliationSummary, setReconciliationSummary] = useState<{
      orderId: string;
      technicians: string;
      items: any[];
  } | null>(null);

  const [technicians, setTechnicians] = useState("");
  const [city, setCity] = useState("");
  const [outboundList, setOutboundList] = useState<TravelItemInput[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [reconcileItems, setReconcileItems] = useState<any[]>([]);

  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | "pending" | "reconciled" | "awaiting_stock">("all");

  const { data: products = [], refetch: refetchProducts } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => (await api.get("/products")).data,
    staleTime: 1000 * 15,
  });

  const productsDictionary = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => {
        map.set(String(p.sku), p);
        map.set(String(p.id), p);
    });
    return map;
  }, [products]);

  const getEffectiveAvailableStock = (product?: Product) => {
    if (!product || !product.stock) return 0;
    let available = Math.max(0, Number(product.stock.quantity_on_hand) - Number(product.stock.quantity_reserved));
    
    if (viewMode === 'edit' && selectedOrder) {
      const originalItem = selectedOrder.items.find((i: any) => 
         String(i.product_id) === String(product.id) || String(i.produto_id) === String(product.id) || String(i.sku) === String(product.sku)
      );
      if (originalItem) {
        available += extractQtyOut(originalItem);
      }
    }
    return available;
  };

  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    const lower = searchTerm.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(lower) ||
      p.sku.toLowerCase().includes(lower)
    ).slice(0, 5); 
  }, [searchTerm, products]);

  const { data: travelOrders = [], isLoading: isLoadingOrders } = useQuery<TravelOrder[]>({
    queryKey: ["travel-orders"],
    queryFn: async () => (await api.get("/travel-orders")).data,
  });

  const filteredOrders = useMemo(() => {
    return travelOrders.filter((order) => {
      const searchLower = orderSearchTerm.toLowerCase();
      const matchesSearch = 
        order.city.toLowerCase().includes(searchLower) || 
        order.technicians.toLowerCase().includes(searchLower);
      
      const matchesStatus = orderStatusFilter === "all" || order.status === orderStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [travelOrders, orderSearchTerm, orderStatusFilter]);

  const stats = useMemo(() => {
    const total = travelOrders.length;
    const pending = travelOrders.filter(t => t.status === 'pending').length;
    const reconciled = travelOrders.filter(t => t.status === 'reconciled').length;
    const awaiting_stock = travelOrders.filter(t => t.status === 'awaiting_stock').length;
    return { total, pending, reconciled, awaiting_stock };
  }, [travelOrders]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["travel-orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] }); 
    };
    socket.on("travel_orders_update", handleUpdate);
    socket.on("stock_update", handleUpdate); 
    return () => { 
      socket.off("travel_orders_update", handleUpdate); 
      socket.off("stock_update", handleUpdate);
    };
  }, [socket, queryClient]);

  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => await api.post('/travel-orders', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["travel-orders"] });
      toast.success("Pronto! Viagem registada. 🚗");
      resetNewTripForm();
      setViewMode('list');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Ops! Ocorreu um erro ao registar.")
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => await api.put(`/travel-orders/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["travel-orders"] });
      toast.success("Viagem atualizada com sucesso! ✏️");
      resetNewTripForm();
      setViewMode('list');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Ops! Ocorreu um erro ao editar.")
  });

  // --- NOVA INTEGRAÇÃO ---
  // Utilizamos a função do serviço (deleteTravel) e passamos o ID
  const deleteOrderMutation = useMutation({
    mutationFn: async (id: string) => await deleteTravel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["travel-orders"] });
      toast.success("Viagem excluída. O estoque foi corrigido. 🗑️");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Erro ao excluir viagem.")
  });

  const reconcileOrderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => await api.post(`/travel-orders/${id}/reconcile`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["travel-orders"] });
      
      if (selectedOrder) {
          const summaryItems = selectedOrder.items.map((item: any) => {
              const returnedItem = variables.data.returnedItems.find((r: any) => String(r.product_id) === String(item.product_id));
              const returnedQty = returnedItem ? Number(returnedItem.returnedQuantity) : 0;
              const consumedQty = Number(extractQtyOut(item)) - returnedQty;

              return {
                  ...item,
                  returnedQty,
                  consumedQty,
                  quantity_out: extractQtyOut(item)
              };
          });

          setReconciliationSummary({
              orderId: selectedOrder.id.toString(),
              technicians: selectedOrder.technicians,
              items: summaryItems
          });
      }

      toast.success("Acerto concluído! Estoque perfeitamente atualizado. ✅");
      setViewMode('list');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Erro ao tentar fazer o acerto.")
  });

  const resetNewTripForm = () => {
    setTechnicians(""); setCity(""); setOutboundList([]); setSearchTerm(""); setSelectedOrder(null);
  };

  const handleAddFromSearch = (product: Product) => {
    setOutboundList(prev => {
      const existing = prev.find(i => String(i.product_id) === String(product.id));
      const currentQty = existing ? Number(existing.quantity) : 0;
      const available = getEffectiveAvailableStock(product);
      const price = extractValidPrice(product);

      if (currentQty + 1 > available && viewMode === 'new') {
        toast.warning(`Atenção: Adicionado sem estoque (${available} disp.). Gerará pendência de compra.`);
      }

      if (existing) {
        return prev.map(i => String(i.product_id) === String(product.id) ? { ...i, quantity: currentQty + 1 } : i);
      }
      return [{
        product_id: String(product.id), sku: product.sku, name: product.name, unit: product.unit,
        quantity: 1, available_stock: available, price
      }, ...prev];
    });
    setSearchTerm("");
  };

  const handleAddNewItemToReconcile = (product: Product) => {
    setReconcileItems(prev => {
      const existing = prev.find(i => String(i.product_id) === String(product.id));
      if (existing) {
         toast.info("Este material já está na lista de acerto.");
         return prev;
      }
      toast.success(`${product.name} adicionado ao retorno!`);
      return [{
        product_id: String(product.id), sku: product.sku, name: product.name, unit: product.unit,
        quantity_out: 0, returnedQuantity: 1, price: extractValidPrice(product), status: 'pending'
      }, ...prev];
    });
    setSearchTerm("");
  };

  const updateItemQuantity = (productId: string, delta: number) => {
    setOutboundList(prev => {
      return prev.map(item => {
        if (String(item.product_id) === String(productId)) {
           const freshProduct = productsDictionary.get(String(item.product_id));
           const currentStock = getEffectiveAvailableStock(freshProduct);
           
           const currentQty = item.quantity === '' ? 0 : Number(item.quantity);
           const newQty = currentQty + delta;
           
           if (newQty <= 0) return null; 
           
           if (newQty > currentStock && viewMode === 'new') {
             toast.warning(`Adicionado item sem estoque. (Disponível: ${currentStock}).`);
           }
           return { ...item, quantity: newQty, available_stock: currentStock };
        }
        return item;
      }).filter(Boolean) as TravelItemInput[];
    });
  };

  const handleDirectQuantityChange = (productId: string, value: string) => {
    setOutboundList(prev => {
      return prev.map(item => {
        if (String(item.product_id) === String(productId)) {
           const freshProduct = productsDictionary.get(String(item.product_id));
           const currentStock = getEffectiveAvailableStock(freshProduct);
           
           if (value === '') {
             return { ...item, quantity: '', available_stock: currentStock };
           }

           const newQty = parseInt(value, 10);
           if (isNaN(newQty) || newQty < 0) return item;

           if (newQty > currentStock && viewMode === 'new') {
             toast.warning(`Inserindo quantidade maior que o estoque (${currentStock} disp.).`);
           }

           return { ...item, quantity: newQty, available_stock: currentStock };
        }
        return item;
      });
    });
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'outbound' | 'reconcile') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

      if (target === 'outbound') {
        const formatted: TravelItemInput[] = [];
        let itemsLackingStock = 0;

        data.forEach(row => {
          const sku = String(row['sku'] || row['SKU'] || row['Codigo'] || "");
          const qty = parseSafeNumber(row['quantity'] || row['qtd'] || row['Qtd'] || 0);
          const found = productsDictionary.get(sku);
          
          if (found && qty > 0) {
            const existingInFormatted = formatted.find(i => String(i.product_id) === String(found.id));
            const available = getEffectiveAvailableStock(found);
            const price = extractValidPrice(found);

            if (qty > available) itemsLackingStock++;

            if (existingInFormatted) {
              existingInFormatted.quantity = Number(existingInFormatted.quantity) + qty;
            } else {
              formatted.push({ 
                product_id: String(found.id), sku: found.sku, name: found.name, unit: found.unit, 
                quantity: qty, available_stock: available, price 
              });
            }
          }
        });
        
        setOutboundList(prev => {
           const newList = [...prev];
           formatted.forEach(newItem => {
               const existing = newList.find(i => String(i.product_id) === String(newItem.product_id));
               if (existing) existing.quantity = Number(existing.quantity) + Number(newItem.quantity);
               else newList.push(newItem);
           });
           return newList;
        });
        toast.success(`Foram adicionados ${formatted.length} itens via planilha.`);
        if (itemsLackingStock > 0) toast.warning(`${itemsLackingStock} itens adicionados com estoque insuficiente.`);
      } 
      else if (target === 'reconcile') {
        let updatedItems = [...reconcileItems];
        data.forEach(row => {
          const sku = String(row['sku'] || row['SKU'] || row['Codigo'] || "");
          const qty = parseSafeNumber(row['quantity'] || row['qtd'] || row['Qtd'] || 0);
          const found = productsDictionary.get(sku);
          if (found) {
            const existingIdx = updatedItems.findIndex(i => String(i.product_id) === String(found.id));
            const price = extractValidPrice(found);

            if (existingIdx >= 0) updatedItems[existingIdx].returnedQuantity += qty;
            else updatedItems.push({
                 product_id: String(found.id), sku: found.sku, name: found.name, unit: found.unit,
                 quantity_out: 0, returnedQuantity: qty, price
            });
          }
        });
        setReconcileItems(updatedItems);
        toast.success("Planilha lida com sucesso!");
      }
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveTrip = () => {
    if (!technicians || !city) return toast.warning("Preencha o Destino e a Equipa.");
    if (outboundList.length === 0) return toast.warning("Adicione pelo menos um material à viagem.");

    const hasEmptyQuantities = outboundList.some(i => i.quantity === '' || i.quantity === 0);
    if (hasEmptyQuantities) return toast.warning("Tem itens com quantidade inválida. Verifique o carrinho.");

    const isMissingStock = outboundList.some(item => {
        const freshProduct = productsDictionary.get(String(item.product_id));
        const trueAvailable = getEffectiveAvailableStock(freshProduct);
        return Number(item.quantity) > trueAvailable;
    });

    const orderStatus = isMissingStock ? 'awaiting_stock' : 'pending';

    const payloadItems = outboundList.map(item => ({
        ...item,
        product_id: String(item.product_id),
        quantity: Number(item.quantity)
    }));

    if (viewMode === 'edit' && selectedOrder) {
        updateOrderMutation.mutate({ 
            id: String(selectedOrder.id), 
            data: { technicians, city, items: payloadItems, status: orderStatus } 
        });
        if (!isMissingStock && selectedOrder.status === 'awaiting_stock') {
            toast.success("Pendência resolvida! Viagem atualizada para Andamento.");
        }
    } else {
        createOrderMutation.mutate({ 
            technicians, city, items: payloadItems, status: orderStatus 
        });
        if (isMissingStock) {
           toast.info("Viagem criada com aviso de Pendência de Compra.");
        }
    }
  };

  const openEdit = (order: TravelOrder) => {
    setSelectedOrder(order);
    setCity(order.city);
    setTechnicians(order.technicians);
    
    const initialOutbound = order.items.map((item: any) => {
      const pData = productsDictionary.get(String(item.product_id)) 
                 || productsDictionary.get(String(item.sku)) 
                 || productsDictionary.get(String(item.products?.sku));
      
      const price = extractValidPrice(item, item?.products, pData);
      const qOut = extractQtyOut(item);
      const available = getAvailableStock(pData) + qOut; 

      return {
        product_id: String(item.product_id || pData?.id || ''), 
        sku: item.sku || pData?.sku || 'N/A', 
        name: item.name || pData?.name || 'N/A', 
        unit: item.unit || pData?.unit || 'un',
        quantity: qOut, 
        available_stock: available, 
        price: price
      };
    });

    setOutboundList(initialOutbound);
    setViewMode('edit');
  };

  const openReconcile = (order: TravelOrder, mode: 'reconcile' | 'view') => {
    setSelectedOrder(order);
    
    const initialItems = order.items.map((item: any) => {
      const pData = productsDictionary.get(String(item.product_id)) 
                 || productsDictionary.get(String(item.produto_id)) 
                 || productsDictionary.get(String(item.sku)) 
                 || productsDictionary.get(String(item.products?.sku));
      
      const price = extractValidPrice(item, item?.products, pData);
      const qOut = extractQtyOut(item);
      const qRet = extractQtyRet(item);

      return {
        product_id: String(item.product_id || item.produto_id || pData?.id || 'unknown'), 
        sku: item.sku || item.products?.sku || pData?.sku || 'N/A', 
        name: item.name || item.products?.name || pData?.name || 'N/A', 
        unit: item.unit || item.products?.unit || pData?.unit || 'un',
        quantity_out: qOut, 
        returnedQuantity: mode === 'view' ? qRet : 0, 
        status: item.status || 'pending',
        price: price
      };
    });
    
    setReconcileItems(initialItems);
    setViewMode(mode);
  };

  const updateReturnedQuantity = (product_id: string, qty: number) => {
    setReconcileItems(prev => prev.map(item => String(item.product_id) === String(product_id) ? { ...item, returnedQuantity: Math.max(0, qty) } : item));
  };

  const handleConfirmReconcile = () => {
    if (!selectedOrder) return;
    
    const returnedPayload = reconcileItems
      .filter(item => item.returnedQuantity >= 0)
      .map(item => ({ 
          product_id: String(item.product_id),
          returnedQuantity: Number(item.returnedQuantity)
      }));
      
    reconcileOrderMutation.mutate({ 
        id: String(selectedOrder.id), 
        data: { returnedItems: returnedPayload } 
    });
  };

  const generateReport = (format: 'pdf_saida' | 'pdf_completo' | 'excel') => {
      if (!selectedOrder) return;

      const order = selectedOrder;
      const fileName = `Viagem_${order.city.replace(/\s/g, '_')}_${new Date(order.created_at).toLocaleDateString('pt-BR')}`;
  
      if (format === 'excel') {
        const tableData = reconcileItems.map(item => {
          const qOut = item.quantity_out;
          const qRet = item.returnedQuantity;
          return {
            SKU: item.sku, 
            Produto: item.name,
            "Saída": qOut, 
            "Retorno": qRet, 
            "Diferença": qRet - qOut,
            "Valor Unitário": item.price,
            "Total Saída": qOut * item.price,
            "Valor Consumido": Math.max(0, qOut - qRet) * item.price,
            "Status": item.status === 'ok' ? 'OK' : item.status === 'missing' ? 'FALTA' : 'SOBRA'
          };
        });
        exportToExcel(tableData, fileName);
        return;
      }
  
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
  
      if (format === 'pdf_saida') {
          doc.text("Romaneio de Saída de Viagem", 14, 20);
          
          doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
          doc.text(`Destino: ${order.city}  |  Equipa: ${order.technicians}`, 14, 28);
          doc.text(`Data da Saída: ${new Date(order.created_at).toLocaleDateString('pt-BR')}  |  Status: ${order.status === 'pending' ? 'Em Andamento' : order.status === 'awaiting_stock' ? 'Falta Material' : 'Concluído'}`, 14, 34);
  
          let totalValue = 0;
          const tableRows = reconcileItems.map(item => {
              const pData = productsDictionary.get(String(item.product_id));
              const onHand = Number(pData?.stock?.quantity_on_hand || 0);
              
              let missing = 0;
              if (order.status === 'awaiting_stock' || order.status === 'pending') {
                  missing = Math.max(0, item.quantity_out - onHand);
              }
              const missingStr = missing > 0 ? `${missing}` : '-';

              const itemTotal = item.quantity_out * item.price;
              totalValue += itemTotal;
              
              return [
                item.sku, 
                item.name.substring(0, 45), 
                item.quantity_out, 
                missingStr,
                item.unit, 
                formatCurrency(item.price), 
                formatCurrency(itemTotal)
              ];
          });
  
          autoTable(doc, {
              head: [["SKU", "Produto", "Qtd", "Falta", "Un.", "V. Unitário", "V. Total"]],
              body: tableRows,
              startY: 40,
              styles: { fontSize: 8 },
              headStyles: { fillColor: [37, 99, 235] },
              didParseCell: (data) => {
                  if (data.section === 'body' && data.column.index === 3) {
                      if (data.cell.raw !== '-') {
                          data.cell.styles.textColor = [220, 38, 38]; 
                          data.cell.styles.fontStyle = 'bold';
                      }
                  }
              }
          });
  
          const finalY = (doc as any).lastAutoTable.finalY + 15;
          doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
          doc.text(`Valor Total do Pedido (Saída): ${formatCurrency(totalValue)}`, 14, finalY);
  
      } else if (format === 'pdf_completo') {
          doc.text("Relatório de Confronto de Viagem", 14, 20);
          
          doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
          doc.text(`Destino: ${order.city}  |  Equipa: ${order.technicians}`, 14, 28);
          doc.text(`Data: ${new Date(order.created_at).toLocaleDateString('pt-BR')}`, 14, 34);
  
          let totalSaida = 0;
          let totalRetorno = 0;
          let totalConsumo = 0;
          let totalSobra = 0;
  
          const tableRows = reconcileItems.map(item => {
              const valSaida = item.quantity_out * item.price;
              const valRetorno = item.returnedQuantity * item.price;
              const difConsumida = item.quantity_out - item.returnedQuantity;
              const valConsumo = difConsumida * item.price;
  
              totalSaida += valSaida;
              totalRetorno += valRetorno;
              
              if (difConsumida > 0) totalConsumo += valConsumo;
              else if (difConsumida < 0) totalSobra += Math.abs(valConsumo);

              let statusText = "Concluído";
              if (item.quantity_out === 0 && item.returnedQuantity > 0) {
                  statusText = "Extra";
              } else if (difConsumida > 0) {
                  statusText = "Falta";
              } else if (difConsumida < 0) {
                  statusText = "Sobrou";
              }
  
              return [
                  item.sku, 
                  item.name.substring(0, 45), 
                  item.quantity_out, 
                  item.returnedQuantity, 
                  statusText
              ];
          });
  
          autoTable(doc, {
              head: [["SKU", "Produto", "Saída", "Volta", "Status"]],
              body: tableRows,
              startY: 40,
              styles: { fontSize: 8 },
              headStyles: { fillColor: [71, 85, 105] },
              didParseCell: (data) => {
                  if (data.section === 'body' && data.column.index === 4) {
                      const status = data.cell.raw;
                      data.cell.styles.fontStyle = 'bold';
                      if (status === 'Concluído') {
                          data.cell.styles.textColor = [22, 163, 74]; 
                      } else if (status === 'Falta') {
                          data.cell.styles.textColor = [220, 38, 38]; 
                      } else if (status === 'Sobrou') {
                          data.cell.styles.textColor = [37, 99, 235]; 
                      } else if (status === 'Extra') {
                          data.cell.styles.textColor = [147, 51, 234]; 
                      }
                  }
              }
          });
  
          let finalY = (doc as any).lastAutoTable.finalY + 15;
          if (finalY > doc.internal.pageSize.height - 40) {
              doc.addPage();
              finalY = 20;
          }

          doc.setFontSize(11); 
          doc.setFont("helvetica", "bold"); 
          doc.setTextColor(15, 23, 42);
          doc.text("Resumo Financeiro da Viagem:", 14, finalY);
          
          finalY += 8;
          doc.setFontSize(10); 
          doc.setFont("helvetica", "normal");
          doc.text(`1. Valor Total Inicial (Saída do Estoque): ${formatCurrency(totalSaida)}`, 14, finalY);
          
          finalY += 6;
          doc.text(`2. Valor Total Devolvido (Retornou ao Estoque): ${formatCurrency(totalRetorno)}`, 14, finalY);
          
          finalY += 6;
          doc.text(`3. Valor Líquido Consumido/Faltante na Obra: ${formatCurrency(totalConsumo)}`, 14, finalY);
          
          finalY += 6;
          doc.setFont("helvetica", "bold");
          doc.setTextColor(147, 51, 234); 
          doc.text(`* Atenção: Foram trazidos materiais extras totalizando: ${formatCurrency(totalSobra)}`, 14, finalY);
      }
  
      doc.save(`${fileName}.pdf`);
      toast.success("Relatório gerado com sucesso!");
  };

  const uiTotalSaida = reconcileItems.reduce((acc, item) => acc + (item.quantity_out * item.price), 0);
  const uiTotalRetorno = reconcileItems.reduce((acc, item) => acc + (item.returnedQuantity * item.price), 0);
  const uiTotalConsumo = reconcileItems.reduce((acc, item) => acc + (Math.max(0, item.quantity_out - item.returnedQuantity) * item.price), 0);
  const uiTotalExtra = reconcileItems.reduce((acc, item) => acc + (Math.max(0, item.returnedQuantity - item.quantity_out) * item.price), 0);
  
  const uiTotalQtdSaida = reconcileItems.reduce((acc, item) => acc + Number(item.quantity_out), 0);
  const uiTotalQtdRetorno = reconcileItems.reduce((acc, item) => acc + Number(item.returnedQuantity), 0);
  const uiTotalQtdConsumo = reconcileItems.reduce((acc, item) => acc + Math.max(0, Number(item.quantity_out) - Number(item.returnedQuantity)), 0);
  const uiTotalQtdExtra = reconcileItems.reduce((acc, item) => acc + Math.max(0, Number(item.returnedQuantity) - Number(item.quantity_out)), 0);

  const uiTotalOutboundCarrinho = outboundList.reduce((acc, item) => acc + (Number(item.quantity) * item.price), 0);

  if (viewMode === 'list') {
    return (
      <div className="space-y-6 md:space-y-8 pb-[120px] md:pb-24 max-w-7xl mx-auto px-4 md:px-6 xl:px-8 relative min-h-screen pt-4 md:pt-8">
        
        <AlertDialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
          <AlertDialogContent className="rounded-[2rem] w-[95vw] max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl md:text-2xl font-black text-foreground">Excluir Viagem?</AlertDialogTitle>
              <AlertDialogDescription className="text-sm md:text-base text-muted-foreground font-medium">
                Tens a certeza que desejas excluir esta viagem? <br className="hidden sm:block" />
                Esta ação devolverá os itens pendentes ao estoque e anulará consumos. Esta operação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4 gap-2 md:gap-3 flex-col sm:flex-row">
              <AlertDialogCancel className="rounded-xl h-12 text-sm md:text-base font-bold sm:w-1/2 mt-0">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-12 text-sm md:text-base font-bold sm:w-1/2 shadow-lg shadow-red-600/20"
                onClick={() => {
                  if (orderToDelete) {
                    deleteOrderMutation.mutate(orderToDelete);
                    setOrderToDelete(null);
                  }
                }}
              >
                Sim, Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ===================== MODAL DE ESPELHO DE ACERTO ===================== */}
        <Dialog open={!!reconciliationSummary} onOpenChange={(open) => {
            if (!open) setReconciliationSummary(null);
        }}>
            <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-[2.5rem] border-0 shadow-2xl bg-background">
                
                {/* Cabeçalho do Modal */}
                <div className="px-6 pt-8 pb-6 border-b border-border/50 bg-emerald-500/5">
                    <div className="flex flex-col items-center justify-center text-center gap-3">
                        <div className="h-16 w-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
                            <CheckCircle2 className="h-8 w-8" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black text-foreground">Acerto Concluído!</DialogTitle>
                            <DialogDescription className="text-sm font-medium mt-1">
                                Viagem <strong className="text-foreground">{reconciliationSummary?.orderId}</strong> • {reconciliationSummary?.technicians}
                            </DialogDescription>
                        </div>
                    </div>
                </div>

                {/* Lista de Movimentações */}
                <div className="max-h-[50vh] overflow-y-auto px-6 py-4 bg-muted/5">
                    <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                        <Receipt className="h-4 w-4" />
                        Espelho de Movimentação
                    </h4>
                    
                    <div className="space-y-3">
                        {reconciliationSummary?.items.map((item, index) => (
                            <div key={index} className="flex flex-col p-4 rounded-2xl bg-background border border-border/50 shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="min-w-0 pr-3">
                                        <p className="text-base font-bold leading-tight text-foreground truncate">
                                            {item.name}
                                        </p>
                                        <span className="text-[10px] font-mono text-muted-foreground mt-0.5 block">
                                            SKU: {item.sku} • Levou: {item.quantity_out} un.
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 mt-1">
                                    {/* Badge do que Voltou pro Estoque */}
                                    <Badge variant="outline" className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold flex-1 justify-center">
                                        <ArrowUpLeft className="h-3.5 w-3.5" />
                                        Retornou: {item.returnedQty}
                                    </Badge>

                                    {/* Badge do que foi Consumido/Baixado */}
                                    <Badge variant="outline" className={cn(
                                        "flex items-center gap-1.5 px-2.5 py-1 font-bold flex-1 justify-center",
                                        item.consumedQty > 0 
                                            ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400" 
                                            : item.consumedQty < 0 
                                                ? "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400" // Caso de devolução extra
                                                : "bg-muted border-border text-muted-foreground" // Zero consumido
                                    )}>
                                        <ArrowDownRight className="h-3.5 w-3.5" />
                                        {item.consumedQty > 0 
                                            ? `Baixado: ${item.consumedQty}` 
                                            : item.consumedQty < 0 
                                                ? `Extra: ${Math.abs(item.consumedQty)}` 
                                                : "Consumo: 0"}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Rodapé do Modal */}
                <div className="p-6 bg-background border-t border-border/50">
                    <button 
                        className="w-full h-14 bg-muted hover:bg-muted/80 text-foreground font-black text-lg rounded-2xl transition-colors cursor-pointer"
                        onClick={() => setReconciliationSummary(null)}
                    >
                        Entendido, Fechar
                    </button>
                </div>
            </DialogContent>
        </Dialog>


        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">Viagens</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1 font-medium">Controle saídas e retornos de material da equipa.</p>
          </div>
          <Button onClick={() => { resetNewTripForm(); setViewMode('new'); }} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-lg shadow-emerald-600/20 px-8 h-14 text-base md:text-lg font-bold hidden md:flex transition-all active:scale-[0.98]">
            <Plus className="mr-2 h-5 w-5 md:h-6 md:w-6" /> Registar Saída
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          <div className="bg-gradient-to-br from-card to-muted border border-border rounded-[1.5rem] md:rounded-3xl p-4 md:p-5 flex flex-col justify-center shadow-sm">
            <p className="text-xs md:text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Total</p>
            <h3 className="text-2xl md:text-3xl xl:text-4xl font-black text-foreground">{stats.total}</h3>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/10 border border-red-100 dark:border-red-900/50 rounded-[1.5rem] md:rounded-3xl p-4 md:p-5 flex flex-col justify-center shadow-sm">
            <p className="text-xs md:text-sm font-bold text-red-600 dark:text-red-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><ShoppingCart className="h-3 w-3 md:h-4 md:w-4" /> Pend. Compra</p>
            <h3 className="text-2xl md:text-3xl xl:text-4xl font-black text-red-700 dark:text-red-400">{stats.awaiting_stock}</h3>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/10 border border-amber-100 dark:border-amber-900/50 rounded-[1.5rem] md:rounded-3xl p-4 md:p-5 flex flex-col justify-center shadow-sm">
            <p className="text-xs md:text-sm font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Clock className="h-3 w-3 md:h-4 md:w-4" /> Na Rua</p>
            <h3 className="text-2xl md:text-3xl xl:text-4xl font-black text-amber-700 dark:text-amber-400">{stats.pending}</h3>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/10 border border-emerald-100 dark:border-emerald-900/50 rounded-[1.5rem] md:rounded-3xl p-4 md:p-5 flex flex-col justify-center shadow-sm">
            <p className="text-xs md:text-sm font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 md:h-4 md:w-4" /> Acertadas</p>
            <h3 className="text-2xl md:text-3xl xl:text-4xl font-black text-emerald-700 dark:text-emerald-400">{stats.reconciled}</h3>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg md:text-xl font-bold text-foreground ml-1 md:ml-2">Histórico de Viagens</h2>
          
          <div className="flex flex-col xl:flex-row gap-3 md:gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
              <Input 
                placeholder="Pesquisar por destino ou equipa..." 
                className="pl-10 md:pl-12 h-12 md:h-14 rounded-[1rem] md:rounded-2xl bg-card border-border shadow-sm text-sm md:text-base font-medium focus-visible:ring-emerald-500/20"
                value={orderSearchTerm}
                onChange={(e) => setOrderSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex bg-muted/40 p-1 md:p-1.5 rounded-[1rem] md:rounded-2xl border border-border shadow-sm w-full xl:w-auto h-12 md:h-14 shrink-0 overflow-x-auto scrollbar-hide">
               <button 
                 onClick={() => setOrderStatusFilter('all')}
                 className={`flex-1 px-3 md:px-6 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${orderStatusFilter === 'all' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
               >
                 Todos
               </button>
               <button 
                 onClick={() => setOrderStatusFilter('awaiting_stock')}
                 className={`flex-1 px-3 md:px-6 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${orderStatusFilter === 'awaiting_stock' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
               >
                 Pendente
               </button>
               <button 
                 onClick={() => setOrderStatusFilter('pending')}
                 className={`flex-1 px-3 md:px-6 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${orderStatusFilter === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
               >
                 Andamento
               </button>
               <button 
                 onClick={() => setOrderStatusFilter('reconciled')}
                 className={`flex-1 px-3 md:px-6 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${orderStatusFilter === 'reconciled' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
               >
                 Concluídos
               </button>
            </div>
          </div>

          {isLoadingOrders ? (
            <div className="text-center py-12 md:py-20 text-muted-foreground animate-pulse font-medium text-sm md:text-base">Carregando viagens...</div>
          ) : travelOrders.length === 0 ? (
            <div className="text-center py-16 md:py-24 px-4 bg-muted/20 border-2 border-dashed border-border rounded-3xl">
              <Car className="h-12 w-12 md:h-16 md:w-16 mx-auto text-muted-foreground/30 mb-3 md:mb-4" />
              <p className="text-foreground font-bold text-lg md:text-xl">Nenhuma viagem registada</p>
              <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">Clique em "Registar Saída" para começar.</p>
            </div>
          ) : filteredOrders.length === 0 ? (
             <div className="text-center py-12 md:py-16 px-4 bg-muted/10 border-2 border-dashed border-border rounded-3xl">
              <Search className="h-10 w-10 md:h-12 md:w-12 mx-auto text-muted-foreground/30 mb-3 md:mb-4" />
              <p className="text-foreground font-bold text-base md:text-lg">Nenhuma viagem encontrada</p>
              <p className="text-muted-foreground mt-1 text-sm md:text-base">Tente ajustar a sua pesquisa ou os filtros acima.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredOrders.map((order) => {
                 
                 let cardTotalSaida = 0;
                 let cardTotalRetorno = 0;
                 let cardTotalConsumo = 0;
                 let cardTotalQtdSaida = 0;
                 let cardTotalQtdRetorno = 0;
                 let cardTotalQtdConsumo = 0;
         
                 (order.items || []).forEach((item: any) => {
                    const pData = productsDictionary.get(String(item.product_id)) 
                               || productsDictionary.get(String(item.produto_id))
                               || productsDictionary.get(String(item.sku)) 
                               || productsDictionary.get(String(item.products?.sku));
                    
                    const price = extractValidPrice(item, item?.products, pData);
                    const qOut = extractQtyOut(item);
                    const qRet = extractQtyRet(item);
                    const qConsumo = Math.max(0, qOut - qRet);
         
                    cardTotalSaida += (qOut * price);
                    cardTotalRetorno += (qRet * price);
                    cardTotalConsumo += (qConsumo * price);
         
                    cardTotalQtdSaida += qOut;
                    cardTotalQtdRetorno += qRet;
                    cardTotalQtdConsumo += qConsumo;
                 });

                 return (
                  <div 
                    key={order.id} 
                    className="bg-card hover:bg-muted/30 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-5 border border-border shadow-sm hover:shadow-md flex flex-col transition-all active:scale-[0.99] group relative"
                  >
                    {/* MENU DE OPÇÕES */}
                    <div className="absolute top-3 right-3 md:top-4 md:right-4 z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()} className="h-8 w-8 rounded-full hover:bg-muted">
                            <MoreVertical className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl shadow-xl">
                          {(order.status === 'pending' || order.status === 'awaiting_stock') && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(order); }} className="cursor-pointer py-2.5">
                              <Edit className="h-4 w-4 mr-2" /> Editar / Adicionar Itens
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setOrderToDelete(order.id); }} className="cursor-pointer text-red-600 focus:text-red-600 py-2.5">
                            <Trash className="h-4 w-4 mr-2" /> Excluir Viagem
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div 
                      className="flex items-start justify-between w-full mb-4 cursor-pointer pt-1 md:pt-0"
                      onClick={() => openReconcile(order, (order.status === 'pending' || order.status === 'awaiting_stock') ? 'reconcile' : 'view')}
                    >
                      <div className="flex items-center gap-3 md:gap-4 min-w-0 pr-8 w-full">
                        <div className={`h-12 w-12 md:h-14 md:w-14 rounded-[1rem] md:rounded-2xl flex items-center justify-center shrink-0 border shadow-inner ${
                          order.status === 'awaiting_stock' ? 'bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:border-red-800' :
                          order.status === 'pending' ? 'bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800' : 
                          'bg-muted border-border text-muted-foreground'
                        }`}>
                          {order.status === 'awaiting_stock' ? <ShoppingCart className="h-6 w-6 md:h-7 md:w-7" /> : <Car className="h-6 w-6 md:h-7 md:w-7" />}
                        </div>
                        <div className="flex flex-col justify-center min-w-0 w-full pr-4 md:pr-8">
                          <h3 className="font-extrabold text-foreground text-base md:text-xl leading-tight mb-1 truncate">{order.city}</h3>
                          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-3 gap-y-1 text-xs md:text-sm font-medium text-muted-foreground">
                            <span className="flex items-center gap-1.5 truncate"><HardHat className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{order.technicians}</span></span>
                            <span className="hidden sm:inline text-border shrink-0">•</span>
                            <span className="flex items-center gap-1.5 shrink-0"><CalendarDays className="h-3.5 w-3.5" /> {new Date(order.created_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div 
                        className="flex flex-col items-end gap-2 shrink-0 absolute top-3 right-12 md:top-4 md:right-14"
                        onClick={() => openReconcile(order, (order.status === 'pending' || order.status === 'awaiting_stock') ? 'reconcile' : 'view')}
                    >
                      {order.status === 'awaiting_stock' ? (
                         <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-400 px-2 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs border-0 shadow-sm cursor-pointer">Pendente Compra</Badge>
                      ) : order.status === 'pending' ? (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400 px-2 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs border-0 shadow-sm cursor-pointer">Andamento</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400 px-2 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs border-0 shadow-sm cursor-pointer">Concluído</Badge>
                      )}
                    </div>

                    {/* ALERTA DE PENDÊNCIA VISÍVEL NO CARD */}
                    {order.status === 'awaiting_stock' && (
                      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl p-3 mb-4 flex flex-col sm:flex-row sm:items-center gap-3 cursor-default" onClick={e => e.stopPropagation()}>
                         <div className="flex items-start gap-3 flex-1">
                           <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                           <div>
                             <p className="text-sm font-bold text-red-800 dark:text-red-400">Materiais Pendentes / Em Falta</p>
                             <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">Após a compra, edite a viagem para atualizar o estoque.</p>
                           </div>
                         </div>
                         <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white border-0 shadow-sm w-full sm:w-auto" onClick={(e) => { e.stopPropagation(); openEdit(order); }}>
                           Resolver
                         </Button>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 md:gap-3 pt-3 md:pt-4 border-t border-dashed border-border/80 cursor-pointer" onClick={() => openReconcile(order, (order.status === 'pending' || order.status === 'awaiting_stock') ? 'reconcile' : 'view')}>
                      <div className="flex flex-col bg-muted/30 p-2 md:p-3 rounded-xl border border-border/50">
                        <span className="text-muted-foreground uppercase tracking-wider text-[9px] md:text-[10px] font-bold flex items-center gap-1 mb-1"><Upload className="h-3 w-3 text-blue-500" /> Saída</span>
                        <span className="font-black text-foreground text-xs md:text-base leading-none truncate">{formatCurrency(cardTotalSaida)}</span>
                        <span className="text-muted-foreground font-semibold text-[9px] md:text-[10px] mt-1">{cardTotalQtdSaida} mat.</span>
                      </div>
                      <div className="flex flex-col bg-muted/30 p-2 md:p-3 rounded-xl border border-border/50">
                        <span className="text-muted-foreground uppercase tracking-wider text-[9px] md:text-[10px] font-bold flex items-center gap-1 mb-1"><ArrowRightLeft className="h-3 w-3 text-amber-500" /> Retorno</span>
                        <span className="font-black text-foreground text-xs md:text-base leading-none truncate">{formatCurrency(cardTotalRetorno)}</span>
                        <span className="text-muted-foreground font-semibold text-[9px] md:text-[10px] mt-1">{cardTotalQtdRetorno} mat.</span>
                      </div>
                      <div className="flex flex-col bg-red-50/50 dark:bg-red-950/20 p-2 md:p-3 rounded-xl border border-red-100 dark:border-red-900/30">
                        <span className="text-red-500 uppercase tracking-wider text-[9px] md:text-[10px] font-bold flex items-center gap-1 mb-1"><DollarSign className="h-3 w-3" /> Consumo</span>
                        <span className="font-black text-red-600 dark:text-red-400 text-xs md:text-base leading-none truncate">{formatCurrency(cardTotalConsumo)}</span>
                        <span className="text-red-400 font-semibold text-[9px] md:text-[10px] mt-1">{cardTotalQtdConsumo} mat.</span>
                      </div>
                    </div>

                  </div>
                 );
              })}
            </div>
          )}
        </div>

        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-md bg-background/80 md:bg-transparent z-40 md:hidden flex justify-center border-t border-border/50">
           <Button onClick={() => { resetNewTripForm(); setViewMode('new'); }} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg shadow-emerald-600/30 px-8 h-12 md:h-14 text-base font-bold transition-all active:scale-[0.98] w-full max-w-[300px]">
            <Plus className="mr-2 h-5 w-5" /> Nova Viagem
          </Button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // UI 2: NOVA VIAGEM / EDITAR VIAGEM
  // ============================================================================
  if (viewMode === 'new' || viewMode === 'edit') {
    return (
      <div className="w-full mx-auto space-y-4 md:space-y-8 pb-[140px] md:pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500 px-4 md:px-6 xl:px-8 relative min-h-screen pt-4 md:pt-8">
        <div className="flex items-center gap-3 md:gap-4">
          <Button variant="ghost" size="icon" onClick={() => setViewMode('list')} className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-muted/50 hover:bg-muted shrink-0 transition-colors">
            <ArrowLeft className="h-5 w-5 md:h-6 md:w-6 text-foreground" />
          </Button>
          <div>
            <h1 className="text-xl md:text-3xl font-black tracking-tight text-foreground">
              {viewMode === 'edit' ? "Editar Viagem" : "Registar Saída"}
            </h1>
            <p className="text-[11px] md:text-sm font-medium text-muted-foreground mt-0.5 md:mt-1">O que a equipa vai levar para a obra?</p>
          </div>
        </div>

        <div className="bg-card p-4 md:p-8 rounded-[1.5rem] md:rounded-3xl border border-border shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-1.5 md:space-y-2">
              <Label className="text-foreground font-bold ml-1 text-xs md:text-sm">Destino da Viagem</Label>
              <div className="relative">
                <MapPin className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                <Input placeholder="Ex: Obra Centro" value={city} onChange={e => setCity(e.target.value)} className="pl-10 md:pl-12 h-12 md:h-14 rounded-xl md:rounded-2xl bg-muted/30 border border-border/50 focus:bg-background focus:ring-emerald-500/20 focus:border-emerald-500 text-sm md:text-base font-medium transition-all shadow-inner" />
              </div>
            </div>
            <div className="space-y-1.5 md:space-y-2">
              <Label className="text-foreground font-bold ml-1 text-xs md:text-sm">Equipa / Técnicos</Label>
              <div className="relative">
                <HardHat className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                <Input placeholder="Ex: João e Maria" value={technicians} onChange={e => setTechnicians(e.target.value)} className="pl-10 md:pl-12 h-12 md:h-14 rounded-xl md:rounded-2xl bg-muted/30 border border-border/50 focus:bg-background focus:ring-emerald-500/20 focus:border-emerald-500 text-sm md:text-base font-medium transition-all shadow-inner" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 md:space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4 mt-2 md:mt-0">
            <h2 className="text-lg md:text-2xl font-black text-foreground flex items-center">
               Carrinho 
               {outboundList.length > 0 && <span className="text-emerald-600 text-base md:text-xl ml-2">({formatCurrency(uiTotalOutboundCarrinho)})</span>}
            </h2>
            <Label htmlFor="upload-excel" className="cursor-pointer inline-flex items-center justify-center gap-2 text-xs md:text-sm font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-4 md:px-5 py-2.5 md:py-3 rounded-xl md:rounded-2xl hover:bg-emerald-200 transition-colors w-full sm:w-max active:scale-95 shadow-sm">
              <FileSpreadsheet className="h-4 w-4 md:h-5 md:w-5" /> Importar Planilha
            </Label>
            <Input id="upload-excel" type="file" accept=".xlsx" className="hidden" onChange={e => handleExcelUpload(e, 'outbound')} />
          </div>

          <div className="relative z-10">
            <div className="relative group">
              <Search className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 h-5 w-5 md:h-6 md:w-6 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
              <Input
                placeholder="Busque por produto ou SKU..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 md:pl-14 h-12 md:h-16 rounded-[1rem] md:rounded-3xl border border-border shadow-sm text-sm md:text-lg font-medium focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 transition-all bg-card"
              />
            </div>

            {searchTerm && searchResults.length > 0 && (
              <Card className="absolute top-[105%] left-0 right-0 p-2 shadow-2xl border-border rounded-[1rem] md:rounded-3xl bg-card animate-in fade-in slide-in-from-top-2 md:slide-in-from-top-4 z-50 max-h-[350px] overflow-y-auto">
                {searchResults.map(product => {
                   const available = getEffectiveAvailableStock(product);
                   const itemPrice = extractValidPrice(product);

                   return (
                     <button
                       key={product.id}
                       onClick={() => handleAddFromSearch(product)}
                       className="w-full flex items-center justify-between p-3 md:p-4 hover:bg-muted/60 rounded-xl md:rounded-2xl transition-all text-left group active:bg-muted"
                     >
                        <div className="flex-1 min-w-0 pr-3 md:pr-4">
                          <p className="font-bold md:font-extrabold text-foreground text-sm md:text-lg group-hover:text-emerald-600 transition-colors line-clamp-2">{product.name}</p>
                          <p className="text-[10px] md:text-sm font-medium text-muted-foreground mt-1 flex flex-wrap gap-1.5 md:gap-2 items-center">
                            <span className="bg-muted px-1.5 py-0.5 rounded text-foreground font-semibold">SKU: {product.sku}</span> 
                            <span>{formatCurrency(itemPrice)}</span> 
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <Badge variant="secondary" className={`text-[10px] md:text-sm py-1 px-2 md:py-1.5 md:px-3 rounded-lg md:rounded-xl border-0 font-bold ${available > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-red-100 text-red-700'}`}>
                            {available} {product.unit} disp.
                          </Badge>
                        </div>
                     </button>
                   );
                })}
              </Card>
            )}
            
            {searchTerm && searchResults.length === 0 && (
               <Card className="absolute top-[105%] left-0 right-0 p-4 md:p-8 text-center shadow-xl border-border rounded-[1rem] md:rounded-3xl bg-card text-muted-foreground z-50">
                 <PackageSearch className="h-6 w-6 md:h-10 md:w-10 mx-auto mb-2 md:mb-3 opacity-20" />
                 <span className="font-bold text-sm md:text-lg">Produto não encontrado.</span>
               </Card>
            )}
          </div>

          {outboundList.length > 0 ? (
            <div className="flex flex-col gap-3 md:gap-4 pt-2 md:pt-4">
              {outboundList.map((item) => {
                 const qtyToBuy = Math.max(0, Number(item.quantity) - item.available_stock);
                 
                 return (
                  <div key={item.product_id} className="bg-card p-4 md:p-5 rounded-[1.25rem] md:rounded-3xl border border-border shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 group transition-all hover:border-emerald-500/30 w-full">
                    
                    <div className="flex items-start md:items-center gap-3 md:gap-5 flex-1 w-full">
                        <div className="h-12 w-12 md:h-16 md:w-16 rounded-xl md:rounded-2xl bg-muted/50 flex items-center justify-center shrink-0 border border-border group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20 transition-colors">
                          <Package className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                        </div>
                        <div className="flex-1 w-full">
                          <h3 className="font-bold text-foreground text-base md:text-lg leading-snug">
                            {item.name}
                          </h3>
                          
                          <div className="text-[11px] md:text-sm font-medium text-muted-foreground mt-2 flex flex-wrap gap-2 items-center">
                            <span className="bg-muted/80 px-2 py-0.5 rounded-md text-foreground border border-border/50">SKU: {item.sku}</span> 
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30 px-2 py-0.5 rounded-md">
                              Disp: {item.available_stock} {item.unit}
                            </span> 
                            <span className="text-emerald-600 dark:text-emerald-400 font-black">{formatCurrency(item.price)} un.</span>
                            
                            {qtyToBuy > 0 && (
                              <Badge variant="destructive" className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-0 ml-1">
                                Comprar: {qtyToBuy} {item.unit}
                              </Badge>
                            )}
                          </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 w-full lg:w-auto justify-between lg:justify-end border-t border-dashed border-border/50 lg:border-0 pt-4 lg:pt-0 mt-1 lg:mt-0">
                        
                        <div className="flex flex-col items-start lg:items-end mr-2 lg:mr-4 min-w-[90px]">
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Subtotal</span>
                          <span className="font-black text-foreground text-sm md:text-base">{formatCurrency(Number(item.quantity) * item.price)}</span>
                        </div>

                        <div className="flex items-center gap-2 md:gap-3">
                          <div className="flex items-center bg-muted/30 rounded-xl md:rounded-2xl border border-border overflow-hidden h-12 md:h-14 shadow-inner">
                            <button onClick={() => updateItemQuantity(item.product_id, -1)} className="w-12 md:w-14 h-full flex items-center justify-center hover:bg-muted/80 text-foreground transition-colors active:bg-muted shrink-0">
                              <Minus className="h-4 w-4 md:h-5 md:w-5" />
                            </button>
                            <div className="w-16 lg:w-20 h-full bg-background border-x border-border/50">
                              <Input 
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => handleDirectQuantityChange(item.product_id, e.target.value)}
                                  className="h-full w-full border-0 text-center font-black text-base md:text-xl px-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent rounded-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </div>
                            <button onClick={() => updateItemQuantity(item.product_id, 1)} className="w-12 md:w-14 h-full flex items-center justify-center hover:bg-muted/80 text-foreground transition-colors active:bg-muted shrink-0">
                              <Plus className="h-4 w-4 md:h-5 md:w-5" />
                            </button>
                          </div>
                          <button onClick={() => setOutboundList(prev => prev.filter(i => i.product_id !== item.product_id))} className="h-12 w-12 md:h-14 md:w-14 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl md:rounded-2xl transition-all active:scale-90 shrink-0 border border-border/50 hover:border-red-100 dark:hover:border-red-900/30 bg-card shadow-sm">
                            <Trash2 className="h-5 w-5 md:h-6 md:w-6" />
                          </button>
                        </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 md:py-24 px-4 bg-muted/10 border-2 border-dashed border-border/50 rounded-3xl mt-6 md:mt-8">
               <div className="h-16 w-16 md:h-24 md:w-24 bg-card rounded-full shadow-sm flex items-center justify-center mx-auto mb-3 md:mb-5 border border-border">
                 <PackageSearch className="h-8 w-8 md:h-12 md:w-12 text-muted-foreground/30" />
               </div>
               <p className="text-foreground font-black text-lg md:text-2xl">O carrinho está vazio</p>
               <p className="text-xs md:text-base font-medium text-muted-foreground mt-1 md:mt-2">Usa a busca para adicionar os materiais.</p>
            </div>
          )}
        </div>

        {/* BARRA DE AÇÕES - UI 2 (Nova Viagem/Editar) */}
        <div className="fixed bottom-16 md:bottom-6 left-0 right-0 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-4xl z-40 p-3 md:p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-4 backdrop-blur-xl bg-background/90 md:bg-background/80 border-t border-border/50 md:border md:rounded-3xl shadow-[0_-10px_20px_-15px_rgba(0,0,0,0.1)] md:shadow-2xl flex justify-center">
          <div className="w-full flex gap-2 sm:gap-3 md:gap-4">
             <Button variant="outline" onClick={() => setViewMode('list')} className="h-12 md:h-14 w-14 sm:w-24 md:w-32 rounded-xl md:rounded-2xl text-sm md:text-base font-bold border-2 border-border bg-background shadow-sm hover:bg-muted shrink-0 p-0 sm:px-4 transition-all">
               <ArrowLeft className="h-5 w-5 sm:hidden" />
               <span className="hidden sm:inline">Voltar</span>
             </Button>
             <Button
               onClick={handleSaveTrip}
               disabled={outboundList.length === 0 || createOrderMutation.isPending || updateOrderMutation.isPending}
               className="flex-1 h-12 md:h-14 text-sm sm:text-base md:text-lg font-black rounded-xl md:rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.98] disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 whitespace-nowrap text-center"
             >
               {createOrderMutation.isPending || updateOrderMutation.isPending ? "A Salvar..." : (viewMode === 'edit' ? "Salvar Alterações" : `Confirmar Viagem (${outboundList.length})`)}
             </Button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // UI 3: ACERTO (A VOLTA E DETALHES)
  // ============================================================================
  if (viewMode === 'reconcile' || viewMode === 'view') {
    const isViewing = viewMode === 'view';
    return (
      <div className="space-y-4 md:space-y-8 pb-[140px] md:pb-32 animate-in slide-in-from-right-4 duration-400 max-w-6xl mx-auto px-4 md:px-6 xl:px-8 relative min-h-screen pt-4 md:pt-8">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4">
              <Button variant="ghost" size="icon" onClick={() => setViewMode('list')} className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-muted/50 hover:bg-muted shrink-0 transition-colors">
                <ArrowLeft className="h-5 w-5 md:h-6 md:w-6 text-foreground" />
              </Button>
              <div>
                  <h1 className="text-xl md:text-3xl font-black tracking-tight text-foreground truncate max-w-[200px] sm:max-w-none">
                    {isViewing ? "Detalhes da Viagem" : "Acerto de Contas"}
                  </h1>
              </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full h-10 w-10 md:h-12 md:w-12 border-border shadow-sm bg-card hover:bg-muted shrink-0">
                <MoreVertical className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl p-2 font-medium min-w-[200px] shadow-xl">
              <DropdownMenuItem onClick={() => generateReport('pdf_saida')} className="p-3 text-sm md:text-base cursor-pointer rounded-xl"><FileText className="h-4 w-4 md:h-5 md:w-5 mr-3 text-blue-500" /> Romaneio de Saída</DropdownMenuItem>
              <DropdownMenuItem onClick={() => generateReport('pdf_completo')} className="p-3 text-sm md:text-base cursor-pointer rounded-xl"><FileText className="h-4 w-4 md:h-5 md:w-5 mr-3 text-red-500" /> Relatório Completo</DropdownMenuItem>
              <div className="h-px bg-border my-1 mx-2"></div>
              <DropdownMenuItem onClick={() => generateReport('excel')} className="p-3 text-sm md:text-base cursor-pointer rounded-xl"><FileSpreadsheet className="h-4 w-4 md:h-5 md:w-5 mr-3 text-emerald-600" /> Exportar Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="bg-card rounded-[1.5rem] md:rounded-[2rem] border border-border shadow-sm overflow-hidden">
          <div className="p-4 md:p-8 bg-muted/20 border-b border-dashed border-border/80">
             <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
                <div>
                  <p className="text-muted-foreground text-[9px] md:text-xs font-bold uppercase tracking-wider mb-0.5 md:mb-1">Equipa</p>
                  <p className="font-bold md:font-extrabold text-sm md:text-xl text-foreground truncate">{selectedOrder?.technicians}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[9px] md:text-xs font-bold uppercase tracking-wider mb-0.5 md:mb-1">Destino</p>
                  <p className="font-bold md:font-extrabold text-sm md:text-xl text-foreground truncate">{selectedOrder?.city}</p>
                </div>
                <div className="col-span-2 md:col-span-1 border-t md:border-0 border-border/50 pt-2 md:pt-0">
                  <p className="text-muted-foreground text-[9px] md:text-xs font-bold uppercase tracking-wider mb-0.5 md:mb-1">Data</p>
                  <p className="font-bold md:font-extrabold text-sm md:text-xl text-foreground">{selectedOrder && new Date(selectedOrder.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
             </div>
          </div>

          <div className="bg-slate-900 dark:bg-slate-950 text-white p-3 md:p-5 flex flex-col gap-3 md:gap-4 mt-4 md:mt-6 mx-3 md:mx-8 rounded-[1rem] md:rounded-[1.5rem] shadow-md border border-slate-800">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-3 gap-x-2 md:gap-4 text-[10px] md:text-sm font-medium">
              <div className="flex flex-col items-center justify-center text-center pb-2 sm:pb-0 border-b sm:border-b-0 sm:border-r border-slate-700/80">
                 <Upload className="h-3 w-3 md:h-5 md:w-5 text-blue-400 mb-1" />
                 <span className="text-slate-400 uppercase tracking-wider text-[8px] md:text-xs">Levado</span>
                 <strong className="text-xs md:text-lg mt-0.5">{formatCurrency(uiTotalSaida)}</strong>
              </div>
              <div className="flex flex-col items-center justify-center text-center pb-2 sm:pb-0 border-b sm:border-b-0 sm:border-r border-slate-700/80">
                 <ArrowRightLeft className="h-3 w-3 md:h-5 md:w-5 text-amber-400 mb-1" />
                 <span className="text-slate-400 uppercase tracking-wider text-[8px] md:text-xs">Retornado</span>
                 <strong className="text-xs md:text-lg mt-0.5">{formatCurrency(uiTotalRetorno)}</strong>
              </div>
              <div className="flex flex-col items-center justify-center text-center sm:border-r border-slate-700/80 pt-1 sm:pt-0">
                 <DollarSign className="h-3 w-3 md:h-5 md:w-5 text-red-400 mb-1" />
                 <span className="text-slate-400 uppercase tracking-wider text-[8px] md:text-xs">Consumido</span>
                 <strong className="text-xs md:text-lg text-red-300 mt-0.5">{formatCurrency(uiTotalConsumo)}</strong>
              </div>
              <div className="flex flex-col items-center justify-center text-center pt-1 sm:pt-0">
                 <Plus className="h-3 w-3 md:h-5 md:w-5 text-purple-400 mb-1" />
                 <span className="text-slate-400 uppercase tracking-wider text-[8px] md:text-xs">Extra/Sobra</span>
                 <strong className="text-xs md:text-lg text-purple-300 mt-0.5">{formatCurrency(uiTotalExtra)}</strong>
              </div>
            </div>

            <div className="h-px w-full bg-slate-700/50 hidden sm:block"></div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-2 md:gap-4 text-[10px] md:text-sm font-medium text-slate-300 border-t sm:border-t-0 border-slate-700/50 pt-2 sm:pt-0">
              <div className="flex items-center gap-1.5 justify-center sm:border-r border-slate-700/80">
                 <Package className="h-3 w-3 md:h-4 md:w-4 text-blue-400/70" />
                 <span><strong className="text-white text-xs md:text-base">{uiTotalQtdSaida}</strong> un</span>
              </div>
              <div className="flex items-center gap-1.5 justify-center sm:border-r border-slate-700/80">
                 <Package className="h-3 w-3 md:h-4 md:w-4 text-amber-400/70" />
                 <span><strong className="text-white text-xs md:text-base">{uiTotalQtdRetorno}</strong> un</span>
              </div>
              <div className="flex items-center gap-1.5 justify-center sm:border-r border-slate-700/80">
                 <Package className="h-3 w-3 md:h-4 md:w-4 text-red-400/70" />
                 <span><strong className="text-white text-xs md:text-base">{uiTotalQtdConsumo}</strong> un</span>
              </div>
              <div className="flex items-center gap-1.5 justify-center">
                 <Package className="h-3 w-3 md:h-4 md:w-4 text-purple-400/70" />
                 <span><strong className="text-white text-xs md:text-base">{uiTotalQtdExtra}</strong> un</span>
              </div>
            </div>
          </div>

          <div className="p-3 md:p-6 lg:p-8">
            {!isViewing && (
              <div className="mb-5 md:mb-8 relative z-10 border-b border-border/50 pb-4 md:pb-6">
                <Label className="text-foreground font-bold ml-1 mb-2 md:mb-3 block text-sm md:text-lg">Retornou algum material não listado?</Label>
                <div className="relative group">
                  <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 w-5 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
                  <Input
                    placeholder="Adicionar produto extra..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10 md:pl-12 h-12 md:h-14 rounded-xl md:rounded-2xl border border-border shadow-sm text-sm md:text-base font-medium focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 transition-all bg-card"
                  />
                </div>

                {searchTerm && searchResults.length > 0 && (
                  <Card className="absolute top-full mt-2 left-0 right-0 p-2 shadow-2xl border-border rounded-xl md:rounded-2xl bg-card animate-in fade-in z-50">
                    {searchResults.map(product => (
                      <button
                        key={product.id}
                        onClick={() => handleAddNewItemToReconcile(product)}
                        className="w-full flex items-center justify-between p-2 md:p-3 hover:bg-muted/60 rounded-lg md:rounded-xl transition-all text-left group"
                      >
                        <div className="flex-1 min-w-0 pr-2 md:pr-4">
                          <p className="font-bold md:font-extrabold text-sm md:text-base text-foreground group-hover:text-emerald-600 transition-colors truncate">{product.name}</p>
                          <p className="text-[9px] md:text-xs font-medium text-muted-foreground flex gap-1.5 md:gap-2 items-center">
                            <span className="truncate">{product.sku}</span> <span className="opacity-50 hidden sm:inline">•</span> <span>{formatCurrency(extractValidPrice(product))}</span>
                          </p>
                        </div>
                        <div className="h-6 w-6 md:h-8 md:w-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 shrink-0">
                          <Plus className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground group-hover:text-emerald-600" />
                        </div>
                      </button>
                    ))}
                  </Card>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:gap-4">
              {reconcileItems.map((item) => {
                const out = Number(item.quantity_out);
                const ret = Number(item.returnedQuantity);
                const missing = out - ret;
                
                let diffBadge = <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 font-bold border-0 px-2 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs whitespace-nowrap">Tudo Certo</Badge>;
                if (missing > 0) {
                  diffBadge = <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 font-bold border-0 px-2 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs whitespace-nowrap">Falta {missing}</Badge>;
                } else if (out === 0 && ret > 0) {
                  diffBadge = <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 font-bold border-0 px-2 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs whitespace-nowrap">Extra {ret}</Badge>;
                } else if (missing < 0) {
                  diffBadge = <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 font-bold border-0 px-2 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs whitespace-nowrap">Sobrou {Math.abs(missing)}</Badge>;
                }

                return (
                  <div key={item.product_id} className="p-3 md:p-5 rounded-xl md:rounded-3xl bg-muted/10 hover:bg-muted/30 border border-border/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 w-full group">
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm md:text-lg text-foreground leading-tight">{item.name}</h4>
                      <div className="text-[10px] md:text-sm font-medium text-muted-foreground mt-1.5 md:mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="bg-muted px-1.5 md:px-2 py-0.5 rounded text-foreground">Levou: <strong>{out}</strong> {item.unit}</span>
                        <span className="opacity-50 hidden md:inline">•</span>
                        <span>{formatCurrency(item.price)} un.</span>
                        <span className="opacity-50 hidden md:inline">•</span>
                        <span className="text-slate-600 dark:text-slate-400 font-semibold block w-full md:w-auto mt-0.5 md:mt-0">Total: {formatCurrency(item.price * out)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-2 md:gap-5 w-full md:w-auto bg-muted/30 md:bg-transparent p-2 md:p-0 rounded-lg shrink-0 mt-1 md:mt-0 border md:border-0 border-border/30">
                      <span className="text-[10px] font-bold text-muted-foreground md:hidden uppercase tracking-wider ml-1">Retorno:</span>
                      
                      {isViewing ? (
                        <div className="flex items-center gap-2 md:gap-5">
                          <span className="font-black text-lg md:text-2xl text-foreground bg-background px-2.5 md:px-3 py-0.5 md:py-1 rounded-lg md:rounded-xl shadow-sm border border-border/50">{ret}</span>
                          <div className="w-16 md:w-24 text-right flex justify-end">{diffBadge}</div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 md:gap-5">
                           <div className="flex items-center bg-background rounded-lg md:rounded-xl border border-border overflow-hidden h-9 md:h-14 shadow-inner w-[90px] md:w-[120px]">
                             <button onClick={() => updateReturnedQuantity(item.product_id, Math.max(0, ret - 1))} className="w-8 md:w-12 h-full flex items-center justify-center hover:bg-muted text-foreground transition-colors shrink-0">
                               <Minus className="h-3 w-3 md:h-4 md:w-4" />
                             </button>
                             <Input 
                              type="number" 
                              min="0" 
                              className="h-full w-full p-0 text-center text-sm md:text-xl font-black border-0 focus-visible:ring-0 rounded-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                              value={item.returnedQuantity === 0 && item.quantity_out === 0 ? '' : item.returnedQuantity} 
                              onChange={(e) => updateReturnedQuantity(item.product_id, parseFloat(e.target.value) || 0)}
                             />
                             <button onClick={() => updateReturnedQuantity(item.product_id, ret + 1)} className="w-8 md:w-12 h-full flex items-center justify-center hover:bg-muted text-foreground transition-colors shrink-0">
                               <Plus className="h-3 w-3 md:h-4 md:w-4" />
                             </button>
                           </div>
                          <div className="w-16 md:w-24 text-right flex justify-end">{diffBadge}</div>
                        </div>
                      )}
                    </div>
                    
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* BARRA DE AÇÕES - UI 3 (Acerto de Contas) */}
        {!isViewing && (
          <div className="fixed bottom-16 md:bottom-6 left-0 right-0 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-4xl z-40 p-3 md:p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-4 backdrop-blur-xl bg-background/90 md:bg-background/80 border-t border-border/50 md:border md:rounded-3xl shadow-[0_-10px_20px_-15px_rgba(0,0,0,0.1)] md:shadow-2xl flex justify-center transition-all">
            <div className="w-full flex gap-2 sm:gap-3 md:gap-4">
               <Button variant="outline" onClick={() => setViewMode('list')} className="h-12 md:h-14 w-14 sm:w-24 md:w-32 rounded-xl md:rounded-2xl text-sm md:text-base font-bold border-2 border-border bg-background shadow-sm hover:bg-muted shrink-0 p-0 sm:px-4 transition-all">
                 <ArrowLeft className="h-5 w-5 sm:hidden" />
                 <span className="hidden sm:inline">Voltar</span>
               </Button>
               <Button 
                  onClick={handleConfirmReconcile} 
                  disabled={reconcileOrderMutation.isPending} 
                  className="flex-1 h-12 md:h-14 text-sm sm:text-base md:text-lg font-black rounded-xl md:rounded-2xl bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/30 transition-all active:scale-[0.98] disabled:opacity-50 whitespace-nowrap text-center"
                >
                 {reconcileOrderMutation.isPending ? "A Processar..." : "Fechar Acerto"}
               </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
