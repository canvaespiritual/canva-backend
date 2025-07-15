import { nomesFrutos } from './frutas.js';

// Gera uma imagem base64 com os reflexos do fruto mais degradante
export async function gerarImagemReflexoFruto(notas) {
  // 1. Identifica a menor nota
  const menorNota = Math.min(...notas);

  // 2. Último índice que possui essa nota
  const indice = notas.lastIndexOf(menorNota);
  const codigoFruto = nomesFrutos[indice]; // ex: "Benignidade"
  const prefixo = codigoFruto.slice(0, 2).toUpperCase();

  // 3. Carrega os reflexos do JSON
  const resposta = await fetch('/data/reflexos_por_fruto_final.json');
  const dadosReflexo = await resposta.json();
  const bloco = dadosReflexo[prefixo]?.[menorNota - 1];

  if (!bloco) return null;

  // 4. Criar canvas
  const canvas = document.createElement('canvas');
  canvas.width = 360;
  canvas.height = 420;
  canvas.style.borderRadius = "12px";
  canvas.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
  canvas.style.backgroundColor = "#ffffff";
  canvas.style.padding = "16px";
  const ctx = canvas.getContext('2d');

  // Fundo
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Título
  ctx.fillStyle = '#dc2626';
  ctx.font = 'bold 16px Arial';
  ctx.fillText('Reflexos da Vibração - Preview parcial', 20, 30);

  // Subtítulo com Fruto e Nível
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 14px Arial';
  ctx.fillText(`Fruto: ${codigoFruto} – Nível: ${bloco["Nível Emocional"]}`, 20, 60);

  let y = 90;
  const blocosTexto = [
    { titulo: "🧠 Emoção detectada", texto: bloco["Nível Emocional"] },
  { titulo: "🧾 Diagnóstico", texto: bloco["Diagnóstico Emocional"] },
  { titulo: "🔍 Descrição do estado da alma", texto: bloco["Descrição do Estado da Alma"] },
  { titulo: "🏠 Vida Familiar", texto: bloco["Exemplo Vida Familiar"] },
  { titulo: "🤝 Vida Social", texto: bloco["Exemplo Vida Social"] },
  { titulo: "💼 Vida Profissional", texto: bloco["Exemplo Vida Profissional"] },
  { titulo: "🧘‍♂️ Exercício de Elevação", texto: bloco["Exercício de Elevação"] }
  ];

  for (const bloco of blocosTexto) {
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 12px Arial';
    ctx.fillText(`${bloco.titulo}:`, 20, y);
    y += 16;

    ctx.font = '12px Arial';
    const linhas = quebrarTexto(ctx, bloco.texto, 360);
    for (const linha of linhas) {
      ctx.fillText(linha, 20, y);
      y += 15;
    }

    y += 10;
  }

  return canvas.toDataURL("image/png");
}

// Utilitário para quebra de texto
function quebrarTexto(ctx, texto, larguraMax) {
  const palavras = texto.split(' ');
  const linhas = [];
  let linhaAtual = '';

  for (const palavra of palavras) {
    const teste = linhaAtual + palavra + ' ';
    const largura = ctx.measureText(teste).width;
    if (largura > larguraMax && linhaAtual) {
      linhas.push(linhaAtual.trim());
      linhaAtual = palavra + ' ';
    } else {
      linhaAtual = teste;
    }
  }

  if (linhaAtual) linhas.push(linhaAtual.trim());
  return linhas;
}
