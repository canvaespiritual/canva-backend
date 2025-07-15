// gerarSlidesCarrossel.js
// Gera os 3 slides personalizados do carrossel (gráfico, extremos, reflexo)

// IMPORTAÇÕES
import { gerarImagemGrafico } from './gerarGraficoFrutos.js';
import { gerarImagemFrutosExtremos } from './gerarImagemFrutoExtremos.js';
import { gerarImagemReflexoFruto } from './gerarImagemReflexoFruto.js';
import { initSwiper } from './swiperInit.js';
import { nomesFrutos } from './frutas.js';

export async function carregarCarrossel() {
  console.log("🟢 carregarCarrossel iniciado");

  const dados = JSON.parse(localStorage.getItem("frutos")) || [];
  console.log("🧠 Dados carregados do localStorage:", dados);

  // === SLIDE 1: GRÁFICO GERAL ===
  try {
    const imagemGrafico = await gerarImagemGrafico(dados);
    console.log("📊 imagemGrafico gerada:", imagemGrafico?.slice(0, 50));
    adicionarSlide(imagemGrafico);
  } catch (err) {
    console.error("❌ Erro ao gerar imagem do gráfico:", err);
  }

  // === SLIDE 2: EXTREMOS (Virtude e Ponto Crítico) ===
  try {
    const imagemExtremos = gerarImagemFrutosExtremos(dados);
    console.log("🟰 imagemFrutosExtremos:", imagemExtremos?.slice(0, 50));
    adicionarSlide(imagemExtremos);
  } catch (err) {
    console.error("❌ Erro ao gerar imagem dos extremos:", err);
  }


  // === SLIDE 3: Reflexos do Fruto Degradante ===
  try {
    const imagemReflexo = await gerarImagemReflexoFruto(dados);
    console.log("📜 imagemReflexo:", imagemReflexo?.slice(0, 50));
    if (imagemReflexo) adicionarSlide(imagemReflexo);
  } catch (err) {
    console.error("❌ Erro ao gerar imagem do reflexo:", err);
  }

  console.log("✅ Finalizando carregamento e iniciando Swiper");
  document.getElementById("loader").classList.add("hidden");
  document.getElementById("carrosselDiagnostico").classList.remove("hidden");
  initSwiper();
}

// Utilitário para adicionar slide
function adicionarSlide(src) {
  const wrapper = document.getElementById("swiperWrapper");

  if (!src || typeof src !== "string") {
    console.error("❌ Slide inválido. src não é uma string válida:", src);
    return;
  }

  const slide = document.createElement("div");
  slide.classList.add("swiper-slide", "flex", "justify-center");

  const img = new Image();
  img.src = src;
  img.alt = "Prévia do Diagnóstico";
  img.classList.add("rounded-lg", "shadow-md", "max-w-xs");

  img.onload = () => {
  slide.appendChild(img);
  wrapper.appendChild(slide);
  console.log("✅ Slide adicionado com sucesso.");
  };


  img.onerror = () => {
    console.error("⚠️ Erro ao carregar imagem do slide:", src);
  };
}
