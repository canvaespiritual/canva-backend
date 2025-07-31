const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const pool = require('../db');
const twemoji = require('twemoji');

const blocoIntroMetodologia = `
<h2>🧭 Introdução à Metodologia</h2>
<p><strong>Parabéns, {{nome}}!</strong></p>
<p>Você acaba de dar um passo gigante rumo ao seu autoconhecimento. O autodiagnóstico da alma é o início do domínio próprio — a fundação da sua fortaleza interior. É a partir dessa força interior que você cumprirá seus objetivos, enfrentará seus desafios e alcançará prosperidade.</p>
<p>Como dizem as Sagradas Escrituras:<br><em>“O Reino dos Céus está dentro de vós.”</em></p>
<p>Saber onde estão suas vulnerabilidades é o primeiro marco da verdadeira sabedoria. Afinal, como saber para onde ir, se você não sabe onde está?</p>
<p>Agora você vai descobrir com clareza onde se encontra no seu caminho espiritual.</p>

<h3>🧩 Os 12 Vértices da Alma</h3>
<p>Utilizamos uma metodologia exclusiva que mapeia os 12 vértices da alma humana, revelados por Paulo Apóstolo na carta aos Gálatas:</p>
<ul>
  <li>Amor</li>
  <li>Paz</li>
  <li>Paciência</li>
  <li>Longanimidade</li>
  <li>Mansidão</li>
  <li>Castidade</li>
  <li>Bondade</li>
  <li>Benignidade</li>
  <li>Alegria</li>
  <li>Continência</li>
  <li>Modéstia</li>
  <li>Fidelidade</li>
</ul>

<p>Essas 12 virtudes, quando plenamente manifestas, compõem o que chamamos de <strong>"Frutos do Espírito"</strong>, ou, em linguagem vibracional, a <strong>frequência Crística</strong> — o estado vibracional de consciência operado por grandes iluminados.</p>

<p>Mas para entender onde você está, é preciso também reconhecer os polos opostos dessas virtudes. Por exemplo, o oposto do amor é o ódio; o da modéstia é a arrogância. E entre os extremos, existem níveis intermediários: apatia, indiferença, aprovação, paixão, ciúmes...</p>

<p>Cada vértice emocional possui 12 níveis vibracionais, organizados com base na <strong>Lei Hermética da Polaridade</strong>, herdada do saber ancestral egípcio.</p>

<p>Você preencheu esse mapa. E com isso, já passou por um processo real de autoconhecimento. Agora é hora de eternizar essa clareza como um <strong>espelho espiritual</strong> que poderá ser consultado ao longo da vida, acompanhando sua evolução.</p>
`;
const blocoIntroGrafico = `
<p>Abaixo você verá um gráfico com as 12 naturezas da alma. Cada barra representa o seu nível de vibração em cada fruto.</p>
<p>Se você marcou, por exemplo, 55% na Paciência, isso indica que está em um nível neutro, pois:</p>
<ul>
  <li>🔵 Zona Virtuosa: 69% a 100%</li>
  <li>⚪ Zona Neutra: 43% a 68%</li>
  <li>🔴 Zona Degradante: 0% a 42%</li>
</ul>
<p>Estar na zona virtuosa é como irradiar luz. Estar na zona degradante é, mesmo em silêncio, emitir uma vibração densa que impacta o ambiente.</p>
<p>Este é seu espelho atual, e a partir dele você pode se guiar.</p>
`;

const blocoIntroMediaGeral = `
<p>Aqui está sua média vibracional geral — uma síntese simbólica da sua alma ao longo dos últimos dias.</p>
<p>Ela não ignora os altos e baixos do seu cotidiano, mas revela a tônica predominante da sua frequência.</p>
<p>Considere este número como um retrato espiritual: não fixo, mas revelador.</p>
`;
const blocoIntroReflexos = `
<p>Agora vamos analisar, um por um, os vértices vibracionais da sua alma.</p>
<p>Este é um check-up emocional e espiritual minucioso, baseado nas suas próprias marcações. Você se olhou no espelho, identificou seus estados, e agora verá os reflexos disso na prática da vida.</p>
<p>Cada fruto que você escolheu manifesta um determinado estado vibracional — e esse estado não se limita à emoção sentida, mas transborda para o comportamento, o corpo, os relacionamentos e até o seu ambiente espiritual.</p>
<p>Nesta seção, você terá acesso a:</p>
<ul>
  <li>🔁 Reflexo comportamental: como essa vibração tende a se expressar nas suas ações e reações.</li>
  <li>💠 Sinais físicos: como seu corpo pode estar somatizando essa vibração.</li>
  <li>👥 Impacto social e profissional: como sua vibração afeta sua convivência, seus ciclos, suas oportunidades.</li>
  <li>🧭 Reflexo espiritual: como essa vibração se alinha com bênçãos ou maldições sutis que o universo te devolve.</li>
</ul>
<p>Você está prestes a compreender a dança interna das suas emoções — e como cada uma delas ecoa para fora como uma onda invisível, moldando sua realidade.</p>
`;
const blocoIntroArquetipo = `
<p>{{nome}}, chegou o momento de revelar o seu arquétipo emocional dominante.</p>
<p>Este não é apenas um símbolo. É uma imagem viva da sua vibração atual, construída a partir da composição entre seus níveis virtuosos, neutros e degradantes.</p>
<p>Cada vértice da alma que você marcou em determinada zona (azul, branca ou vermelha) ajudou a formar uma geometria simbólica, que revelamos agora como seu estado arquetípico momentâneo.</p>
<p>Esse arquétipo é um espelho vivo, uma narrativa condensada que mostra como a sua alma está se expressando no mundo neste instante. Ele pode representar:</p>
<ul>
  <li>🌟 Um estado elevado de luz, como o Guardião, o Curador ou o Pacificador;</li>
  <li>⚪ Um estado em transição, como o Sobrevivente, o Espectador ou o Contratado;</li>
  <li>🔴 Um estado de desequilíbrio, como o Usurpador, o Iludido ou o Sedutor.</li>
</ul>
<p>Todos esses nomes são simbólicos — não são rótulos, mas mapas vivos, que podem mudar conforme sua vibração evolui.</p>
<p>Este é o retrato atual do personagem invisível que você está encarnando. Olhe com sinceridade e acolhimento.</p>
`;
const blocoIntroGatilhos = `
<p>Tudo vibra. E tudo que vibra pode te elevar ou te arrastar.</p>
<p>Seus olhos, seus ouvidos, seu paladar, sua pele e seu olfato são portais de vibração emocional. Um aroma específico pode te trazer paz. Um som repetitivo pode te irritar. Uma textura pode te dar conforto. Uma imagem pode ativar um trauma. Um gosto pode resgatar sua luz interior.</p>
<p>Nesta seção, apresentamos os gatilhos sensoriais específicos para a sua atual vibração. Eles foram identificados com base no seu estado emocional predominante e nas combinações dos seus frutos em baixa, média ou alta frequência.</p>
<p>Use essa sabedoria como instrumento de blindagem espiritual.<br>
Evite os gatilhos que te rebaixam. Proporcione os gatilhos que te nutrem.<br>
Você está construindo, aos poucos, um ambiente interno e externo que favorece sua elevação.</p>
`;
const blocoIntroReflexoEspiritual = `
<p>Agora que você já entendeu suas emoções, chegou a hora de compreender o que o universo tem devolvido como resposta a elas.</p>
<p>Cada vibração interna atrai uma resposta espiritual externa. Isso não é castigo. É correspondência. É frequência.</p>
<p>Nesta seção, revelamos como está seu reflexo espiritual com base em pares de forças universais como:</p>
<ul>
  <li>🌿 Benção vs Maldição</li>
  <li>⚖️ Vida vs Morte</li>
  <li>🕊️ Fé vs Descrença</li>
  <li>📜 Obediência vs Pecado</li>
  <li>🎯 Servidão ao Propósito vs Escravidão às Ilusões</li>
  <li>🔍 Verdade vs Mentira</li>
  <li>🧠 Sabedoria vs Ignorância</li>
</ul>
<p>Essas forças não são apenas conceitos religiosos. Elas são leis espirituais operando em silêncio.</p>
<p>E quanto mais a sua média vibracional se aproxima de zonas degradantes, mais você se afasta da Graça — e adentra zonas de desordem, confusão, estagnação e sofrimento.</p>
<p>Mas a beleza do reflexo espiritual é que ele não é permanente. A mudança de dentro muda tudo fora.</p>
<p>Aqui está o seu estado atual segundo a linguagem do invisível. Receba com maturidade. Acolha com fé. Decida com coragem.</p>
`;
const blocoProtocoloIntro = `
<p>Agora é hora de se mover.<br>De sair do entendimento para a prática.<br>De transmutar o que foi revelado.</p>
<p>Nesta seção, você receberá exercícios espirituais estratégicos, para elevar os frutos mais frágeis detectados em sua alma.</p>
<p>Essas práticas não são mágicas, mas despertam o sagrado que habita em você.</p>
<p>Você será guiado por:</p>
<ul>
  <li>🧘 Meditações vibracionais</li>
  <li>🌿 Dietas prânicas e energéticas</li>
  <li>🤫 Rituais de silêncio, solitude e escuta interior</li>
  <li>🧺 Atos simples e intencionais como arrumar a cama, limpar a casa, abençoar o alimento, cuidar do corpo com consciência</li>
</ul>
<p>Nosso objetivo aqui é restituir sua presença sagrada, até que o seu momento favorito do dia seja aquele que você passa sozinho com você mesmo.</p>
<p>A verdadeira paz não é o fim do barulho, mas a harmonia que nasce quando o silêncio se torna sagrado.</p>
<p><strong>Um plano sagrado e prático para restaurar sua vibração, romper pactos invisíveis e ouvir a voz do Espírito.</strong></p>

<h3>☀️ 1. Ao Acordar: Início Sagrado do Dia</h3>
<p><strong>Objetivo:</strong> alinhar a frequência antes de qualquer contato com o mundo exterior.</p>
<p><strong>Prática (5 a 10 min):</strong></p>
<ul>
  <li>Lave o rosto com intenção: "Desperto para o bem que posso manifestar hoje."</li>
  <li>Sente-se em silêncio, mãos sobre o coração.</li>
  <li>Respire fundo 3 vezes e declare: “Sou grato(a) por mais um dia. Hoje, a paz é meu ponto de partida.”</li>
  <li>Coloque uma música de alta vibração (veja abaixo) e permaneça presente por 2 minutos.</li>
</ul>
<p>🌀 Evite redes sociais, mensagens ou ruídos externos nos primeiros 15 minutos.</p>

<h4>🎵 Sugestões Musicais Matinais</h4>
<ul>
  <li>Gayatri Mantra – Deva Premal</li>
  <li>Weightless – Marconi Union</li>
  <li>528Hz – Frequência do Amor</li>
  <li>Natureza ao fundo – Sons de floresta, chuva ou vento suave</li>
</ul>

<h3>🍲 2. Hora do Almoço: Sintonizar com a Vitalidade</h3>
<p><strong>Objetivo:</strong> nutrir corpo e alma com alimentos de luz.</p>
<h4>🌿 Tabela Prânica</h4>
<table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse;">
  <thead>
    <tr><th>Alta Vibração</th><th>Neutra</th><th>Densificante</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>Frutas vivas, vegetais crus, brotos, castanhas</td>
      <td>Grãos cozidos, ovos, legumes no vapor</td>
      <td>Carnes vermelhas, frituras, açúcar, álcool</td>
    </tr>
  </tbody>
</table>
<p><strong>Prática:</strong></p>
<ul>
  <li>Agradeça em voz baixa antes de comer: “Que este alimento seja luz no meu sangue, clareza na mente e paz no espírito.”</li>
  <li>Coma em silêncio. Mastigue devagar. Ouça seu corpo.</li>
</ul>

<h3>🌙 3. Antes de Dormir: A Entrega</h3>
<p><strong>Objetivo:</strong> purificar, agradecer e liberar.</p>
<p><strong>Prática:</strong></p>
<ul>
  <li>Apague as luzes. Silencie.</li>
  <li>Traga à mente 3 momentos de gratidão do dia.</li>
  <li>Ore ou medite perguntando ao Todo: “Qual é o próximo passo para minha alma?”</li>
  <li>Ouça. E anote o que surgir, mesmo que pareça sutil.</li>
</ul>

<h3>🔁 Ciclo de Restauração Vibracional</h3>
<p><strong>Objetivo:</strong> romper padrões antigos, ativar virtudes adormecidas e abrir espaço para o propósito.</p>
<table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse;">
  <thead>
    <tr><th>Ciclo</th><th>Ideal para</th></tr>
  </thead>
  <tbody>
    <tr><td>7 dias</td><td>Reequilíbrio emocional leve</td></tr>
    <tr><td>21 dias</td><td>Mudar padrões recorrentes</td></tr>
    <tr><td>40 dias</td><td>Curar vícios, traumas, pactos e dores antigas</td></tr>
  </tbody>
</table>
<p>Durante o ciclo:</p>
<ul>
  <li>Siga os 3 momentos do protocolo com constância.</li>
  <li>Evite ambientes, pessoas e hábitos que te arrastam.</li>
  <li>Avalie diariamente seu nível de paz (0 a 10).</li>
  <li>Faça algo que não faz há anos (tocar violão, escrever à mão, sentar na grama...).</li>
  <li>Mantenha um diário breve: pensamentos, mudanças e visões.</li>
  <li>Observe se novas respostas surgem para velhas perguntas.</li>
</ul>
<p>✍️ Às vezes, a resposta que você esperava há anos chega no silêncio de um dia sem distrações.</p>

<h3>📖 Desafio de Leitura e Consagração Mental</h3>
<p><strong>Objetivo:</strong> restaurar o templo da mente e abrir janelas espirituais.</p>
<p>Durante o ciclo, escolha uma dessas leituras para praticar 10 a 15 minutos por dia:</p>
<ul>
  <li>📖 Escrituras sagradas (Salmos, Provérbios, Evangelhos, Gálatas)</li>
  <li>📖 Literaturas clássicas espirituais (Confúcio, Agostinho, Teresa D’Ávila, Santo Antão)</li>
  <li>📖 Textos elevados sobre alma, virtudes e sabedoria universal</li>
</ul>
<blockquote>“A alma que lê, afina sua frequência com a eternidade.”</blockquote>

<h3>💔 Exercício do Perdão Profundo</h3>
<p><strong>Objetivo:</strong> libertar-se das correntes invisíveis que aprisionam há anos.</p>
<p>Durante o ciclo:</p>
<ul>
  <li>Escolha uma dor antiga ou uma pessoa que ainda ocupa espaço dentro de você.</li>
  <li>Visualize esse peso sendo colocado em um altar de luz.</li>
  <li>Diga mentalmente: “Eu não concordo com o que houve, mas me recuso a carregar essa dor por mais um dia. Eu te solto. Eu me liberto.”</li>
</ul>
<p>Comece também com você mesmo.<br>“Eu me perdoo por não ter sabido antes.<br>Agora eu sei. E com isso eu subo.”</p>

<h3>🌿 Conclusão</h3>
<p>Este protocolo não é uma fórmula. É um acordo íntimo com sua alma.</p>
<p>Quanto mais você se oferece ao invisível, mais respostas surgem no visível.<br>
Quanto mais você renuncia ao ruído, mais clara é a direção.<br>
E quando você esvazia o ego, o propósito aparece.</p>
<blockquote>“Quem se cala por dentro, ouve o céu.”<br>— Canva Espiritual</blockquote>
`;
const blocoIntroMapas = `
<p>Você está recebendo agora dois dos instrumentos mais preciosos do seu processo:</p>
<ul>
  <li><strong>O Mapa da Alma:</strong> com as 12 escalas emocionais, seus níveis, zonas e reflexos simbólicos e clínicos.</li>
  <li><strong>O Mapa Espiritual:</strong> com os pares universais de forças, organizados em camadas de consciência, refletindo a profundidade da sua sintonia com o Todo.</li>
</ul>
<p>Esses mapas são o seu <strong>manual pessoal de leitura vibracional</strong>.</p>
<p>Eles te ajudam a:</p>
<ul>
  <li>📍 Diagnosticar em tempo real onde você está</li>
  <li>🔄 Correlacionar estados emocionais com reflexos espirituais</li>
  <li>🧰 Aplicar ferramentas específicas de transmutação ou proteção</li>
  <li>📝 Registrar sua evolução com clareza</li>
</ul>
<p><strong>Imprima. Estude. Medite.</strong><br>
Esses mapas não apenas te mostram o que está acontecendo, mas te dão a <strong>chave da liberdade interior</strong>.</p>
`;
const blocoIntroPredisposicoes = `
<p>A alma fala através do corpo.<br>E o corpo memoriza as emoções.</p>
<p>Estados vibracionais mantidos por muito tempo se tornam hábitos emocionais crônicos, que passam a se manifestar como sintomas físicos, posturas, alterações hormonais e até predisposições a doenças específicas.</p>
<p>Nesta seção, com base em um estudo cruzado entre:</p>
<ul>
  <li>🌪️ Vibrações emocionais</li>
  <li>📊 Padrões clínicos</li>
  <li>🧠 Gatilhos neurofisiológicos</li>
  <li>📚 Estudos científicos e psicossomáticos</li>
</ul>
<p>…apresentamos suas predisposições físicas e mentais atuais, tanto de curto quanto de longo prazo.</p>
<p><strong>Não se trata de um diagnóstico médico.</strong><br>
É um alerta sutil. Um farol espiritual.</p>
<p>Um lembrete de que aquilo que você sente, se não curado, vira carne.<br>
E que tudo aquilo que você transmuta, vira cura.</p>
`;
const blocoChamadaCurso = `
<h2>📖 Ebook e Livro Canva Espiritual</h2>
<blockquote>“Se o espelho já te revelou algo, imagina mergulhar no universo inteiro.”</blockquote>
<p>Este relatório tem entre 20 e 35 páginas, mas o <strong>Ebook/Livro Canva Espiritual</strong> carrega mais de 200 páginas de sabedoria vibracional, com tabelas, arquétipos, exercícios, mapas, escalas, reflexões e doutrina espiritual integradas.</p>
<p>Se você deseja:</p>
<ul>
  <li>🔎 Aprofundar cada fruto e seu oposto</li>
  <li>⏳ Conhecer os ciclos, leis herméticas e intervenções vibracionais</li>
  <li>📘 Usar o livro como manual de autocura e espiritualidade prática</li>
</ul>
<p><strong>Então o próximo passo é seu.</strong></p>
<p>👉 <a href="https://canvaspiritual.com/ebook" target="_blank">Acesse o Ebook ou aguarde o lançamento impresso</a></p>
`;

// Blocos fixos de texto do relatório




function gerarHtmlFrutos(frutos) {
  return frutos.map((f, i) => {
    const percentual = Math.round((f.nota / 12) * 100);
   if (percentual <= 43) {
  corBarra = '#dc2626'; // vermelho
  zona = 'Degradante';
  corZona = '#dc2626';
} else if (percentual <= 68) {
  corBarra = '#facc15'; // amarelo
  zona = 'Neutra';
  corZona = '#facc15';
} else {
  corBarra = '#2563eb'; // azul
  zona = 'Virtuosa';
  corZona = '#2563eb';
}

    return `
      <div class="bloco" style="margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px dashed #ddd;">
        <h2 style="margin-bottom: 10px;">🔍 Fruto ${i + 1}: ${f.nome_emocao}</h2>
        <p><strong>📊 Sua vibração atual no par ${f.par_forca || ''} está em:</strong> ${percentual}%</p>

        <svg width="100%" height="20" style="margin: 6px 0 12px;">
          <rect x="0" y="0" width="100%" height="20" fill="#e5e7eb" rx="8" ry="8"></rect>
          <rect x="0" y="0" width="${percentual}%" height="20" fill="${corBarra}" rx="8" ry="8"></rect>
          <text x="50%" y="14" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="bold">${percentual}%</text>
        </svg>

        <p style="color:${corZona}; font-weight:bold; margin-bottom: 10px;">
          🧭 Isso significa que você está na Zona ${zona} para essa natureza emocional.
        </p>

        <p><strong>Reflexo detectado:</strong> ${f.texto_resposta}</p>
        <p><strong>Diagnóstico:</strong> ${f.diagnostico}</p>
        <p><strong>Descrição do estado da alma:</strong> ${f.descricao_estado}</p>
        <p><strong>🏠 Vida Familiar:</strong> ${f.vida_familiar}</p>
        <p><strong>👥 Vida Social:</strong> ${f.vida_social}</p>
        <p><strong>💼 Vida Profissional:</strong> ${f.vida_profissional}</p>
        <p><strong>🧘 Exercício de Elevação:</strong> ${f.exercicio}</p>
      </div>
    `;
  }).join('\n');
}

async function gerarHtmlReflexoEspiritual(mediaPercentual) {
  const nivelReal = 14 - ((mediaPercentual / 100) * 12);  // 14 - escala inverte a lógica
const nivelInferior = Math.floor(nivelReal);
const nivelSuperior = Math.ceil(nivelReal);



  const mapPolaridadePrefixo = {
  "Benção x maldição": "BC",
  "escravidao x servidão ao propósito": "SE",
  "fé x descrença": "FE",
  "sabedoria x ignorância": "SA",
  "obediência x pecado": "OB",
  "virtude x poder": "VI",
  "oferta x demanda": "OF",
  "vida x morte": "VD",
  "verdade x mentira": "VE",
  "bem x mal": "BM"
};



  let htmlFinal = '';
for (const polaridade of Object.keys(mapPolaridadePrefixo)) {
  const prefixo = mapPolaridadePrefixo[polaridade];
  const codigo1 = `${prefixo}${String(nivelInferior).padStart(2, '0')}`;
  const codigo2 = `${prefixo}${String(nivelSuperior).padStart(2, '0')}`;

  const resultado = await pool.query(`
  SELECT * FROM mapa_espiritual
  WHERE TRIM(LOWER(polaridade)) = TRIM(LOWER($1)) AND codigo IN ($2, $3)
  ORDER BY codigo ASC
`, [polaridade, codigo1, codigo2]);

  



    if (resultado.rows.length === 0) continue;

    // Determina cor da barra e zona
    let corBarra = '#2563eb';
    let zona = 'Virtuosa';
    if (mediaPercentual <= 43) {
      corBarra = '#dc2626';
      zona = 'Degradante';
    } else if (mediaPercentual <= 68) {
      corBarra = '#facc15';
      zona = 'Neutra';
    }

htmlFinal += `
  <div style="margin-bottom: 24px;">
    <h3 style="color: #1f2937; font-size: 20px;">🔸 ${polaridade.charAt(0).toUpperCase() + polaridade.slice(1)}</h3>

    <svg width="100%" height="22" style="margin: 12px 0;">
      <rect x="0" y="0" width="100%" height="22" fill="#e5e7eb" rx="8" ry="8"></rect>
      <rect x="0" y="0" width="${mediaPercentual}%" height="22" fill="${corBarra}" rx="8" ry="8"></rect>
      <text x="50%" y="15" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="13" font-weight="bold">
        ${mediaPercentual}%
      </text>
    </svg>

    <p style="color: ${corBarra}; font-weight: bold;">🧭 Zona ${zona}</p>
  </div>
`;



    for (const r of resultado.rows) {
      htmlFinal += `
        <div style="margin-top: 15px; padding-left: 12px; border-left: 4px solid ${corBarra};">
          <h4 style="margin: 6px 0;">Nível ${r.codigo} – ${r.nivel_estado}</h4>
          <p><strong>Sinal Comportamental:</strong> ${r.sinal_comportamental}</p>
          <p><strong>🏠 Familiar:</strong> ${r.esfera_familiar}</p>
          <p><strong>👥 Social:</strong> ${r.esfera_social}</p>
          <p><strong>💼 Profissional:</strong> ${r.esfera_profissional}</p>
          <p><strong>🧘 Individual:</strong> ${r.esfera_individual}</p>
        </div>
      `;
    }

    htmlFinal += `</div>`;
  }

  return htmlFinal;
}

async function gerarTabelaMapaEspiritual() {
  const polaridades = {
    "Benção x maldição": "BC",
    "escravidao x servidão ao propósito": "SE",
    "fé x descrença": "FE",
    "sabedoria x ignorância": "SA",
    "obediência x pecado": "OB",
    "virtude x poder": "VI",
    "oferta x demanda": "OF",
    "vida x morte": "VD",
    "verdade x mentira": "VE",
    "bem x mal": "BM"
  };

   let html = `
    <div style="transform: scale(0.80); transform-origin: top left; width: 122%; margin: 20px 0 60px 0;">
      <table border="1" cellspacing="0" cellpadding="8" style="border-collapse: collapse; font-size: 10px; width: 95%;">
        <thead>
          <tr>
            <th style="background:#f3f4f6; text-align:left;">Nível</th>
            ${Object.keys(polaridades).map(p => `<th style="background:#f3f4f6; text-align:left;">${p}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
  `;

  for (let i = 1; i <= 13; i++) {
    html += `<tr><td><strong>${i}</strong></td>`;
    for (const [polaridade, prefixo] of Object.entries(polaridades)) {
      const codigo = `${prefixo}${String(i).padStart(2, '0')}`;
      const resultado = await pool.query(`
        SELECT nivel_estado FROM mapa_espiritual
        WHERE codigo = $1 AND polaridade = $2
        LIMIT 1
      `, [codigo, polaridade]);

      const valor = resultado.rows[0]?.nivel_estado || '—';
      html += `<td>${valor}</td>`;
    }
    html += `</tr>`;
  }

  html += `</tbody></table></div>`;
  return html;
}

async function gerarTabelaMapaDaAlma() {
  const resultado = await pool.query(`
    SELECT codigo, par_forca, fruto
    FROM mapa_da_alma
    ORDER BY codigo
  `);

  const estrutura = {};
  const pares = new Set();

  for (const row of resultado.rows) {
    const nivel = parseInt(row.codigo.slice(-2), 10); // Últimos dois dígitos
    const par = row.par_forca.trim();

    if (nivel > 12) continue; // ignora níveis fora da faixa
    pares.add(par);
    if (!estrutura[nivel]) estrutura[nivel] = {};
    estrutura[nivel][par] = row.fruto;
  }

  const listaPares = Array.from(pares);

  let html = `
    <div style="transform: scale(0.70); transform-origin: top left; width: 130%; margin: 20px 0 60px 0;">
      <table border="1" cellspacing="0" cellpadding="8" style="border-collapse: collapse; font-size: 10px; width: 80%;">
        <thead>
          <tr>
            <th style="background:#f3f4f6; text-align:left;">Nível</th>
            ${listaPares.map(par => `<th style="background:#f3f4f6; text-align:left;">${par}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
  `;

  for (let nivel = 1; nivel <= 12; nivel++) {
    html += `<tr><td><strong>${nivel}</strong></td>`;
    for (const par of listaPares) {
      const valor = estrutura[nivel]?.[par] || '—';
      html += `<td>${valor}</td>`;
    }
    html += '</tr>';
  }

  html += '</tbody></table></div>';
  return html;
}

function gerarTabelaPredisposicoes(predisposicoes) {
  const linhas = predisposicoes.map((p) =>  `
    <tr>
      <td>${p.fruto}</td>
      <td>${p.nivel}</td>
      <td>${p.estado}</td>
      <td>${p.sinais_fisicos}</td>
      <td>${p.pred_fisiologicas}</td>
      <td>${p.pred_psicologicas || '-'}</td>
    </tr>
  `).join('');

  return `
    <div class="predisposicoes">
      <h2>📉 Predisposições Fisiológicas e Psicológicas</h2>
      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse; font-size:12px; width:100%;">
        <thead style="background:#f3f4f6;">
          <tr>
            <th>Fruto</th>
            <th>Nível</th>
            <th>Estado</th>
            <th>Sinais Físicos</th>
            <th>Pred. Fisiológicas</th>
            <th>Pred. Psicológicas</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>
  `;
}
function blocoUpsell(titulo, explicacao = '') {
  return `
  <div style="background-color: #fffbea; border-left: 4px solid #facc15; padding: 12px; margin: 20px 0;">
    <p><strong>🔒 ${titulo} disponível apenas no Relatório Completo.</strong></p>
    <p>${explicacao || `Para desbloquear este conteúdo, faça o diagnóstico completo ou conheça nossos produtos.`}</p>
    <p><a href="https://api.canvaspiritual.com/quiz.html" target="_blank">Refazer diagnóstico</a> ou <a href="https://canvaspiritual.com" target="_blank">acessar cursos e ebooks</a>.</p>
  </div>
  `;

}
async function createPdfFromHtml(data, tipo = 'essencial') {
  console.log("🚀 Tipo de relatório solicitado:", tipo);

  let htmlPath;
  switch (tipo) {
    case 'completo':
      htmlPath = path.resolve(__dirname, '../../templates/relatorio_completo.html');
      break;
    case 'premium':
      htmlPath = path.resolve(__dirname, '../../templates/relatorio_premium.html');
      break;
    case 'essencial':
    default:
      htmlPath = path.resolve(__dirname, '../../templates/relatorio_essencial.html');
      break;
  }

 
  let html = fs.readFileSync(htmlPath, 'utf8');
  

  let arquetipo = {};
  if (data.codigo_arquetipo) {
    const resultado = await pool.query(
      'SELECT * FROM arquetipos WHERE chave_correspondencia = $1',
      [data.codigo_arquetipo]
    );
    if (resultado.rows.length > 0) arquetipo = resultado.rows[0];
  }

  let frutosDetalhados = [];
  let nomesFrutos = [];
  let notasFrutos = [];
  let paresForca = [];

  if (data.respostas_codificadas && Array.isArray(data.respostas_codificadas)) {
    const perguntas = await pool.query(
      'SELECT * FROM mapa_da_alma WHERE codigo = ANY($1)',
      [data.respostas_codificadas]
    );

    frutosDetalhados = perguntas.rows.map((row, i) => {
      const grau = parseInt(row.codigo.slice(-2), 10);  // extrai o número final do código
      const nota = 13 - grau; // inverte: AM01 → 12, AM12 → 1
      

      nomesFrutos.push(row.fruto);
      notasFrutos.push(nota);
      paresForca.push(row.par_forca || '');

      return {
        nome_emocao: row.nivel_emocional,
        texto_resposta: row.nome_curto || row.fruto || row.nivel_emocional,
        diagnostico: row.diagnostico_emocional,
        descricao_estado: row.descricao_estado_da_alma,
        vida_familiar: row.exemplo_vida_familiar,
        vida_social: row.exemplo_vida_social,
        vida_profissional: row.exemplo_vida_profissional,
        exercicio: row.exercicio_de_elevacao,
        par_forca: row.par_forca || '',
        nota
      };
    });
  }

  html = html.replace('{{gatilho_tatil}}', arquetipo.gatilho_tatil || '');
  html = html.replace('{{gatilho_olfato}}', arquetipo.gatilho_olfato || '');
  html = html.replace('{{gatilho_audicao}}', arquetipo.gatilho_audicao || '');
  html = html.replace('{{gatilho_visao}}', arquetipo.gatilho_visao || '');
  html = html.replace('{{gatilho_paladar}}', arquetipo.gatilho_paladar || '');
  html = html.replace('{{tecnico}}', arquetipo.tecnico || '');
  html = html.replace('{{simbolico}}', arquetipo.simbolico || '');
  html = html.replace('{{diagnostico}}', arquetipo.diagnostico || '');
  html = html.replace('{{simbolico_texto}}', arquetipo.simbolico_texto || '');
  html = html.replace('{{mensagem}}', arquetipo.mensagem || '');

  html = html.replace('{{html_frutos}}', gerarHtmlFrutos(frutosDetalhados));
  html = html.replace('{{nomes_frutos_json}}', JSON.stringify(nomesFrutos));
  html = html.replace('{{notas_frutos_json}}', JSON.stringify(notasFrutos));
  html = html.replace('{{pares_forca_json}}', JSON.stringify(paresForca));

const mediaFrutos = notasFrutos.length > 0
  ? notasFrutos.reduce((acc, v) => acc + v, 0) / notasFrutos.length
  : 0;

const mediaFrutosFixado = parseFloat(mediaFrutos.toFixed(2));
const mediaPercentual = parseFloat(((mediaFrutos / 12) * 100).toFixed(1));

let corMedia = '#2563eb';
let zonaMedia = 'Virtuosa';
if (mediaPercentual <= 43) {
  corMedia = '#dc2626';
  zonaMedia = 'Degradante';
} else if (mediaPercentual <= 68) {
  corMedia = '#facc15';
  zonaMedia = 'Neutra';
}
let reflexoEspiritualHtml = '';
let tabelaEspiritualHtml = '';
let tabelaMapaAlmaHtml = '';
let predisposicoesHtml = '';

// Só gera o reflexo espiritual para premium e completo
if (tipo === 'premium' || tipo === 'completo') {
  reflexoEspiritualHtml = await gerarHtmlReflexoEspiritual(mediaPercentual);
}

// Só gera o mapa da alma para premium e completo
if (tipo === 'premium' || tipo === 'completo') {
  tabelaMapaAlmaHtml = await gerarTabelaMapaDaAlma();
}

// Só gera o mapa espiritual e as predisposições no completo
if (tipo === 'completo') {
  tabelaEspiritualHtml = await gerarTabelaMapaEspiritual();

  const predisposicoesQuery = await pool.query('SELECT * FROM predisposicoes ORDER BY fruto, nivel');
  const predisposicoesData = predisposicoesQuery.rows;
  predisposicoesHtml = gerarTabelaPredisposicoes(predisposicoesData);
}


// Substituições de blocos por tipo
if (tipo === 'essencial') {
  html = html.replace('{{reflexo_espiritual}}', blocoUpsell('Reflexo Espiritual'));
   html = html.replace('{{intro_reflexo_espiritual}}', blocoIntroReflexoEspiritual);
   html = html.replace('{{gatilhos}}', blocoUpsell('Gatilhos Sensoriais'));
  html = html.replace('{{intro_gatilhos}}', blocoIntroGatilhos);
  html = html.replace('{{protocolo_elevacao}}', blocoUpsell('Protocolo de Elevação'));
  html = html.replace('{{tabela_mapa_da_alma}}', blocoUpsell('Mapa da Alma'));
  html = html.replace('{{tabela_mapa_espiritual}}', blocoUpsell('Mapa Espiritual'));
  html = html.replace('{{intro_mapas}}', blocoIntroMapas);
  html = html.replace('{{predisposicoes}}', blocoUpsell('Predisposições de Saúde'));
  html = html.replace('{{intro_predisposicoes}}', blocoIntroPredisposicoes);
  html = html.replace('{{html_frutos}}', gerarHtmlFrutos(frutosDetalhados));

} else if (tipo === 'premium') {
  html = html.replace('{{reflexo_espiritual}}', reflexoEspiritualHtml);
  html = html.replace('{{intro_reflexo_espiritual}}', blocoIntroReflexoEspiritual);
  html = html.replace('{{gatilhos}}', ''); // limpa o marcador
  html = html.replace('{{intro_gatilhos}}', blocoIntroGatilhos);
  html = html.replace('{{protocolo_elevacao}}', blocoProtocoloIntro);
  html = html.replace('{{intro_protocolo}}', blocoProtocoloIntro);
  html = html.replace('{{tabela_mapa_da_alma}}', tabelaMapaAlmaHtml);
  html = html.replace('{{tabela_mapa_espiritual}}', blocoUpsell('Mapa Espiritual'));
  html = html.replace('{{intro_mapas}}', blocoIntroMapas);
  html = html.replace('{{predisposicoes}}', blocoUpsell('Predisposições de Saúde'));
   html = html.replace('{{intro_predisposicoes}}', blocoIntroPredisposicoes);
  html = html.replace('{{html_frutos}}', gerarHtmlFrutos(frutosDetalhados));

} else if (tipo === 'completo') {
  html = html.replace('{{reflexo_espiritual}}', reflexoEspiritualHtml);
  html = html.replace('{{intro_reflexo_espiritual}}', blocoIntroReflexoEspiritual);
  html = html.replace('{{gatilhos}}', ''); // limpa o marcador
  html = html.replace('{{intro_gatilhos}}', blocoIntroGatilhos);
  html = html.replace('{{protocolo_elevacao}}', blocoProtocoloIntro);
  html = html.replace('{{intro_protocolo}}', blocoProtocoloIntro);
  html = html.replace('{{tabela_mapa_da_alma}}', tabelaMapaAlmaHtml);
  html = html.replace('{{tabela_mapa_espiritual}}', tabelaEspiritualHtml);
  html = html.replace('{{intro_mapas}}', blocoIntroMapas);
  html = html.replace('{{predisposicoes}}', predisposicoesHtml);
  html = html.replace('{{intro_predisposicoes}}', blocoIntroPredisposicoes);
  html = html.replace('{{html_frutos}}', gerarHtmlFrutos(frutosDetalhados));
}

// Substituições simples
if (html.includes('{{media_frutos_num}}')) {
  html = html.replace('{{media_frutos_num}}', mediaFrutosFixado.toString());
}

const dataHoraFormatada = new Date().toLocaleString('pt-BR');

// Substituições dos blocos fixos de texto
html = html.replace('{{intro_metodologia}}', blocoIntroMetodologia);
html = html.replace('{{intro_grafico}}', blocoIntroGrafico);
html = html.replace('{{intro_media_geral}}', blocoIntroMediaGeral);
html = html.replace('{{intro_reflexos}}', blocoIntroReflexos);
html = html.replace('{{intro_arquetipo}}', blocoIntroArquetipo);
html = html.replace('{{intro_gatilhos}}', blocoIntroGatilhos);
html = html.replace('{{intro_reflexo_espiritual}}', blocoIntroReflexoEspiritual);
html = html.replace('{{intro_protocolo}}', blocoProtocoloIntro);
html = html.replace('{{intro_mapas}}', blocoIntroMapas);
html = html.replace('{{intro_predisposicoes}}', blocoIntroPredisposicoes);
html = html.replace('{{chamada_curso_ebook}}', blocoChamadaCurso);

// Substituições com dados dinâmicos gerais
html = html.replaceAll('{{media_percentual}}', `${mediaPercentual}`);
html = html.replace('{{cor_media}}', corMedia);
html = html.replace('{{zona_media}}', zonaMedia);

html = html.replaceAll('{{data_hora}}', dataHoraFormatada);
html = html.replaceAll('{{email}}', data.email);
html = html.replaceAll('{{session_id}}', data.session_id);
html = html.replaceAll('{{tipo_relatorio}}', (data.tipoRelatorio || 'essencial').toUpperCase());
html = html.replace('{{nome}}', data.nome);



  Object.entries(data).forEach(([chave, valor]) => {
    if (typeof valor === 'string' || typeof valor === 'number') {
      html = html.replaceAll(`{{${chave}}}`, valor);
    }
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  // Converte os emojis do HTML em imagens usando Twemoji (formato SVG)
html = twemoji.parse(html, {
  folder: 'svg',
  ext: '.svg',
  className: 'emoji'
});


  await page.setContent(html, { waitUntil: 'networkidle0' });

  const buffer = await page.pdf({
  format: 'A4',
  margin: {
    top: '60px',
    bottom: '70px',
    left: '40px',
    right: '40px'
  },
  displayHeaderFooter: true,
  footerTemplate: `
    <div style="font-size:10px; width:100%; text-align:right; padding:0 40px 20px 0; color: #999;">
      Página <span class="pageNumber"></span> de <span class="totalPages"></span>
    </div>
  `,
  headerTemplate: `<div></div>`
});


  await browser.close();
  return buffer;
}

module.exports = { createPdfFromHtml };
