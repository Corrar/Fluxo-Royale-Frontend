// src/components/SupportWidget.tsx
import React, { useState } from 'react';
// Importamos os ícones da biblioteca lucide-react (padrão em projetos com shadcn/ui)
import { HelpCircle, X, AlertCircle, Camera, List, Mail, MessageCircle } from 'lucide-react';

export function SupportWidget() {
  // Estado que controla se a janelinha está aberta (true) ou fechada (false)
  const [isOpen, setIsOpen] = useState(false);

  return (
    // Container fixo no canto inferior direito da tela com z-index alto para ficar por cima de tudo
    <div className="fixed bottom-[100px] lg:bottom-6 right-6 z-[60] flex flex-col items-end">
      
      {/* O PAINEL DE AJUDA - Só aparece se isOpen for true */}
      {isOpen && (
        <div className="bg-background border border-border shadow-xl rounded-xl w-80 sm:w-96 mb-4 overflow-hidden animate-in slide-in-from-bottom-5">
          {/* Cabeçalho do Painel */}
          <div className="bg-primary text-primary-foreground p-4 flex justify-between items-center shadow-sm">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              Central de Ajuda
            </h3>
            {/* Botão de fechar no cabeçalho */}
            <button 
              onClick={() => setIsOpen(false)} 
              className="hover:bg-primary/80 p-1 rounded-full transition-colors"
              aria-label="Fechar ajuda"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Corpo do Painel */}
          <div className="p-5 max-h-[60vh] overflow-y-auto space-y-5 text-sm">
            
            {/* Seção: Como reportar o erro */}
            <div>
              <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-destructive" />
                Encontrou um problema?
              </h4>
              <p className="text-muted-foreground mb-3 leading-relaxed">
                Para que o desenvolvedor possa resolver o problema o mais rápido possível, siga estas dicas ao entrar em contato:
              </p>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex gap-2 items-start bg-secondary/30 p-2 rounded-md">
                  <Camera className="w-5 h-5 mt-0.5 shrink-0 text-primary" />
                  <span><strong>Tire um print (captura de tela):</strong> Uma imagem vale mais que mil palavras! Mostre exatamente a mensagem de erro ou a tela que travou.</span>
                </li>
                <li className="flex gap-2 items-start bg-secondary/30 p-2 rounded-md">
                  <List className="w-5 h-5 mt-0.5 shrink-0 text-primary" />
                  <span><strong>Descreva o passo a passo:</strong> Conte o que você clicou ou digitou instantes antes do erro acontecer.</span>
                </li>
              </ul>
            </div>
            
            <hr className="border-border" />
            
            {/* Seção: Canais de Contato */}
            <div>
              <h4 className="font-semibold text-foreground mb-2">Falar com o Suporte</h4>
              <div className="flex flex-col gap-2 mt-3">
                {/* IMPORTANTE: Altere o link abaixo com o seu número de WhatsApp real */}
                <a 
                  href="https://wa.me/5518998126464?text=Olá, encontrei um problema no sistema Fluxo Royale." 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white p-2.5 rounded-md transition-colors justify-center font-medium shadow-sm"
                >
                  <MessageCircle className="w-5 h-5" />
                  Chamar no WhatsApp
                </a>
                
                {/* IMPORTANTE: Altere o link abaixo com o seu e-mail real */}
                <a 
                  href="mailto:brunocorral@royaleavicultura.com.br?subject=Reportar Erro - Fluxo Royale" 
                  className="flex items-center gap-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground p-2.5 rounded-md transition-colors justify-center font-medium shadow-sm"
                >
                  <Mail className="w-5 h-5" />
                  Enviar um E-mail
                </a>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* O BOTÃO FLUTUANTE (Bolinha fixa) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${
          isOpen 
            ? 'bg-secondary text-secondary-foreground' 
            : 'bg-primary text-primary-foreground'
        } p-4 rounded-full shadow-2xl hover:scale-105 transition-all duration-300 flex items-center justify-center`}
        aria-label="Abrir ajuda"
      >
        {isOpen ? <X className="w-6 h-6" /> : <HelpCircle className="w-6 h-6" />}
      </button>
    </div>
  );
}
