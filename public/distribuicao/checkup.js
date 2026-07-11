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
  {
    titulo: "⏳ Como está sua energia de paciência diante da vida?",
    codigos: [
      "PC01",
      "PC02",
      "PC03",
      "PC04",
      "PC05",
      "PC06",
      "PC07",
      "PC08",
      "PC09",
      "PC10",
      "PC11",
      "PC12"
    ],
    opcoes: [
      "🧁 Paciência Mártir",
      "🌿 Paciência Sagrada",
      "💪 Perseverança",
      "👍 Tolerância Ativa",
      "🥀 Resiliência Calma",
      "☺️ Neutralidade",
      "💪 Tolerância Cansada",
      "😡 Impaciência Contida",
      "😠 Irritação Ativa",
      "❗ Intolerância",
      "😡 Impaciência Agressiva",
      "❌ Ira Autodestrutiva"
    ]
  },
  {
    titulo: "🎉 Como você sente a alegria vibrando dentro de você?",
    codigos: [
      "AL01",
      "AL02",
      "AL03",
      "AL04",
      "AL05",
      "AL06",
      "AL07",
      "AL08",
      "AL09",
      "AL10",
      "AL11",
      "AL12"
    ],
    opcoes: [
      "🌟 Alegria Celestial",
      "💫 Alegria Espontânea",
      "🌈 Entusiasmo Autêntico",
      "🌺 Satisfação Serena",
      "🌞 Contentamento",
      "😐 Alegria Neutra",
      "😔 Alegria Mecânica",
      "😓 Desinteresse",
      "😞 Tristeza Latente",
      "😢 Lamentação",
      "😭 Sofrimento Contido",
      "😱 Desespero"
    ]
  },
  {
    titulo: "🌳 Como você sente a paz interior diante do que te cerca?",
    codigos: [
      "PA01",
      "PA02",
      "PA03",
      "PA04",
      "PA05",
      "PA06",
      "PA07",
      "PA08",
      "PA09",
      "PA10",
      "PA11",
      "PA12"
    ],
    opcoes: [
      "🌿 Paz Celestial",
      "🕊 Paz Contagiante",
      "🌤 Paz Profunda",
      "🍃 Paz com Flutuações",
      "📅 Paz Pragmática",
      "⚪ Zona Neutra",
      "❓ Inquietação Sutil",
      "😐 Aparentemente Tranquilo",
      "🌪 Turbulência Interna",
      "⚠️ Conflito Emocional",
      "😡 Tensão Constante",
      "❌ Guerra Interior"
    ]
  },
  {
    titulo: "🪩 Como você lida com seus desejos, instintos e pureza interior?",
    codigos: [
      "CA01",
      "CA02",
      "CA03",
      "CA04",
      "CA05",
      "CA06",
      "CA07",
      "CA08",
      "CA09",
      "CA10",
      "CA11",
      "CA12"
    ],
    opcoes: [
      "💖 Castidade Consagrada",
      "🤍 Desejo Sublimado",
      "🌺 Pureza Prática",
      "🍄 Instinto Refinado",
      "🔧 Equilíbrio Sexual",
      "🌌 Zona de Contenção",
      "😏 Luta com o Prazer",
      "😋 Desejo Contido",
      "😳 Desejo Reprimido",
      "🚫 Uso Impulsivo",
      "😈 Vício Emocional",
      "❌ Liberação Descontrolada"
    ]
  },
  {
    titulo: "🌬 Como você lida com a moderação dos seus impulsos e exageros?",
    codigos: [
      "CO01",
      "CO02",
      "CO03",
      "CO04",
      "CO05",
      "CO06",
      "CO07",
      "CO08",
      "CO09",
      "CO10",
      "CO11",
      "CO12"
    ],
    opcoes: [
      "🥁 Continência Consagrada",
      "🥛 Moderação Intuitiva",
      "🌿 Equilíbrio Consciente",
      "📏 Domínio Inicial",
      "⚠️ Esforço de Contenção",
      "⚪ Neutralidade Oscilante",
      "🍺 Impulso Controlado",
      "🤢 Exagero Ocasional",
      "😔 Descontrole Moderado",
      "😠 Impulsividade Frequente",
      "😈 Compulsão Ativa",
      "❌ Excesso Autodestrutivo"
    ]
  },
  {
    titulo: "⚖️ Como está seu governo interno diante dos seus desejos, palavras e impulsos?",
    codigos: [
      "MA01",
      "MA02",
      "MA03",
      "MA04",
      "MA05",
      "MA06",
      "MA07",
      "MA08",
      "MA09",
      "MA10",
      "MA11",
      "MA12"
    ],
    opcoes: [
      "🔮 Domínio Virtuoso",
      "🌿 Disciplina em Paz",
      "🤓 Consciência Ativa",
      "🌺 Vontade Alinhada",
      "📆 Autocontrole em Treinamento",
      "🥵 Zona de Oscilação",
      "🌪 Reação Intermitente",
      "😐 Comando Instável",
      "❓ Dificuldade de Contenção",
      "😡 Falta de Autocontrole",
      "🤬 Impulsividade Ativa",
      "❌ Governo Interno Quebrado"
    ]
  },
  {
    titulo: "🧔 Como você expressa sua identidade e valor pessoal diante do mundo?",
    codigos: [
      "MO01",
      "MO02",
      "MO03",
      "MO04",
      "MO05",
      "MO06",
      "MO07",
      "MO08",
      "MO09",
      "MO10",
      "MO11",
      "MO12"
    ],
    opcoes: [
      "🌟 Modéstia Sagrada",
      "🦄 Humildade Verdadeira",
      "🙏 Simplicidade Genuína",
      "🌈 Discrição Positiva",
      "🕵️ Valor Interno Estável",
      "⚪ Presença Neutra",
      "🤦 Vaidade Disfarçada",
      "😎 Autoimagem Controlada",
      "🌚 Desejo de Aplauso",
      "😏 Soberba Sutil",
      "😊 Vaidade Exibida",
      "😱 Egocentrismo Declarado"
    ]
  },
  {
    titulo: "🔍 Como você se compromete com o que acredita e com quem se relaciona?",
    codigos: [
      "FI01",
      "FI02",
      "FI03",
      "FI04",
      "FI05",
      "FI06",
      "FI07",
      "FI08",
      "FI09",
      "FI10",
      "FI11",
      "FI12"
    ],
    opcoes: [
      "🌟 Fidelidade Espiritual",
      "🤝 Comprometimento Verdadeiro",
      "🧳 Lealdade Serena",
      "📅 Constância Emocional",
      "💭 Palavra Alinhada",
      "⚪ Zona de Transição",
      "😏 Oscilação de Promessas",
      "📉 Instabilidade de Compromisso",
      "😓 Fuga de Responsabilidade",
      "😡 Infidelidade Emocional",
      "😈 Traição Ativa",
      "❌ Ruptura com Valores"
    ]
  },
  {
    titulo: "💖 Como você manifesta o amor em suas atitudes e relações?",
    codigos: [
      "AM01",
      "AM02",
      "AM03",
      "AM04",
      "AM05",
      "AM06",
      "AM07",
      "AM08",
      "AM09",
      "AM10",
      "AM11",
      "AM12"
    ],
    opcoes: [
      "💫 Amor Divino",
      "🌿 Amor Altruísta",
      "🙏 Amor Compassivo",
      "🤝 Amor Responsável",
      "🌺 Cuidado Recíproco",
      "⚪ Zona Neutra",
      "😐 Indiferença Afetiva",
      "😓 Afeto Condicional",
      "😠 Rejeição Velada",
      "😡 Amor Controlador",
      "😈 Manipulação Emocional",
      "❌ Amor Tóxico"
    ]
  },
  {
    titulo: "🌿 Como você lida com a sua intenção de fazer o bem?",
    codigos: [
      "BE01",
      "BE02",
      "BE03",
      "BE04",
      "BE05",
      "BE06",
      "BE07",
      "BE08",
      "BE09",
      "BE10",
      "BE11",
      "BE12"
    ],
    opcoes: [
      "💖 Benignidade Celestial",
      "🤝 Bondade Intuitiva",
      "💜 Benevolência Constante",
      "🌈 Ajuda Generosa",
      "🌺 Colaboração Empática",
      "⚪ Zona Neutra",
      "😐 Ajuda forçada",
      "😓 Benignidade Condicional",
      "😞 Frieza Moral",
      "😡 Negligência Ativa",
      "😈 Maldade Oculta",
      "❌ Intenção Destrutiva"
    ]
  },
  {
    titulo: "💚 Como você expressa gentileza, compaixão e cuidado nas relações?",
    codigos: [
      "BO01",
      "BO02",
      "BO03",
      "BO04",
      "BO05",
      "BO06",
      "BO07",
      "BO08",
      "BO09",
      "BO10",
      "BO11",
      "BO12"
    ],
    opcoes: [
      "🤍 Bondade Amorosa",
      "💜 Delicadeza Presente",
      "🌺 Cuidado Gentil",
      "😊 Empatia Ativa",
      "🙏 Compaixão Verdadeira",
      "⚪ Zona Neutra",
      "😐 Cordialidade Superficial",
      "😓 Gentileza com Interesse",
      "😠 Irritação com o Outro",
      "😡 Agressividade Sutil",
      "😈 Crueldade Passiva",
      "❌ Maldade Declarada"
    ]
  },
  {
    titulo: "⏳ Como você reage aos processos que demoram e exigem perseverança?",
    codigos: [
      "LO01",
      "LO02",
      "LO03",
      "LO04",
      "LO05",
      "LO06",
      "LO07",
      "LO08",
      "LO09",
      "LO10",
      "LO11",
      "LO12"
    ],
    opcoes: [
      "🕊 Longanimidade Celestial",
      "💚 Perseverança Serena",
      "🙏 Constância Amorosa",
      "🌿 Espera Confiante",
      "🌧 Esperança Ativa",
      "⚪ Zona Neutra",
      "😐 Resistência Silenciosa",
      "😓 Impaciência Oculta",
      "😞 Desânimo Recorrente",
      "😡 Revolta com o Tempo",
      "😈 Sabotagem Emocional",
      "❌ Desistência Espiritual"
    ]
  }
];

/*
  Índices originais das opções mantidas.

  Isso mantém 7 opções por pergunta:
  01, 03, 05, 07, 09, 10 e 12.
*/
const OPT_IDX = [0, 2, 4, 6, 8, 9, 11];

for (let i = 0; i < perguntas.length; i++) {
  const pergunta = perguntas[i];

  if (
    !pergunta ||
    !Array.isArray(pergunta.codigos) ||
    !Array.isArray(pergunta.opcoes)
  ) {
    continue;
  }

  const novosCodigos = [];
  const novasOpcoes = [];

  OPT_IDX.forEach((indice) => {
    if (
      pergunta.codigos[indice] !== undefined &&
      pergunta.opcoes[indice] !== undefined
    ) {
      novosCodigos.push(pergunta.codigos[indice]);
      novasOpcoes.push(pergunta.opcoes[indice]);
    }
  });

  perguntas[i] = {
    titulo: pergunta.titulo,
    codigos: novosCodigos,
    opcoes: novasOpcoes
  };
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
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  const intro = document.getElementById("intro");

  if (intro) {
    intro.classList.add("hidden");
  }

  document
    .querySelectorAll("#barra-container")
    .forEach((barra) => barra.remove());

  if (index >= 0) {
    const barraHTML = `
      <div id="barra-container" class="w-full px-4">
        <div
          class="relative w-full max-w-2xl mx-auto bg-gray-200 rounded h-4 mt-8 mb-6"
        >
          <div
            id="progresso"
            class="bg-blue-600 h-full rounded transition-all duration-300"
            style="width: 0%;"
          ></div>

          <span
            id="porcentagem"
            class="absolute right-0 -top-7 text-sm text-gray-600 pr-2"
          >
            0%
          </span>
        </div>
      </div>
    `;

    const container = document.getElementById("quiz-container");

    if (container) {
      container.insertAdjacentHTML("beforebegin", barraHTML);
    }
  }

  if (index === 0 && !document.getElementById("avisoSom")) {
    const aviso = document.createElement("div");

    aviso.id = "avisoSom";
    aviso.className =
      "fixed top-5 left-1/2 transform -translate-x-1/2 " +
      "z-50 bg-white bg-opacity-90 px-4 py-2 rounded shadow " +
      "text-sm text-gray-800 animate-fade w-[90%] max-w-md text-center";

    aviso.textContent =
      "🧘 Para uma experiência mais imersiva, ative o som ambiente.";

    document.body.appendChild(aviso);

    window.setTimeout(() => {
      aviso.remove();
    }, 6000);
  }

  document
    .querySelectorAll('section[id^="pergunta-"]')
    .forEach((secao) => secao.remove());

  const pergunta = perguntas[index];

  if (!pergunta) {
    console.error("Pergunta não encontrada:", index);
    return;
  }

  const secao = document.createElement("section");
  const blocoEspelho = gerarEspelhoAnterior(index);

  secao.id = `pergunta-${index}`;
  secao.className = "max-w-2xl mx-auto p-6 space-y-4";

  const opcoesHTML = pergunta.codigos
    .map((codigo, indice) => {
      const detalhe = detalhesFrutos[codigo];
      const descricao = detalhe?.descricao || "";

      return `
        <button
          type="button"
          class="
            opcao
            bg-gray-100
            hover:bg-blue-100
            p-3
            rounded
            text-left
            h-full
            w-full
            flex
            flex-col
            justify-between
          "
          data-codigo="${codigo}"
        >
          <span>${pergunta.opcoes[indice]}</span>

          ${
            descricao
              ? `
                <span class="text-xs text-gray-500 mt-1">
                  (${descricao})
                </span>
              `
              : ""
          }
        </button>
      `;
    })
    .join("");

  const botaoAvancar =
    index < perguntas.length - 1
      ? `
        <p class="text-sm text-gray-700 mt-4 mb-2 italic">
          ${transicoes[index]}
        </p>

        <button
          type="button"
          onclick="avancar(${index})"
          class="
            px-5
            py-3
            bg-blue-600
            text-white
            rounded
            hover:bg-blue-700
            w-full
            max-w-xs
            transition
            font-semibold
          "
        >
          Próxima pergunta →
        </button>
      `
      : `
        <button
          type="button"
          onclick="avancar(${index})"
          class="
            mt-4
            px-5
            py-3
            bg-blue-600
            text-white
            rounded
            hover:bg-blue-700
            w-full
            max-w-xs
            transition
            font-semibold
          "
        >
          Finalizar e Avançar ✔
        </button>
      `;

  secao.innerHTML = `
    ${blocoEspelho}

    <h2
      class="
        text-lg
        md:text-xl
        font-semibold
        max-w-md
        mx-auto
        leading-snug
      "
    >
      ${pergunta.titulo}
    </h2>

    <p
      class="text-sm text-gray-600 max-w-md mx-auto"
      id="frase-estimulo"
    >
      ${frasesEstimulo[index]}
    </p>

    <div class="flex flex-col gap-3">
      ${opcoesHTML}
    </div>

    <div class="text-center">
      ${botaoAvancar}
    </div>
  `;

  const quizContainer = document.getElementById("quiz-container");

  if (!quizContainer) {
    console.error("Elemento #quiz-container não encontrado.");
    return;
  }

  quizContainer.appendChild(secao);

  const imagemEspelho = secao.querySelector("#bloco-paciencia img");

  if (imagemEspelho) {
    const iniciarRemocao = () => {
      window.setTimeout(() => {
        const bloco = document.getElementById("bloco-paciencia");

        if (bloco) {
          bloco.remove();
        }
      }, 5000);
    };

    if (imagemEspelho.complete) {
      iniciarRemocao();
    } else {
      imagemEspelho.addEventListener("load", iniciarRemocao, {
        once: true
      });

      imagemEspelho.addEventListener(
        "error",
        iniciarRemocao,
        {
          once: true
        }
      );
    }
  } else {
    window.setTimeout(() => {
      const bloco = document.getElementById("bloco-paciencia");

      if (bloco) {
        bloco.remove();
      }
    }, 5000);
  }

  atualizarBarra(index);

  secao.querySelectorAll(".opcao").forEach((botao) => {
    botao.addEventListener("click", () => {
      secao.querySelectorAll(".opcao").forEach((outraOpcao) => {
        outraOpcao.classList.remove(
          "bg-blue-200",
          "border-blue-500",
          "ring-2",
          "ring-blue-200"
        );

        outraOpcao.classList.add("bg-gray-100");
      });

      botao.classList.remove("bg-gray-100");

      botao.classList.add(
        "bg-blue-200",
        "border-blue-500",
        "ring-2",
        "ring-blue-200"
      );

      respostas[index] = botao.getAttribute("data-codigo");
    });
  });
}

function atualizarBarra(index) {
  const progresso = document.getElementById("progresso");
  const porcentagem = document.getElementById("porcentagem");

  if (!progresso || !porcentagem) {
    return;
  }

  const percentual = Math.floor(
    ((index + 1) / perguntas.length) * 100
  );

  progresso.style.width = `${percentual}%`;
  porcentagem.textContent = `${percentual}%`;
}

function avancar(index) {
  if (!respostas[index]) {
    alert("Por favor, selecione uma opção antes de continuar.");
    return;
  }

  if (index < perguntas.length - 1) {
    mostrarPergunta(index + 1);
    return;
  }

  finalizarExperiencia();
}

function gerarEspelhoAnterior(index) {
  if (index === 0) {
    return "";
  }

  const codigo = respostas[index - 1];

  if (!codigo) {
    return "";
  }

  const zona = determinarZona(codigo);
  const percentual = mapearPercentual(codigo);
  const fruto = identificarFruto(codigo);
  const detalhe = detalhesFrutos[codigo];

  const mensagemZona =
    detalhe?.diagnostico ||
    "⚠️ Estado emocional não encontrado.";

  const icones = {
    virtude: "🌟",
    transicao: "⏳",
    degradacao: "🔥"
  };

  const iconeZona = icones[zona];

  return `
    <div
      id="bloco-paciencia"
      style="
        position: fixed;
        top: 18px;
        left: 50vw;
        transform: translateX(-50%);
        width: min(92vw, 420px);
        max-width: 420px;
        z-index: 999999;
      "
      class="
        bg-[#fefce8]
        border
        border-yellow-500
        rounded-xl
        shadow-lg
        px-4
        py-4
        text-center
        
    "
    >
      <div
        class="
          flex
          flex-col
          items-center
          justify-center
          space-y-2
          mb-2
        "
      >
        <picture>
          <source
            srcset="../assets/icones/${fruto}_${zona}.webp"
            type="image/webp"
          >

          <img
            src="../assets/icones/${fruto}_${zona}.png"
            class="w-20 h-20"
            alt="Ícone espiritual de ${fruto}"
          >
        </picture>

        <p class="text-[13px] text-gray-700 font-medium">
          ${mensagemZona}
        </p>
      </div>

      <p class="text-sm text-gray-800 font-semibold mt-2">
        Sua ${fruto} está em
        <span class="text-yellow-600">${percentual}%</span>
      </p>

      <div
        class="
          relative
          w-full
          h-4
          mt-4
          mb-2
          rounded
          bg-gradient-to-r
          from-red-500
          via-white
          to-blue-600
        "
      >
        <div
          class="
            absolute
            top-[-9px]
            transform
            -translate-x-1/2
            z-10
            text-2xl
            animate-pulse
          "
          style="left: ${percentual}%;"
        >
          ${iconeZona}
        </div>
      </div>

      <p class="text-xs text-gray-500 mt-2 italic">
        Zona ${zona.charAt(0).toUpperCase() + zona.slice(1)}
      </p>
    </div>
  `;
}

function determinarZona(codigo) {
  const nivel = Number.parseInt(codigo.slice(-2), 10);

  if (nivel <= 4) {
    return "virtude";
  }

  if (nivel <= 8) {
    return "transicao";
  }

  return "degradacao";
}

function mapearPercentual(codigo) {
  const nivel = Number.parseInt(codigo.slice(-2), 10);

  return Math.floor(((13 - nivel) / 12) * 100);
}

function identificarFruto(codigo) {
  const prefixo = codigo.slice(0, 2);

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

function finalizarExperiencia() {
  if (typeof fbq === "function") {
    fbq("trackCustom", "QuizComplete", {
      protocolo: "geral",
      content_category: "quiz_simulacao",
      total_perguntas: perguntas.length
    });
  }

  if (typeof gtag === "function") {
    gtag("event", "complete_quiz", {
      protocolo: "geral",
      content_category: "quiz_simulacao",
      total_perguntas: perguntas.length
    });
  }

  const botaoFinal = document.querySelector(
    `#pergunta-${perguntas.length - 1} button[onclick]`
  );

  if (botaoFinal) {
    botaoFinal.disabled = true;
    botaoFinal.textContent = "Abrindo a próxima etapa...";

    botaoFinal.classList.add(
      "opacity-70",
      "cursor-not-allowed"
    );
  }

  /*
    Mantém os parâmetros atuais da URL.

    Exemplo:
    checkup.html?utm_source=meta&ref=ABC

    Vai para:
    ativacao.html?utm_source=meta&ref=ABC
  */
  const destino =
    `./ativacao.html${window.location.search || ""}`;

  window.setTimeout(() => {
    window.location.href = destino;
  }, 350);
}

document.addEventListener("DOMContentLoaded", () => {
  if (typeof quizStart === "function") {
    quizStart();
  }

  mostrarPergunta(0);

  configurarSomAmbiente();
});

function configurarSomAmbiente() {
  const audio = document.getElementById("musicaAmbiente");
  const botao = document.getElementById("botaoSom");
  const slider = document.getElementById("volumeSlider");
  const controle = document.getElementById("controleSom");

  if (!audio || !botao || !slider || !controle) {
    return;
  }

  audio.volume = 0.05;

  let tocando = false;

  async function tentarTocar() {
    try {
      await audio.play();

      tocando = true;
      botao.textContent = "🔊";
    } catch (erro) {
      tocando = false;
      botao.textContent = "🔇";
    }
  }

  window.setTimeout(() => {
    controle.classList.remove("opacity-0");
    botao.classList.add("animate-pulse");

    tentarTocar();

    window.setTimeout(() => {
      botao.classList.remove("animate-pulse");
      botao.classList.add("opacity-60");
    }, 6000);
  }, 1200);

  botao.addEventListener("click", async () => {
    slider.classList.toggle("hidden");

    if (tocando) {
      audio.pause();

      tocando = false;
      botao.textContent = "🔇";

      return;
    }

    await tentarTocar();
  });

  slider.addEventListener("input", () => {
    const volume = Number(slider.value);

    audio.volume = Number.isFinite(volume)
      ? volume
      : 0.05;

    if (audio.volume === 0) {
      botao.textContent = "🔇";
    } else if (tocando) {
      botao.textContent = "🔊";
    }
  });

  /*
    Muitos navegadores bloqueiam áudio automático.
    A primeira interação do usuário tenta liberar o som.
  */
  document.addEventListener(
    "pointerdown",
    () => {
      if (!tocando && audio.paused) {
        tentarTocar();
      }
    },
    {
      once: true
    }
  );
}

window.mostrarPergunta = mostrarPergunta;
window.avancar = avancar;
window.respostas = respostas;
window.perguntas = perguntas;

/*
  Eventos de tempo ativo na página.

  Não salva respostas nem informações pessoais.
*/
(function acompanharTempoNaPagina() {
  const marcos = [30, 60, 120, 180];
  const disparados = new Set();

  let segundos = 0;

  const timer = window.setInterval(() => {
    if (document.hidden) {
      return;
    }

    segundos += 1;

    marcos.forEach((marco) => {
      if (
        segundos < marco ||
        disparados.has(marco)
      ) {
        return;
      }

      disparados.add(marco);

      if (typeof fbq === "function") {
        fbq("trackCustom", "TimeOnPage", {
          seconds: marco,
          content_name: "Mapa da Alma - Simulação",
          content_category: "quiz_simulacao"
        });
      }

      if (typeof gtag === "function") {
        gtag("event", "time_on_page", {
          seconds: marco,
          content_name: "Mapa da Alma - Simulação",
          content_category: "quiz_simulacao"
        });
      }
    });
  }, 1000);

  window.addEventListener("beforeunload", () => {
    window.clearInterval(timer);
  });
})();