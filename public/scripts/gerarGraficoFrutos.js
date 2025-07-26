// gerarGraficoFrutos.js 
// Gera o gráfico dos frutos espirituais com Chart.js e retorna uma imagem em base64
// Uso: import { gerarImagemGrafico } from './gerarGraficoFrutos.js';

import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip
} from 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/+esm';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

export async function gerarImagemGrafico(dados) {
  // Cria canvas invisível, se necessário
  let canvas = document.getElementById("graficoFrutos");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "graficoFrutos";
    canvas.style.display = "none";
    document.body.appendChild(canvas);
  }

  const ctx = canvas.getContext("2d");

  // Carrega JSON com reflexos
  const resposta = await fetch('/data/reflexos_por_fruto_final.json');
  const reflexos = await resposta.json();

  // Prefixos corretos dos frutos na ordem usada no quiz
  const frutos = ['PC', 'AL', 'PA', 'CA', 'CO', 'MA', 'MO', 'FI', 'AM', 'BE', 'BO', 'LO'];

  // Rótulos: nomes dos níveis emocionais personalizados
 const titulos = dados.map((nota, i) => {
  const prefixo = frutos[i];
  const indiceInverso = 12 - nota;
  const bloco = reflexos[prefixo]?.[indiceInverso];
  return bloco?.["Nível Emocional"] || `Nível ${nota}`;
});


  // Cria gráfico
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: titulos,
      datasets: [{
        label: 'Nível Espiritual',
        data: dados.map(v => 13 - v), // Inverte: 12 → 1, 1 → 12
          backgroundColor: dados.map(v =>
          v <= 4 ? '#2563eb' : v <= 7 ? '#facc15' : '#dc2626'
        )

      }]
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        legend: { display: false }
      },
     scales: {
       x: {
          ticks: {
            font: {
               size: 10 // Reduz de padrão 12–14 para 10
            },
            maxRotation: 70,
            minRotation: 40,
            autoSkip: false
         }
      },
      y: {
      beginAtZero: true,
      max: 12
      }
    }

    }
  });

  // Gera imagem final com título
  return new Promise(resolve => {
    setTimeout(() => {
      const img = new Image();
      img.src = canvas.toDataURL("image/png");

      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = 460;
      finalCanvas.height = 460;
      const ctx2 = finalCanvas.getContext("2d");

      ctx2.fillStyle = "#ffffff";
      ctx2.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

      const dadosQuiz = JSON.parse(localStorage.getItem("dadosQuiz") || "{}");
      const nomeCompleto = dadosQuiz.nome || "Buscador";
      const primeiroNome = nomeCompleto.split(" ")[0]; // → "Gustavo"

      ctx2.fillStyle = "#111827";
      ctx2.font = "bold 16px Arial";
      ctx2.fillText(`🔎 ${primeiroNome}, veja o preview gráfico do seu espelho:`, 20, 30);

      img.onload = () => {
        ctx2.drawImage(img, 30, 50, 400, 350);
        resolve(finalCanvas.toDataURL("image/png"));
      };
    }, 500);
  });
}
