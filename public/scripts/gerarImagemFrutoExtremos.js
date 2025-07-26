// gerarImagemFrutoExtremos.js
// Gera imagem comparativa com ponto de atenção e ponto de luz

import { nomesFrutos } from './frutas.js';

// Converte nota de 1 a 13 em percentual (0% a 100%)
function notaParaPorcentagem(nota) {
  return Math.round(((12 - nota) / 11) * 100); // 12 é virtuoso (0%), 1 é degradante (100%)
}


// Gera imagem com ponto mais crítico (vermelho) e mais elevado (azul)
export function gerarImagemFrutosExtremos(notas) {
 const notaDegradante = Math.max(...notas); // 12 é o mais baixo
const notaVirtuosa = Math.min(...notas);   // 1 é o mais elevado

const indiceCritico = notas.lastIndexOf(notaDegradante);
const indiceLuz = notas.indexOf(notaVirtuosa);


  const nomeCritico = nomesFrutos[indiceCritico];
  const nomeLuz = nomesFrutos[indiceLuz];

  const percentualCritico = notaParaPorcentagem(notaDegradante);
const percentualLuz = notaParaPorcentagem(notaVirtuosa);


  const canvas = document.createElement('canvas');
  canvas.width = 360;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');

  // Fundo
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Título
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 14px Arial';
  ctx.fillText("🔍 Seus extremos espirituais", 20, 30);

  // Ponto de atenção (vermelho)
  ctx.fillStyle = '#dc2626';
  ctx.font = 'bold 12px Arial';
  ctx.fillText(`🔴 Ponto de atenção: ${nomeCritico}`, 20, 60);
  ctx.fillRect(20, 75, percentualCritico * 2.5, 10);
  ctx.fillText(`${percentualCritico}%`, 20, 100);

  // Ponto de luz (azul)
  ctx.fillStyle = '#2563eb';
  ctx.font = 'bold 12px Arial';
  ctx.fillText(`🔵 Ponto de luz: ${nomeLuz}`, 20, 140);
  ctx.fillRect(20, 155, percentualLuz * 2.5, 10);
  ctx.fillText(`${percentualLuz}%`, 20, 180);

  return canvas.toDataURL("image/png");
}
