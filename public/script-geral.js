

const transicoes = [
  "🌞 Agora, sinta a luz da sua alegria interior.",
  "🌬️ Vamos agora tocar a essência da sua paz.",
  "🔥 Agora, mergulhe na forma como você lida com seus desejos.",
  "⚖️ Vamos investigar seu autocontrole e moderação.",
  "🕊️ Agora, veja como se posiciona: com força ou com mansidão?",
  "🎭 Agora, contemple como você se revela ao mundo.",
  "🤝 Agora, perceba como honra seus vínculos e promessas.",
  "💖 Vamos ao centro: sua capacidade de amar.",
  "🌱 Agora, veja como sua intenção se traduz em atos.",
  "🤲 Vamos agora enxergar como ela se manifesta em ações reais.",
  "⏳ Agora, contemple sua constância ao longo do tempo."
];

const detalhesFrutos = window.detalhesFrutos || {};
const respostas = [];
const perguntas = [
  { titulo: "⏳ Como está sua energia de paciência diante da vida?", codigos: ["PC01", "PC02", "PC03", "PC04", "PC05", "PC06", "PC07", "PC08", "PC09", "PC10", "PC11", "PC12"], opcoes: ["🧁 Paciência Mártir", "🌿 Paciência Sagrada", "💪 Perseverança", "👍 Tolerância Ativa", "🥀 Resiliência Calma", "☺️ Neutralidade", "💪 Tolerância Cansada", "😡 Impaciência Contida", "😠 Irritação Ativa", "❗ Intolerância", "😡 Impaciência Agressiva", "❌ Ira Autodestrutiva"] },
   { titulo: "🎉 Como você sente a alegria vibrando dentro de você?", codigos: ["AL01", "AL02", "AL03", "AL04", "AL05", "AL06", "AL07", "AL08", "AL09", "AL10", "AL11", "AL12"], opcoes: ["🌟 Alegria Celestial", "💫 Alegria Espontânea", "🌈 Entusiasmo Autêntico", "🌺 Satisfação Serena", "🌞 Contentamento", "😐 Alegria Neutra", "😔 Alegria Mecânica", "😓 Desinteresse", "😞 Tristeza Latente", "😢 Lamentação", "😭 Sofrimento Contido", "😱 Desespero"] },
      { titulo: "🌳 Como você sente a paz interior diante do que te cerca?", codigos: ["PA01", "PA02", "PA03", "PA04", "PA05", "PA06", "PA07", "PA08", "PA09", "PA10", "PA11", "PA12"], opcoes: ["🌿 Paz Celestial", "🕊 Paz Contagiante", "🌤 Paz Profunda", "🍃 Paz com Flutuações", "📅 Paz Pragmática", "⚪ Zona Neutra", "❓ Inquietação Sutil", "😐 Aparentemente Tranquilo", "🌪 Turbulência Interna", "⚠️ Conflito Emocional", "😡 Tensão Constante", "❌ Guerra Interior"] },
      { titulo: "🪩 Como você lida com seus desejos, instintos e pureza interior?", codigos: ["CA01", "CA02", "CA03", "CA04", "CA05", "CA06", "CA07", "CA08", "CA09", "CA10", "CA11", "CA12"], opcoes: ["💖 Castidade Consagrada", "🤍 Desejo Sublimado", "🌺 Pureza Prática", "🍄 Instinto Refinado", "🔧 Equilíbrio Sexual", "🌌 Zona de Contenção", "😏 Luta com o Prazer", "😋 Desejo Contido", "😳 Desejo Reprimido", "🚫 Uso Impulsivo", "😈 Vício Emocional", "❌ Liberação Descontrolada"] },
      { titulo: "🌬 Como você lida com a moderação dos seus impulsos e exageros?", codigos: ["CO01", "CO02", "CO03", "CO04", "CO05", "CO06", "CO07", "CO08", "CO09", "CO10", "CO11", "CO12"], opcoes: ["🥁 Continência Consagrada", "🥛 Moderação Intuitiva", "🌿 Equilíbrio Consciente", "📏 Domínio Inicial", "⚠️ Esforço de Contenção", "⚪ Neutralidade Oscilante", "🍺 Impulso Controlado", "🤢 Exagero Ocasional", "😔 Descontrole Moderado", "😠 Impulsividade Frequente", "😈 Compulsão Ativa", "❌ Excesso Autodestrutivo"] },
      { titulo: "⚖️ Como está seu governo interno diante dos seus desejos, palavras e impulsos?", codigos: ["MA01", "MA02", "MA03", "MA04", "MA05", "MA06", "MA07", "MA08", "MA09", "MA10", "MA11", "MA12"], opcoes: ["🔮 Domínio Virtuoso", "🌿 Disciplina em Paz", "🤓 Consciência Ativa", "🌺 Vontade Alinhada", "📆 Autocontrole em Treinamento", "🥵 Zona de Oscilação", "🌪 Reação Intermitente", "😐 Comando Instável", "❓ Dificuldade de Contenção", "😡 Falta de Autocontrole", "🤬 Impulsividade Ativa", "❌ Governo Interno Quebrado"] },
      { titulo: "🧔 Como você expressa sua identidade e valor pessoal diante do mundo?", codigos: ["MO01", "MO02", "MO03", "MO04", "MO05", "MO06", "MO07", "MO08", "MO09", "MO10", "MO11", "MO12"], opcoes: ["🌟 Modéstia Sagrada", "🦄 Humildade Verdadeira", "🙏 Simplicidade Genuína", "🌈 Discrição Positiva", "🕵️ Valor Interno Estável", "⚪ Presença Neutra", "🤦 Vaidade Disfarçada", "😎 Autoimagem Controlada", "🌚 Desejo de Aplauso", "😏 Soberba Sutil", "😊 Vaidade Exibida", "😱 Egocentrismo Declarado"] },
      { titulo: "🔍 Como você se compromete com o que acredita e com quem se relaciona?", codigos: ["FI01", "FI02", "FI03", "FI04", "FI05", "FI06", "FI07", "FI08", "FI09", "FI10", "FI11", "FI12"], opcoes: ["🌟 Fidelidade Espiritual", "🤝 Comprometimento Verdadeiro", "🧳 Lealdade Serena", "📅 Constância Emocional", "💭 Palavra Alinhada", "⚪ Zona de Transição", "😏 Oscilação de Promessas", "📉 Instabilidade de Compromisso", "😓 Fuga de Responsabilidade", "😡 Infidelidade Emocional", "😈 Traição Ativa", "❌ Ruptura com Valores"] },
      { titulo: "💖 Como você manifesta o amor em suas atitudes e relações?", codigos: ["AM01", "AM02", "AM03", "AM04", "AM05", "AM06", "AM07", "AM08", "AM09", "AM10", "AM11", "AM12"], opcoes: ["💫 Amor Divino", "🌿 Amor Altruísta", "🙏 Amor Compassivo", "🤝 Amor Responsável", "🌺 Cuidado Recíproco", "⚪ Zona Neutra", "😐 Indiferença Afetiva", "😓 Afeto Condicional", "😠 Rejeição Velada", "😡 Amor Controlador", "😈 Manipulação Emocional", "❌ Amor Tóxico"] },
      { titulo: "🌿 Como você lida com a sua intenção de fazer o bem?", codigos: ["BE01", "BE02", "BE03", "BE04", "BE05", "BE06", "BE07", "BE08", "BE09", "BE10", "BE11", "BE12"], opcoes: ["💖 Benignidade Celestial", "🤝 Bondade Intuitiva", "💜 Benevolência Constante", "🌈 Ajuda Generosa", "🌺 Colaboração Empática", "⚪ Zona Neutra", "😐 Ajuda forçada", "😓 Benignidade Condicional", "😞 Frieza Moral", "😡 Negligência Ativa", "😈 Maldade Oculta", "❌ Intenção Destrutiva"] },
      { titulo: "💚 Como você expressa gentileza, compaixão e cuidado nas relações?", codigos: ["BO01", "BO02", "BO03", "BO04", "BO05", "BO06", "BO07", "BO08", "BO09", "BO10", "BO11", "BO12"], opcoes: ["🤍 Bondade Amorosa", "💜 Delicadeza Presente", "🌺 Cuidado Gentil", "😊 Empatia Ativa", "🙏 Compaixão Verdadeira", "⚪ Zona Neutra", "😐 Cordialidade Superficial", "😓 Gentileza com Interesse", "😠 Irritação com o Outro", "😡 Agressividade Sutil", "😈 Crueldade Passiva", "❌ Maldade Declarada"] },
      { titulo: "⏳ Como você reage aos processos que demoram e exigem perseverança?", codigos: ["LO01", "LO02", "LO03", "LO04", "LO05", "LO06", "LO07", "LO08", "LO09", "LO10", "LO11", "LO12"], opcoes: ["🕊 Longanimidade Celestial", "💚 Perseverança Serena", "🙏 Constância Amorosa", "🌿 Espera Confiante", "🌧 Esperança Ativa", "⚪ Zona Neutra", "😐 Resistência Silenciosa", "😓 Impaciência Oculta", "😞 Desânimo Recorrente", "😡 Revolta com o Tempo", "😈 Sabotagem Emocional", "❌ Desistência Espiritual"] }
    ];

// Índices originais que vamos manter (0-based): 0,2,4,6,8,10,12
const OPT_IDX = [0, 2, 4, 6, 8, 9, 11,];

// Aplica o filtro em TODAS as 12 perguntas, sem alterar códigos nem ordem
for (let i = 0; i < perguntas.length; i++) {
  const p = perguntas[i];
  if (!p || !Array.isArray(p.codigos) || !Array.isArray(p.opcoes)) continue;

  const novosCodigos = [];
  const novasOpcoes  = [];

  OPT_IDX.forEach(j => {
    if (p.codigos[j] !== undefined && p.opcoes[j] !== undefined) {
      novosCodigos.push(p.codigos[j]);
      novasOpcoes.push(p.opcoes[j]);
    }
  });

  perguntas[i] = {
    titulo: p.titulo,
    codigos: novosCodigos,
    opcoes: novasOpcoes
  };
}



function gerarImagemZona(zona, classe = "w-48 h-48 mx-auto rounded") {
  return `
    <picture>
      <source srcset="./assets/imagens/zona_${zona}.webp" type="image/webp" />
      <img src="./assets/imagens/zona_${zona}.png" alt="Zona ${zona}" class="${classe}" loading="lazy" />
    </picture>
  `;
}
function calcularMedia(lista) {
  let soma = 0;
  lista.forEach(codigo => {
    const nivel = parseInt(codigo.slice(-2));
    soma += nivel;
  });
  return Math.round(soma / lista.length);
}
const frasesEstimulo = [
  "🧭 Escolha com sinceridade. Sua resposta não será julgada.",
  "🤔 É natural sentir dúvida. Confie na primeira sensação.",
  "🌿 Não existe resposta perfeita — existe a sua verdade.",
  "🧘 Não pense demais. Apenas sinta.",
  "🌱 Você está fazendo algo por si mesmo. Isso já é raro.",
  "💡 Seja honesto com o que sente — não com o que espera ser.",
  "⚖️ Aqui não há certo ou errado, apenas vibração.",
  "🌊 O seu reflexo muda quando você é sincero com ele.",
  "🔍 O autoconhecimento começa pela coragem de se ver.",
  "✨ Você está mais perto da verdade do que imagina.",
  "🎭 Nenhuma máscara precisa acompanhar você aqui.",
  "🕊️ Esta é uma conversa entre você... e sua alma."
];


function mostrarPergunta(index) {
  window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('intro').classList.add('hidden');

  // 🔁 Remove qualquer barra de progresso existente
  document.querySelectorAll('#barra-container').forEach(b => b.remove());

  // ✅ Cria a barra de progresso para qualquer pergunta (index >= 0)
  if (index >= 0) {
    const barraHTML = `
      <div id="barra-container" class="w-full">
        <div class="relative w-full max-w-2xl mx-auto bg-gray-200 rounded h-4 mt-8 mb-6">
          <div id="progresso" class="bg-blue-600 h-full rounded transition-all duration-300" style="width: 0%;"></div>
          <span id="porcentagem" class="absolute right-0 -top-7 text-sm text-gray-600 pr-2">0%</span>
        </div>
      </div>
    `;
    const container = document.getElementById('quiz-container');
    container.insertAdjacentHTML('beforebegin', barraHTML);
  }

  // 🎧 Mostra o aviso de som na primeira pergunta
  if (index === 0) {
    const aviso = document.createElement('div');
    aviso.id = "avisoSom";
    aviso.className = "fixed top-5 left-1/2 transform -translate-x-1/2 z-50 bg-white bg-opacity-90 px-4 py-2 rounded shadow text-sm text-gray-800 animate-fade";
    aviso.textContent = "🧘 Para uma experiência mais imersiva, ative o som ambiente.";
    document.body.appendChild(aviso);

    setTimeout(() => {
      aviso.remove();
    }, 6000);
  }

  // 🔄 Remove blocos de pergunta anteriores
  document.querySelectorAll('section[id^="pergunta-"]').forEach(s => s.remove());

  const p = perguntas[index];
  const div = document.createElement('section');
  const blocoEspelho = gerarEspelhoAnterior(index);
  div.id = `pergunta-${index}`;
  div.className = "max-w-2xl mx-auto p-6 space-y-4";
  div.innerHTML = blocoEspelho + `
    <h2 class="text-lg md:text-xl font-semibold max-w-md mx-auto leading-snug">${p.titulo}</h2>
    <p class="text-sm text-gray-600 max-w-md mx-auto" id="frase-estimulo">
    ${frasesEstimulo[index]}
    </p>

      <div class="flex flex-col gap-3">

  ${p.codigos.map((c, i) => {
    const codigo = p.codigos[i];
    const d = detalhesFrutos[codigo];
    const textoDescricao = d?.descricao || "";

    return `<button class="opcao bg-gray-100 hover:bg-blue-100 p-3 rounded text-left h-full w-full flex flex-col justify-between" data-codigo="${c}">
      ${p.opcoes[i]} <br><span class="text-xs text-gray-500">(${textoDescricao})</span>
    </button>`;
  }).join('')}
</div>


    </div>
    ${index < perguntas.length - 1
  ? `<p class="text-sm text-gray-700 mt-4 mb-2 italic">${transicoes[index]}</p>
     <button onclick="avancar(${index})" class="px-5 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 w-full max-w-xs transition">
       Próxima pergunta →
     </button>`
  : `<button onclick="avancar(${index})" class="mt-4 px-5 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 w-full max-w-xs transition">
       Finalizar e Avançar ✔
     </button>`}


  `;

  document.getElementById('quiz-container').appendChild(div);

  // 🪞 Remoção do espelho anterior (5s após carregamento)
  const img = div.querySelector("#bloco-paciencia img");
  if (img) {
    const iniciarRemocao = () => {
      setTimeout(() => {
        const bloco = document.getElementById("bloco-paciencia");
        if (bloco) bloco.remove();
      }, 5000);
    };

    if (img.complete) {
      iniciarRemocao();
    } else {
      img.onload = iniciarRemocao;
    }
  } else {
    setTimeout(() => {
      const bloco = document.getElementById("bloco-paciencia");
      if (bloco) bloco.remove();
    }, 5000);
  }

  // 🟦 Atualiza a barra se ela existe
  if (document.getElementById('progresso')) {
    atualizarBarra(index);
  }

  // 🟢 Adiciona eventos de clique nas opções
  document.querySelectorAll('.opcao').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.parentNode.querySelectorAll('.opcao').forEach(b => b.classList.remove('bg-blue-200'));
      btn.classList.add('bg-blue-200');
      const codigo = btn.getAttribute('data-codigo');
      respostas[index] = codigo;
    });
  });
}

function atualizarBarra(index) {
  const total = perguntas.length;
  const percentual = Math.floor(((index + 1) / total) * 100);
  document.getElementById('progresso').style.width = percentual + '%';
  document.getElementById('porcentagem').textContent = percentual + '%';
}

function avancar(index) {
  if (!respostas[index]) {
    alert("Por favor, selecione uma opção antes de continuar.");
    return;
  }

  if (index < perguntas.length - 1) {
    mostrarPergunta(index + 1);
  } else {
    mostrarFormulario();
  }
}
function gerarEspelhoAnterior(index) {
  if (index === 0) return '';

  const codigo = respostas[index - 1];
  if (!codigo) return '';

  const zona = determinarZona(codigo);
  const percentual = mapearPercentual(codigo);
  const fruto = identificarFruto(codigo);  
  const detalhe = detalhesFrutos[codigo];
  const mensagemZona = detalhe?.diagnostico || "⚠️ Estado emocional não encontrado.";



  // Emojis por zona
  const icones = {
    virtude: "🌟",
    transicao: "⏳",
    degradacao: "🔥"
  };
  const iconeZona = icones[zona];

 return `
    <div id="bloco-paciencia" class="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-[#fefce8] border border-yellow-500 rounded-xl shadow-lg px-4 py-4 w-[90%] max-w-md text-center animate-fade">
      <div class="flex flex-col items-center justify-center space-y-2 mb-2">
        <picture>
          <source srcset="./assets/icones/${fruto}_${zona}.webp" type="image/webp" />
          <img src="./assets/icones/${fruto}_${zona}.png" class="w-20 h-20" alt="Ícone espiritual de ${fruto}">
        </picture>
        <p class="text-[13px] text-gray-700 font-medium">${mensagemZona}</p>
      </div>
      <p class="text-sm text-gray-800 font-semibold mt-2">Sua ${fruto} está em <span class="text-yellow-600">${percentual}%</span></p>
      <div class="relative w-full h-4 mt-4 mb-2 rounded bg-gradient-to-r from-red-500 via-white to-blue-600">
        <div class="absolute top-[-9px] left-[${percentual}%] transform -translate-x-1/2 z-10 text-2xl animate-pulse">
          ${iconeZona}
        </div>
      </div>
      <p class="text-xs text-gray-500 mt-2 italic">Zona ${zona.charAt(0).toUpperCase() + zona.slice(1)}</p>
    </div>
  `;
}

function determinarZona(codigo) {
  const nivel = parseInt(codigo.slice(-2)); // últimos 2 dígitos
  if (nivel <= 4) return 'virtude';
  if (nivel <= 8) return 'transicao';
  return 'degradacao';
}

function mapearPercentual(codigo) {
  const nivel = parseInt(codigo.slice(-2));
  return Math.floor(((13 - nivel) / 12) * 100);
}

function identificarFruto(codigo) {
  const prefixo = codigo.slice(0, 2); // ex: 'PC', 'AL'
  const mapa = {
    PC: "paciência",
    AL: "alegria",
    PA: "paz",
    CA: "castidade",
    CO: "continência",
    MA: "domínio",
    MO: "modéstia",
    FI: "fidelidade",
    AM: "amor",
    BE: "benignidade",
    BO: "bondade",
    LO: "longanimidade"
  };
  return mapa[prefixo] || "fruto";
}
// 🔄 Loader global (overlay + spinner)
function showLoader(msg = "Processando...") {
  if (!document.getElementById("loader-style")) {
    const s = document.createElement("style");
    s.id = "loader-style";
    s.textContent = "@keyframes spin{to{transform:rotate(360deg)}}";
    document.head.appendChild(s);
  }
  let el = document.getElementById("globalLoader");
  if (!el) {
    el = document.createElement("div");
    el.id = "globalLoader";
    el.setAttribute("role", "alert");
    el.style.cssText = "position:fixed;inset:0;background:rgba(17,24,39,.55);display:flex;align-items:center;justify-content:center;z-index:9999";
    el.innerHTML = `
      <div style="background:#fff;padding:20px 24px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,.2);display:flex;gap:12px;align-items:center;min-width:260px;">
        <div style="width:28px;height:28px;border:3px solid #e5e7eb;border-top-color:#0ea5e9;border-radius:50%;animation:spin 1s linear infinite;"></div>
        <div id="globalLoaderText" style="font:600 14px/20px system-ui,-apple-system,Segoe UI,Roboto">` + msg + `</div>
      </div>`;
    document.body.appendChild(el);
  } else {
    document.getElementById("globalLoaderText").textContent = msg;
  }
}
function hideLoader() {
  const el = document.getElementById("globalLoader");
  if (el) el.remove();
}

  document.addEventListener("DOMContentLoaded", () => {
       // 🚀 Começa o quiz automaticamente na primeira pergunta
  if (typeof quizStart === "function") {
    quizStart();          // dispara seus eventos (Pixel, etc.)
  }
  mostrarPergunta(0);     // renderiza a PERGUNTA 1 direto

   setTimeout(() => {
  const audio = document.getElementById("musicaAmbiente");
  const botao = document.getElementById("botaoSom");
  const slider = document.getElementById("volumeSlider");
  const controle = document.getElementById("controleSom");

  if (audio && botao && slider && controle) {
    audio.volume = 0.1;
    audio.play().catch(() => {});
    controle.classList.remove("opacity-0");
    botao.classList.add("animate-pulse");

// Após 6 segundos, para de piscar e reduz opacidade
setTimeout(() => {
  botao.classList.remove("animate-pulse");
  botao.classList.add("opacity-30");
}, 6000);


    // Apenas alterna visual do slider (não muda volume)
    botao.addEventListener("click", () => {
      slider.classList.toggle("hidden");
    });

    // O slider controla o volume e muda o ícone
    slider.addEventListener("input", () => {
      const volume = parseFloat(slider.value);
      audio.volume = volume;

      if (volume === 0) {
        botao.textContent = "🔇";
      } else {
        botao.textContent = "🔊";
      }
    });
  }
}, 5000);


document.addEventListener("click", async (e) => {
  if (e.target.id !== "btn-diagnostico") return;

  const btn = e.target;
  btn.disabled = true;
  btn.style.opacity = "0.7";
  btn.style.cursor = "not-allowed";

  try {
    const nome = document.getElementById("nome")?.value?.trim() || "Desconhecido";
    const email = document.getElementById("email")?.value?.trim();

    if (!email || respostas.length !== perguntas.length) {
      btn.disabled = false;
      btn.style.opacity = "";
      btn.style.cursor = "";
      document.getElementById("mensagem").textContent =
        "Informe seu e-mail para continuar.";
      return;
    }

    const notas = respostas.map(codigo => parseInt(codigo.slice(-2)));
    const dados = { nome, email, respostas };

    localStorage.setItem("frutos", JSON.stringify(notas));
    localStorage.setItem("dadosQuiz", JSON.stringify(dados));

    const session_id = "sessao-" + Date.now();
    localStorage.setItem("session_id", session_id);

    showLoader("Salvando seus dados...");

    const resp = await fetch("/api/salvar-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id, nome, email, respostas: notas })
    });

    if (!resp.ok) {
      const msg = await resp.text();
      throw new Error(msg || "Falha no servidor.");
    }

    showLoader("Redirecionando ao checkout...");

const qs = new URLSearchParams(window.location.search);
const ref = qs.get("ref") || qs.get("aff");
const refPart = ref ? `&ref=${encodeURIComponent(ref)}` : "";

const prepaid = qs.get("prepaid") === "1";
const prepaidEmail = (qs.get("email") || "").trim().toLowerCase();

if (prepaid && prepaidEmail) {
  showLoader("Gerando seu relatório...");

  const quizTipo =
    location.pathname.includes("profissional") ? "profissional" :
    location.pathname.includes("familiar") ? "familiar" :
    location.pathname.includes("social") ? "social" :
    "geral";

  const pagoResp = await fetch("/api/prepaid/salvar-quiz-pago", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: prepaidEmail,
      nome,
      respostas: notas,
      quiz_tipo: quizTipo
    })
  });

  const pagoData = await pagoResp.json();

  if (!pagoResp.ok || !pagoData.ok) {
    throw new Error(pagoData.erro || "Não foi possível liberar o relatório.");
  }

  window.location.href =
    pagoData.redirect ||
    `/aguarde.html?session_id=${encodeURIComponent(pagoData.session_id)}`;

  return;
}

window.location.href = `/checkout-solidario.html?tipo=completo&session_id=${session_id}${refPart}`;
  } catch (err) {
    console.error("❌ Falha ao salvar seus dados:", err);
    alert("Erro ao salvar seus dados. Tente novamente.\n\n" + (err.message || ""));
  } finally {
    hideLoader();
    const b = document.getElementById("btn-diagnostico");
    if (b) {
      b.disabled = false;
      b.style.opacity = "";
      b.style.cursor = "";
    }
  }
});

});
//  se estiver em módulo fechado
setTimeout(() => {
  const audio = document.getElementById("musicaAmbiente");
  const botao = document.getElementById("botaoSom");
  const slider = document.getElementById("volumeSlider");
  const controle = document.getElementById("controleSom");

  if (audio && botao && slider && controle) {
    audio.volume = 0.05;
    audio.play().catch(() => {});
    controle.classList.remove("opacity-0");

    let tocando = true;

    botao.addEventListener("click", () => {
      if (tocando) {
        audio.pause();
        botao.textContent = "🔇";
      } else {
        audio.play();
        botao.textContent = "🔊";
      }
      tocando = !tocando;
    });

    slider.addEventListener("input", () => {
      audio.volume = parseFloat(slider.value);
    });
  }
}, 5000);
function gerarResumoFrutoPorMedia(label, cor, dados, prefixo, percentualBase, emoji = "🌟") {
  const nivel = Math.round(13 - (percentualBase / 100) * 12);
  const codigo = `${prefixo}${String(nivel).padStart(2, '0')}`;
  const info = dados[codigo];
  const titulo = info?.estado || "Nível não identificado";
  const sinal = info?.sinal || "";

  return `
    <div class="flex gap-4 items-center mb-6">
      <!-- Termômetro Vertical -->
      <div class="relative h-40 w-4 bg-gradient-to-t from-red-500 via-white to-blue-600 rounded-full shadow-inner">
        <div class="absolute left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xl animate-pulse" style="bottom: ${percentualBase}%">
          ${emoji}
        </div>
      </div>

      <!-- Texto -->
      <div class="flex-1">
        <h3 class="font-semibold text-${cor}-600 mb-1">${label}: Seu reflexo está em ${percentualBase}%</h3>
        <p class="text-sm font-medium text-gray-800">"${titulo}"</p>
        <p class="text-xs text-gray-600 italic">(${sinal})</p>
      </div>
    </div>
  `;
}
function gerarBlocoResumo(label, cor, dados, prefixo, percentualBase, emoji = "🌟") {
  const nivel = Math.round(13 - (percentualBase / 100) * 12);
  const codigo = `${prefixo}${String(nivel).padStart(2, '0')}`;
  const info = dados[codigo];
  const titulo = info?.estado || "Nível não identificado";
  const sinal = info?.sinal || "";

  return `
    <div>
      <h3 class="text-${cor}-600 font-semibold">${emoji} ${label}</h3>
      <p class="text-sm text-gray-800 font-medium italic">"${titulo}"</p>
      <p class="text-xs text-gray-500 italic">(${sinal})</p>
    </div>
  `;
}

async function finalizarPrePago(prepaidEmail) {
  try {
    showLoader("Gerando seu relatório...");

    const notas = respostas.map(codigo => parseInt(codigo.slice(-2)));

    const quizTipo =
      location.pathname.includes("profissional") ? "profissional" :
      location.pathname.includes("familiar") ? "familiar" :
      location.pathname.includes("social") ? "social" :
      "geral";

    const nome = localStorage.getItem("prepaid_nome") || "Cliente";

    const resp = await fetch("/api/prepaid/salvar-quiz-pago", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: prepaidEmail,
        nome,
        respostas: notas,
        quiz_tipo: quizTipo
      })
    });

    const data = await resp.json();

    if (!resp.ok || !data.ok) {
      throw new Error(data.erro || "Não foi possível gerar o relatório.");
    }

    localStorage.setItem("pagamento_confirmado", "true");
    localStorage.setItem("session_id", data.session_id);

    window.location.href =
      data.redirect ||
      `/aguarde.html?session_id=${encodeURIComponent(data.session_id)}`;

  } catch (err) {
    console.error("Erro no pré-pago:", err);
    alert("Não foi possível gerar seu relatório. Verifique seu acesso.");
    window.location.href = "/escolher-quiz.html";
  }
}
function mostrarFormulario() {
  const container = document.getElementById('quiz-container');
  container.classList.remove('hidden');
  container.innerHTML = "";
  const qs = new URLSearchParams(window.location.search);
const prepaid = qs.get("prepaid") === "1";
const prepaidEmail = (qs.get("email") || "").trim().toLowerCase();

if (prepaid && prepaidEmail) {
  finalizarPrePago(prepaidEmail);
  return;
}

  const media = calcularMedia(respostas);
  let zona = "";

  if (media <= 4) zona = "virtude";
  else if (media <= 8) zona = "transicao";
  else zona = "degradacao";

  const imagemFinal = gerarImagemZona(zona);
  const mediaPercentual = Math.floor(((13 - media) / 12) * 100);

  const blocoVisual = `
    <div class="text-center space-y-4 mb-6 px-4">
      <h2 class="text-2xl font-bold text-gray-800">🎉 Seu resultado está pronto</h2>
      <p class="text-gray-600 text-sm max-w-md mx-auto">
        Você concluiu seu Checkup da Alma.
      </p>

      <p class="text-gray-700 text-base">
        Sua frequência predominante está na zona
        <strong class="capitalize text-${zona === 'virtude' ? 'blue' : zona === 'transicao' ? 'yellow' : 'red'}-600">${zona}</strong>.
      </p>

      ${imagemFinal}

      <div class="text-center mt-4 mb-2">
        <p class="text-gray-700 text-sm mb-1">
          🧭 Sua vibração média está em <strong>${mediaPercentual}%</strong>
        </p>
        <div class="w-full max-w-sm mx-auto h-3 rounded bg-gray-200">
          <div class="h-full rounded bg-blue-500 transition-all" style="width: ${mediaPercentual}%"></div>
        </div>
      </div>

      <p class="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
  Seu diagnóstico completo já está pronto.
  <br>
  Informe apenas onde deseja recebê-lo.
</p>
    </div>
  `;

  const formularioHTML = `
    <form id="formulario-diagnostico" class="space-y-4 w-full max-w-md mx-auto mt-6 px-4">
      <div>
        <label for="nome" class="text-sm text-gray-700">Nome</label>
        <input type="text" id="nome" placeholder="Seu nome"
          class="w-full p-3 border border-gray-300 rounded mt-1" />
      </div>

      <div>
        <label for="email" class="text-sm text-gray-700">E-mail</label>
        <input type="email" id="email" placeholder="Seu melhor e-mail"
          class="w-full p-3 border border-gray-300 rounded mt-1" />
      </div>

      <button type="button" id="btn-diagnostico"
        class="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700 transition font-semibold">
        Liberar meu diagnóstico →
      </button>

      <p id="mensagem" class="text-sm text-red-500 mt-2 text-center"></p>
    </form>
  `;

  container.innerHTML = blocoVisual + formularioHTML;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}





window.mostrarPergunta = mostrarPergunta;
window.avancar = avancar;
window.respostas = respostas;
window.perguntas = perguntas;


// Tempo na página (Meta: TimeOnPage | GA4: time_on_page) — 30 / 60 / 120 / 180s
(function(){
  // Marcos em segundos
  const MARKS = [30, 60, 120, 180];
  const fired = new Set();

  // Contexto do "produto" (quiz)
  const Q = {
    id: 'quiz',
    name: 'Mapa da Alma - Quiz',
    category: 'quiz',
    price: 0,
    currency: 'BRL'
  };

  // Só conta quando a aba está ativa
  let active = !document.hidden;
  document.addEventListener('visibilitychange', function(){
    active = !document.hidden;
  });

  let seconds = 0;
  const timer = setInterval(function(){
    if (!active) return;
    seconds++;

    for (let i = 0; i < MARKS.length; i++){
      const t = MARKS[i];
      if (seconds >= t && !fired.has(t)){
        fired.add(t);

        // Meta Pixel (custom)
        if (typeof fbq === 'function') {
          fbq('trackCustom', 'TimeOnPage', {
            seconds: t,
            content_ids: [Q.id],
            content_name: Q.name,
            content_type: 'product',
            content_category: Q.category,
            currency: Q.currency,
            value: Q.price
          });
        }

        // GA4 (custom)
        if (typeof gtag === 'function') {
          gtag('event', 'time_on_page', {
            seconds: t,
            currency: Q.currency,
            value: Q.price,
            items: [{
              item_id: Q.id,
              item_name: Q.name,
              item_category: Q.category,
              price: Q.price,
              quantity: 1
            }]
          });
        }
      }
    }
  }, 1000);

  // Limpa ao sair
  window.addEventListener('beforeunload', function(){ clearInterval(timer); });
})();
