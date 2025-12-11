import React, { useState, useEffect } from "react";
import { subscribeToLoading } from "@/services/api";

// --- Utility ---
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

// --- Componente: SVG Spinner (Loader Circular) ---
const SvgSpinner = () => {
  return (
    <div className="relative flex items-center justify-center">
      <style>
        {`
          .svg-loader {
            width: 3.25em;
            transform-origin: center;
            animation: rotate4 2s linear infinite;
          }

          .svg-circle {
            fill: none;
            /* Cor Azul Royal (#1d4ed8 equivale ao blue-700 do Tailwind) */
            stroke: #1d4ed8; 
            stroke-width: 2;
            stroke-dasharray: 1, 200;
            stroke-dashoffset: 0;
            stroke-linecap: round;
            animation: dash4 1.5s ease-in-out infinite;
          }

          @keyframes rotate4 {
            100% {
              transform: rotate(360deg);
            }
          }

          @keyframes dash4 {
            0% {
              stroke-dasharray: 1, 200;
              stroke-dashoffset: 0;
            }
            50% {
              stroke-dasharray: 90, 200;
              stroke-dashoffset: -35px;
            }
            100% {
              stroke-dashoffset: -125px;
            }
          }
        `}
      </style>
      
      {/* Container minimalista */}
      <div className="p-4 bg-white/50 rounded-full backdrop-blur-sm">
        <svg className="svg-loader" viewBox="25 25 50 50">
          <circle className="svg-circle" r="20" cy="50" cx="50"></circle>
        </svg>
      </div>
    </div>
  );
};

// --- Interface das Propriedades (CORRIGIDA) ---
export interface LoadingScreenProps {
  className?: string;
  message?: string; // Adicionado para corrigir o erro do ProtectedRoute
}

export function LoadingScreen({ className, message }: LoadingScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  // Se uma mensagem foi passada via props (ex: pelo ProtectedRoute), 
  // consideramos que o loading deve ser forçado.
  const isForced = !!message;
  
  // O estado final de exibição é: ou está carregando via API, ou está forçado via props
  const shouldShow = isLoading || isForced;

  useEffect(() => {
    // Se estiver forçado via props, não precisa ouvir a API
    if (isForced) return;

    // Conecta com o api.ts para saber quando tem requisição rodando
    const unsubscribe = subscribeToLoading((loadingState) => {
      setIsLoading(loadingState);
    });

    return () => unsubscribe();
  }, [isForced]);

  if (!shouldShow) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col items-center justify-center",
        "bg-white/95 backdrop-blur-xl", // Fundo branco limpo
        "transition-opacity duration-300 ease-in-out",
        className
      )}
    >
      {/* Loader aumentado para destaque */}
      <div className="scale-150 transform mb-6">
        <SvgSpinner />
      </div>

      {/* Texto da mensagem (se houver) */}
      {message && (
        <h2 className="text-blue-700 font-semibold text-lg tracking-wide animate-pulse">
          {message}
        </h2>
      )}
    </div>
  );
}

export default LoadingScreen;