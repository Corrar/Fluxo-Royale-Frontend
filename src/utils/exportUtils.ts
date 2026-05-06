import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { format } from "date-fns";

// --- EXPORTAR PARA EXCEL ---
export const exportToExcel = (
  data: any[], 
  fileName: string, 
  columns?: { header: string; dataKey: string }[] // <-- Adicionámos as colunas como opcional
) => {
  const fileType =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8";
  const fileExtension = ".xlsx";

  // 1. Formatação dos Dados (A grande novidade!)
  // Vamos criar uma variável para guardar os dados finais que vão para o Excel
  let dataToExport = data;

  // Se o utilizador enviou a configuração das colunas, vamos formatar os dados
  if (columns) {
    dataToExport = data.map((row) => {
      // Criamos um objeto vazio para a nova linha
      const formattedRow: any = {};
      
      // Para cada coluna configurada, vamos buscar o valor correto
      columns.forEach((col) => {
        const val = row[col.dataKey];
        // Se for um objeto, transformamos em texto. Caso contrário, guardamos o valor.
        formattedRow[col.header] = (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val;
      });
      
      return formattedRow; // Retornamos a linha bonitinha!
    });
  }

  // 2. Cria a planilha usando os dados formatados
  const ws = XLSX.utils.json_to_sheet(dataToExport);
  const wb = { Sheets: { data: ws }, SheetNames: ["data"] };
  
  // 3. Gera o buffer
  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  
  // 4. Salva o arquivo
  const dataBlob = new Blob([excelBuffer], { type: fileType });
  saveAs(dataBlob, fileName + "_" + format(new Date(), "yyyy-MM-dd") + fileExtension);
};

// --- EXPORTAR PARA PDF ---
// A tua função de PDF já estava ótima, mantivemos exatamente igual!
export const exportToPDF = (
  title: string,
  columns: { header: string; dataKey: string }[],
  data: any[],
  fileName: string
) => {
  const doc = new jsPDF();

  // 1. Cabeçalho do PDF (Título e Data)
  doc.setFontSize(18);
  doc.setTextColor(40);
  doc.text(title, 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 30);
  doc.text("Sistema: Fluxo Royale", 14, 35);

  // 2. Configuração da Tabela
  // Mapeia os dados para garantir que a ordem das colunas seja respeitada
  const tableBody = data.map((row) =>
    columns.map((col) => {
        // Tratamento especial para objetos ou valores nulos
        const val = row[col.dataKey];
        if (typeof val === 'object' && val !== null) return JSON.stringify(val);
        return val || "-";
    })
  );

  // Extrai apenas os titulos das colunas para o autotable
  const tableHead = [columns.map(c => c.header)];

  // 3. Gera a Tabela
  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    startY: 40,
    theme: 'grid', // 'striped', 'grid', 'plain'
    styles: {
        fontSize: 8,
        cellPadding: 3,
    },
    headStyles: {
        fillColor: [41, 128, 185], // Azul
        textColor: 255,
        fontStyle: 'bold'
    },
    alternateRowStyles: {
        fillColor: [245, 245, 245]
    }
  });

  // 4. Salva o arquivo
  doc.save(`${fileName}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
};
