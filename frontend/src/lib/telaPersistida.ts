import { useEffect, useState } from 'react';

/** O Chatfast recria o iframe: filtros e período sobrevivem no sessionStorage. */
const chaveDaTela = (chave: string) => `consumo-meta:tela:${window.location.pathname}${window.location.search}:${chave}`;

export function telaPersistida<T>(chave: string, inicial: T) {
  const k = chaveDaTela(chave);
  const [valor, setValor] = useState<T>(() => {
    try {
      const salvo = sessionStorage.getItem(k);
      return salvo ? (JSON.parse(salvo) as T) : inicial;
    } catch {
      return inicial;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(k, JSON.stringify(valor));
    } catch {
      // sessionStorage bloqueado (iframe de terceiro): segue só em memória.
    }
  }, [k, valor]);
  return [valor, setValor] as const;
}
