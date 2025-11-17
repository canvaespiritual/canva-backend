const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const pool = require('../db');
const twemoji = require('twemoji');

const blocoIntroMetodologiaPt = `
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

const blocoIntroMetodologiaEn = `
<h2>🧭 Methodology Overview</h2>
<p><strong>Congratulations, {{nome}}!</strong></p>
<p>You have just taken a huge step toward self-knowledge. The soul self-diagnosis is the beginning of self-mastery — the foundation of your inner fortress. From this inner strength you will fulfill your goals, face your challenges and reach prosperity.</p>
<p>As the Sacred Scriptures say:<br><em>“The Kingdom of Heaven is within you.”</em></p>
<p>Knowing where your vulnerabilities are is the first milestone of true wisdom. After all, how can you know where to go if you don’t know where you are?</p>
<p>Now you are about to discover clearly where you stand on your spiritual path.</p>

<h3>🧩 The 12 Vertices of the Soul</h3>
<p>We use an exclusive methodology that maps the 12 vertices of the human soul, revealed by the Apostle Paul in the letter to the Galatians:</p>
<ul>
  <li>Love</li>
  <li>Peace</li>
  <li>Patience</li>
  <li>Long-suffering</li>
  <li>Meekness</li>
  <li>Chastity</li>
  <li>Goodness</li>
  <li>Kindness</li>
  <li>Joy</li>
  <li>Temperance</li>
  <li>Modesty</li>
  <li>Faithfulness</li>
</ul>

<p>When fully manifested, these 12 virtues form what we call the <strong>“Fruits of the Spirit”</strong> or, in vibrational language, the <strong>Christic frequency</strong> — the vibrational state of consciousness operated by great enlightened beings.</p>

<p>But to understand where you are, it is also necessary to recognize the opposite poles of these virtues. For example, the opposite of love is hatred; the opposite of modesty is arrogance. And between the extremes there are intermediate levels: apathy, indifference, approval, passion, jealousy…</p>

<p>Each emotional vertex has 12 vibrational levels, organized according to the <strong>Hermetic Law of Polarity</strong>, inherited from ancient Egyptian wisdom.</p>

<p>You have filled out this map. With that, you have already gone through a real process of self-knowledge. Now it is time to eternalize this clarity as a <strong>spiritual mirror</strong> that you will be able to consult throughout your life, following your evolution.</p>
`;

const blocoIntroGraficoPt = `
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

const blocoIntroGraficoEn = `
<p>Below you will see a chart with the 12 natures of the soul. Each bar represents your level of vibration in each fruit.</p>
<p>If you marked, for example, 55% in Patience, this means you are at a neutral level, because:</p>
<ul>
  <li>🔵 Virtuous Zone: 69% to 100%</li>
  <li>⚪ Neutral Zone: 43% to 68%</li>
  <li>🔴 Degrading Zone: 0% to 42%</li>
</ul>
<p>Being in the virtuous zone is like radiating light. Being in the degrading zone is, even in silence, emitting a dense vibration that affects the environment around you.</p>
<p>This is your current mirror, and from it you can guide yourself.</p>
`;


const blocoIntroMediaGeralPt = `
<p>Aqui está sua média vibracional geral — uma síntese simbólica da sua alma ao longo dos últimos dias.</p>
<p>Ela não ignora os altos e baixos do seu cotidiano, mas revela a tônica predominante da sua frequência.</p>
<p>Considere este número como um retrato espiritual: não fixo, mas revelador.</p>
`;

const blocoIntroMediaGeralEn = `
<p>Here is your overall vibrational average — a symbolic synthesis of your soul over the last few days.</p>
<p>It does not ignore the ups and downs of your daily life, but it reveals the predominant tone of your frequency.</p>
<p>Consider this number as a spiritual portrait: not fixed, but deeply revealing.</p>
`;

const blocoIntroReflexosPt = `
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

const blocoIntroReflexosEn = `
<p>Now we will analyze, one by one, the vibrational vertices of your soul.</p>
<p>This is a detailed emotional and spiritual check-up, based on your own answers. You looked into the mirror, identified your states, and now you will see how they reflect in the practical areas of life.</p>
<p>Each fruit you selected manifests a given vibrational state — and this state is not limited to what you feel inside, but overflows into your behavior, your body, your relationships and even your spiritual environment.</p>
<p>In this section you will have access to:</p>
<ul>
  <li>🔁 Behavioral reflection: how this vibration tends to express itself in your actions and reactions.</li>
  <li>💠 Physical signs: how your body may be somatizing this vibration.</li>
  <li>👥 Social and professional impact: how your vibration affects your relationships, circles and opportunities.</li>
  <li>🧭 Spiritual reflection: how this vibration aligns with subtle blessings or curses that the universe returns to you.</li>
</ul>
<p>You are about to understand the inner dance of your emotions — and how each one of them echoes outward as an invisible wave, shaping your reality.</p>
`;

const blocoIntroArquetipoPt = `
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

const blocoIntroArquetipoEn = `
<p>{{nome}}, it is time to reveal your dominant emotional archetype.</p>
<p>This is not just a symbol. It is a living image of your current vibration, built from the composition between your virtuous, neutral and degrading levels.</p>
<p>Each vertex of the soul that you marked in a given zone (blue, white or red) helped to form a symbolic geometry, which we now reveal as your present archetypal state.</p>
<p>This archetype is a living mirror, a condensed narrative that shows how your soul is expressing itself in the world at this moment. It may represent:</p>
<ul>
  <li>🌟 An elevated state of light, such as the Guardian, the Healer or the Peacemaker;</li>
  <li>⚪ A transitional state, such as the Survivor, the Observer or the Contracted One;</li>
  <li>🔴 A state of imbalance, such as the Usurper, the Deluded or the Seducer.</li>
</ul>
<p>All these names are symbolic — they are not labels, but living maps that may change as your vibration evolves.</p>
<p>This is the current portrait of the invisible character you are embodying. Look at it with honesty and kindness.</p>
`;

const blocoIntroGatilhosPt = `
<p>Tudo vibra. E tudo que vibra pode te elevar ou te arrastar.</p>
<p>Seus olhos, seus ouvidos, seu paladar, sua pele e seu olfato são portais de vibração emocional. Um aroma específico pode te trazer paz. Um som repetitivo pode te irritar. Uma textura pode te dar conforto. Uma imagem pode ativar um trauma. Um gosto pode resgatar sua luz interior.</p>
<p>Nesta seção, apresentamos os gatilhos sensoriais específicos para a sua atual vibração. Eles foram identificados com base no seu estado emocional predominante e nas combinações dos seus frutos em baixa, média ou alta frequência.</p>
<p>Use essa sabedoria como instrumento de blindagem espiritual.<br>
Evite os gatilhos que te rebaixam. Proporcione os gatilhos que te nutrem.<br>
Você está construindo, aos poucos, um ambiente interno e externo que favorece sua elevação.</p>
`;

const blocoIntroGatilhosEn = `
<p>Everything vibrates. And everything that vibrates can either lift you up or drag you down.</p>
<p>Your eyes, your ears, your taste, your skin and your sense of smell are emotional vibration portals. A specific scent can bring you peace. A repetitive sound can irritate you. A texture can give you comfort. An image can trigger a trauma. A taste can awaken your inner light.</p>
<p>In this section we present the sensory triggers that are specific to your current vibration. They were identified based on your predominant emotional state and on the combinations of your fruits in low, medium or high frequency.</p>
<p>Use this wisdom as an instrument of spiritual shielding.<br>
Avoid the triggers that pull you down. Provide the triggers that nourish you.<br>
You are gradually building an inner and outer environment that favors your elevation.</p>
`;

const blocoIntroReflexoEspiritualPt = `
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

const blocoIntroReflexoEspiritualEn = `
<p>Now that you have understood your emotions, it is time to see what the universe has been returning as a response to them.</p>
<p>Each inner vibration attracts an outer spiritual response. This is not punishment. It is correspondence. It is frequency.</p>
<p>In this section we reveal your spiritual reflection based on universal pairs of forces such as:</p>
<ul>
  <li>🌿 Blessing vs Curse</li>
  <li>⚖️ Life vs Death</li>
  <li>🕊️ Faith vs Unbelief</li>
  <li>📜 Obedience vs Sin</li>
  <li>🎯 Service to Purpose vs Slavery to Illusions</li>
  <li>🔍 Truth vs Lie</li>
  <li>🧠 Wisdom vs Ignorance</li>
</ul>
<p>These forces are not just religious concepts. They are spiritual laws operating in silence.</p>
<p>The more your average vibration approaches degrading zones, the further you move away from Grace — and the more you enter zones of disorder, confusion, stagnation and suffering.</p>
<p>The beauty of the spiritual reflection is that it is not permanent. When the inner world changes, everything outside changes as well.</p>
<p>Here is your current state according to the language of the invisible. Receive it with maturity. Embrace it with faith. Decide with courage.</p>
`;

const blocoProtocoloIntroPt = `
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

const blocoProtocoloIntroEn = `
<p>Now it is time to move.<br>To leave understanding and enter practice.<br>To transmute what has been revealed.</p>
<p>In this section you will receive strategic spiritual exercises to raise the weakest fruits detected in your soul.</p>
<p>These practices are not magic, but they awaken the sacred that dwells within you.</p>
<p>You will be guided by:</p>
<ul>
  <li>🧘 Vibrational meditations</li>
  <li>🌿 Pranic and energetic diets</li>
  <li>🤫 Rituals of silence, solitude and inner listening</li>
  <li>🧺 Simple and intentional acts such as making your bed, cleaning the house, blessing your food and caring for your body with awareness</li>
</ul>
<p>Our goal here is to restore your sacred presence, until your favorite moment of the day is the one you spend alone with yourself.</p>
<p>True peace is not the end of noise, but the harmony that arises when silence becomes sacred.</p>
<p><strong>A sacred and practical plan to restore your vibration, break invisible pacts and hear the voice of the Spirit.</strong></p>

<h3>☀️ 1. Upon Waking: Sacred Beginning of the Day</h3>
<p><strong>Purpose:</strong> to align your frequency before any contact with the outside world.</p>
<p><strong>Practice (5 to 10 min):</strong></p>
<ul>
  <li>Wash your face with intention: “I awaken to the good I can manifest today.”</li>
  <li>Sit in silence with your hands over your heart.</li>
  <li>Take 3 deep breaths and declare: “I am grateful for one more day. Today, peace is my starting point.”</li>
  <li>Play a piece of high-vibration music (see below) and remain present for 2 minutes.</li>
</ul>
<p>🌀 Avoid social media, messages or external noise in the first 15 minutes.</p>

<h4>🎵 Morning Music Suggestions</h4>
<ul>
  <li>Gayatri Mantra – Deva Premal</li>
  <li>Weightless – Marconi Union</li>
  <li>528Hz – Frequency of Love</li>
  <li>Nature sounds – Forest, rain or soft wind</li>
</ul>

<h3>🍲 2. Lunchtime: Tuning in to Vitality</h3>
<p><strong>Purpose:</strong> to nourish body and soul with food of light.</p>
<h4>🌿 Pranic Table</h4>
<table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse;">
  <thead>
    <tr><th>High Vibration</th><th>Neutral</th><th>Densifying</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>Fresh fruits, raw vegetables, sprouts, nuts</td>
      <td>Cooked grains, eggs, steamed vegetables</td>
      <td>Red meat, fried foods, sugar, alcohol</td>
    </tr>
  </tbody>
</table>
<p><strong>Practice:</strong></p>
<ul>
  <li>Give thanks in a low voice before eating: “May this food be light in my blood, clarity in my mind and peace in my spirit.”</li>
  <li>Eat in silence. Chew slowly. Listen to your body.</li>
</ul>

<h3>🌙 3. Before Sleeping: The Surrender</h3>
<p><strong>Purpose:</strong> to purify, give thanks and release.</p>
<p><strong>Practice:</strong></p>
<ul>
  <li>Turn off the lights. Be still.</li>
  <li>Bring to mind 3 moments of gratitude from the day.</li>
  <li>Pray or meditate asking the Whole: “What is the next step for my soul?”</li>
  <li>Listen. And write down whatever comes, even if it seems subtle.</li>
</ul>

<h3>🔁 Vibrational Restoration Cycle</h3>
<p><strong>Purpose:</strong> to break old patterns, activate dormant virtues and make room for purpose.</p>
<table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse;">
  <thead>
    <tr><th>Cycle</th><th>Ideal for</th></tr>
  </thead>
  <tbody>
    <tr><td>7 days</td><td>Light emotional rebalancing</td></tr>
    <tr><td>21 days</td><td>Changing recurring patterns</td></tr>
    <tr><td>40 days</td><td>Healing addictions, traumas, pacts and old wounds</td></tr>
  </tbody>
</table>
<p>During the cycle:</p>
<ul>
  <li>Follow the 3 moments of the protocol consistently.</li>
  <li>Avoid environments, people and habits that drag you down.</li>
  <li>Check your level of peace daily (0 to 10).</li>
  <li>Do something you haven’t done in years (play an instrument, write by hand, sit on the grass...).</li>
  <li>Keep a brief journal: thoughts, changes and insights.</li>
  <li>Notice if new answers arise for old questions.</li>
</ul>
<p>✍️ Sometimes the answer you have been waiting for years arrives in the silence of a distraction-free day.</p>

<h3>📖 Reading and Mental Consecration Challenge</h3>
<p><strong>Purpose:</strong> to restore the temple of the mind and open spiritual windows.</p>
<p>During the cycle, choose one of these readings to practice for 10 to 15 minutes a day:</p>
<ul>
  <li>📖 Sacred Scriptures (Psalms, Proverbs, Gospels, Galatians)</li>
  <li>📖 Classical spiritual literature (Confucius, Augustine, Teresa of Ávila, Saint Anthony and others)</li>
  <li>📖 Elevated texts about the soul, virtues and universal wisdom</li>
</ul>
<blockquote>“A soul that reads tunes its frequency with eternity.”</blockquote>

<h3>💔 Deep Forgiveness Exercise</h3>
<p><strong>Purpose:</strong> to free yourself from the invisible chains that have held you for years.</p>
<p>During the cycle:</p>
<ul>
  <li>Choose an old wound or a person who still occupies space within you.</li>
  <li>Visualize this weight being placed on an altar of light.</li>
  <li>Say silently: “I do not agree with what happened, but I refuse to carry this pain for one more day. I release you. I free myself.”</li>
</ul>
<p>Begin also with yourself.<br>“I forgive myself for not having known better before.<br>Now I know. And with that, I rise.”</p>

<h3>🌿 Conclusion</h3>
<p>This protocol is not a formula. It is an intimate agreement with your soul.</p>
<p>The more you offer yourself to the invisible, the more answers appear in the visible.<br>
The more you renounce the noise, the clearer the direction becomes.<br>
And when you empty the ego, purpose appears.</p>
<blockquote>“Whoever becomes silent inside hears heaven.”<br>— Canva Espiritual</blockquote>
`;

const blocoIntroMapasPt = `
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

const blocoIntroMapasEn = `
<p>You are now receiving two of the most precious instruments of your process:</p>
<ul>
  <li><strong>The Soul Map:</strong> with the 12 emotional scales, their levels, zones and symbolic/clinical reflections.</li>
  <li><strong>The Spiritual Map:</strong> with universal pairs of forces, organized in layers of consciousness, reflecting how deeply you are aligned with the Whole.</li>
</ul>
<p>These maps are your <strong>personal manual of vibrational reading</strong>.</p>
<p>They help you to:</p>
<ul>
  <li>📍 Diagnose in real time where you are</li>
  <li>🔄 Correlate emotional states with spiritual reflections</li>
  <li>🧰 Apply specific tools of transmutation or protection</li>
  <li>📝 Record your evolution with clarity</li>
</ul>
<p><strong>Print them. Study them. Meditate on them.</strong><br>
These maps do not only show what is happening; they give you the <strong>key to inner freedom</strong>.</p>
`;

const blocoIntroPredisposicoesPt = `
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

const blocoIntroPredisposicoesEn = `
<p>The soul speaks through the body.<br>And the body memorizes emotions.</p>
<p>Vibrational states that are maintained for a long time become chronic emotional habits, which start to manifest as physical symptoms, postures, hormonal changes and even predispositions to specific illnesses.</p>
<p>In this section, based on a cross-study between:</p>
<ul>
  <li>🌪️ Emotional vibrations</li>
  <li>📊 Clinical patterns</li>
  <li>🧠 Neurophysiological triggers</li>
  <li>📚 Scientific and psychosomatic studies</li>
</ul>
<p>…we present your current physical and mental predispositions, both in the short and long term.</p>
<p><strong>This is not a medical diagnosis.</strong><br>
It is a subtle alert. A spiritual lighthouse.</p>
<p>A reminder that what you feel, if not healed, becomes flesh.<br>
And that everything you transmute becomes healing.</p>
`;

const blocoChamadaCursoPt = `
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

const blocoChamadaCursoEn = `
<h2>📖 Canva Espiritual – eBook and Book</h2>
<blockquote>“If the mirror has already revealed something to you, imagine diving into the whole universe.”</blockquote>
<p>This report has between 20 and 35 pages, but the <strong>Canva Espiritual eBook/Book</strong> carries more than 200 pages of vibrational wisdom, with tables, archetypes, exercises, maps, scales, reflections and integrated spiritual doctrine.</p>
<p>If you want to:</p>
<ul>
  <li>🔎 Go deeper into each fruit and its opposite</li>
  <li>⏳ Understand the cycles, hermetic laws and vibrational interventions</li>
  <li>📘 Use the book as a manual of self-healing and practical spirituality</li>
</ul>
<p><strong>Then the next step is yours.</strong></p>
<p>👉 <a href="https://canvaspiritual.com/ebook" target="_blank">Access the eBook or wait for the printed edition</a></p>
`;


// Blocos fixos de texto do relatório




function gerarHtmlFrutos(frutos, isEn = false) {
  return frutos.map((f, i) => {
    const percentual = Math.round((f.nota / 12) * 100);

    let corBarra;
    let zonaPt;
    let corZona;

    if (percentual <= 43) {
      corBarra = '#dc2626'; // vermelho
      zonaPt = 'Degradante';
      corZona = '#dc2626';
    } else if (percentual <= 68) {
      corBarra = '#facc15'; // amarelo
      zonaPt = 'Neutra';
      corZona = '#facc15';
    } else {
      corBarra = '#2563eb'; // azul
      zonaPt = 'Virtuosa';
      corZona = '#2563eb';
    }

    // Labels em PT/EN
    const fruitLabel   = isEn ? 'Fruit'                             : 'Fruto';
    const zonaLabelEn  = zonaPt === 'Virtuosa'
      ? 'Virtuous'
      : zonaPt === 'Neutra'
      ? 'Neutral'
      : 'Degrading';

    const textoVibracao = isEn
      ? `Your current vibration in the pair ${f.par_forca || ''} is:`
      : `Sua vibração atual no par ${f.par_forca || ''} está em:`;

    const textoZona = isEn
      ? `🧭 This means you are in the ${zonaLabelEn} Zone for this emotional nature.`
      : `🧭 Isso significa que você está na Zona ${zonaPt} para essa natureza emocional.`;

    const labelReflexo = isEn ? 'Detected reflection'              : 'Reflexo detectado';
    const labelDiag    = isEn ? 'Diagnosis'                         : 'Diagnóstico';
    const labelDesc    = isEn ? 'Description of the soul state'     : 'Descrição do estado da alma';
    const labelFam     = isEn ? '🏠 Family life'                    : '🏠 Vida Familiar';
    const labelSoc     = isEn ? '👥 Social life'                    : '👥 Vida Social';
    const labelProf    = isEn ? '💼 Professional life'              : '💼 Vida Profissional';
    const labelEx      = isEn ? '🧘 Elevation exercise'             : '🧘 Exercício de Elevação';

    return `
      <div class="bloco" style="margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px dashed #ddd;">
        <h2 style="margin-bottom: 10px;">🔍 ${fruitLabel} ${i + 1}: ${f.nome_emocao}</h2>
        <p><strong>📊 ${textoVibracao}</strong> ${percentual}%</p>

        <svg width="100%" height="20" style="margin: 6px 0 12px;">
          <rect x="0" y="0" width="100%" height="20" fill="#e5e7eb" rx="8" ry="8"></rect>
          <rect x="0" y="0" width="${percentual}%" height="20" fill="${corBarra}" rx="8" ry="8"></rect>
          <text x="50%" y="14" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="bold">${percentual}%</text>
        </svg>

        <p style="color:${corZona}; font-weight:bold; margin-bottom: 10px;">
          ${textoZona}
        </p>

        <p><strong>${labelReflexo}:</strong> ${f.texto_resposta}</p>
        <p><strong>${labelDiag}:</strong> ${f.diagnostico}</p>
        <p><strong>${labelDesc}:</strong> ${f.descricao_estado}</p>
        <p><strong>${labelFam}:</strong> ${f.vida_familiar}</p>
        <p><strong>${labelSoc}:</strong> ${f.vida_social}</p>
        <p><strong>${labelProf}:</strong> ${f.vida_profissional}</p>
        <p><strong>${labelEx}:</strong> ${f.exercicio}</p>
      </div>
    `;
  }).join('\n');
}


async function gerarHtmlReflexoEspiritual(mediaPercentual, isEn = false) {
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
  const mapPolaridadeTituloEn = {
    "Benção x maldição": "Blessing vs Curse",
    "escravidao x servidão ao propósito": "Slavery vs Service to Purpose",
    "fé x descrença": "Faith vs Unbelief",
    "sabedoria x ignorância": "Wisdom vs Ignorance",
    "obediência x pecado": "Obedience vs Sin",
    "virtude x poder": "Virtue vs Power",
    "oferta x demanda": "Offering vs Demand",
    "vida x morte": "Life vs Death",
    "verdade x mentira": "Truth vs Lie",
    "bem x mal": "Good vs Evil"
  };

  let htmlFinal = '';
  const langCode = isEn ? 'en' : 'pt';

  for (const polaridade of Object.keys(mapPolaridadePrefixo)) {
    const prefixo = mapPolaridadePrefixo[polaridade];
    const codigo1 = `${prefixo}${String(nivelInferior).padStart(2, '0')}`;
    const codigo2 = `${prefixo}${String(nivelSuperior).padStart(2, '0')}`;

    let resultado;

    if (isEn) {
      // Versão EN: busca textos traduzidos em i18n_translations
      resultado = await pool.query(`
        SELECT
          me.codigo,
          me.polaridade,
          COALESCE(t_nivel.text, me.nivel_estado)          AS nivel_estado,
          COALESCE(t_sinal.text, me.sinal_comportamental)  AS sinal_comportamental,
          COALESCE(t_fam.text,  me.esfera_familiar)        AS esfera_familiar,
          COALESCE(t_soc.text,  me.esfera_social)          AS esfera_social,
          COALESCE(t_prof.text, me.esfera_profissional)    AS esfera_profissional,
          COALESCE(t_ind.text,  me.esfera_individual)      AS esfera_individual
        FROM mapa_espiritual me
        LEFT JOIN i18n_translations t_nivel
          ON t_nivel.entity = 'mapa_espiritual'
         AND t_nivel.entity_id = me.codigo
         AND t_nivel.field = 'nivel_estado'
         AND t_nivel.lang = $4
        LEFT JOIN i18n_translations t_sinal
          ON t_sinal.entity = 'mapa_espiritual'
         AND t_sinal.entity_id = me.codigo
         AND t_sinal.field = 'sinal_comportamental'
         AND t_sinal.lang = $4
        LEFT JOIN i18n_translations t_fam
          ON t_fam.entity = 'mapa_espiritual'
         AND t_fam.entity_id = me.codigo
         AND t_fam.field = 'esfera_familiar'
         AND t_fam.lang = $4
        LEFT JOIN i18n_translations t_soc
          ON t_soc.entity = 'mapa_espiritual'
         AND t_soc.entity_id = me.codigo
         AND t_soc.field = 'esfera_social'
         AND t_soc.lang = $4
        LEFT JOIN i18n_translations t_prof
          ON t_prof.entity = 'mapa_espiritual'
         AND t_prof.entity_id = me.codigo
         AND t_prof.field = 'esfera_profissional'
         AND t_prof.lang = $4
        LEFT JOIN i18n_translations t_ind
          ON t_ind.entity = 'mapa_espiritual'
         AND t_ind.entity_id = me.codigo
         AND t_ind.field = 'esfera_individual'
         AND t_ind.lang = $4
        WHERE TRIM(LOWER(me.polaridade)) = TRIM(LOWER($1))
          AND me.codigo IN ($2, $3)
        ORDER BY me.codigo ASC
      `, [polaridade, codigo1, codigo2, langCode]);
    } else {
      // Versão PT: mesma query antiga, intocada
      resultado = await pool.query(`
        SELECT * FROM mapa_espiritual
        WHERE TRIM(LOWER(polaridade)) = TRIM(LOWER($1)) AND codigo IN ($2, $3)
        ORDER BY codigo ASC
      `, [polaridade, codigo1, codigo2]);
    }

    if (resultado.rows.length === 0) continue;

    // Determina cor da barra e zona (igual antes, mas com labels multilíngue)
    let corBarra = '#2563eb';
    let zona = 'Virtuosa';
    if (mediaPercentual <= 43) {
      corBarra = '#dc2626';
      zona = 'Degradante';
    } else if (mediaPercentual <= 68) {
      corBarra = '#facc15';
      zona = 'Neutra';
    }

    const zonaEn = zona === 'Virtuosa'
      ? 'Virtuous'
      : zona === 'Neutra'
      ? 'Neutral'
      : 'Degrading';

    const labelZone = isEn ? `Zone ${zonaEn}` : `Zona ${zona}`;
    const labelNivel = isEn ? 'Level' : 'Nível';
    const labelSinal = isEn ? 'Behavioral Signal' : 'Sinal Comportamental';
    const labelFam   = isEn ? '🏠 Family' : '🏠 Familiar';
    const labelSoc   = isEn ? '👥 Social' : '👥 Social';
    const labelProf  = isEn ? '💼 Professional' : '💼 Profissional';
    const labelInd   = isEn ? '🧘 Individual' : '🧘 Individual';

        const polaridadeTitle = isEn
      ? (mapPolaridadeTituloEn[polaridade] || polaridade)
      : polaridade.charAt(0).toUpperCase() + polaridade.slice(1);

    htmlFinal += `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #1f2937; font-size: 20px;">🔸 ${polaridadeTitle}</h3>


        <svg width="100%" height="22" style="margin: 12px 0;">
          <rect x="0" y="0" width="100%" height="22" fill="#e5e7eb" rx="8" ry="8"></rect>
          <rect x="0" y="0" width="${mediaPercentual}%" height="22" fill="${corBarra}" rx="8" ry="8"></rect>
          <text x="50%" y="15" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="13" font-weight="bold">
            ${mediaPercentual}%
          </text>
        </svg>

        <p style="color: ${corBarra}; font-weight: bold;">🧭 ${labelZone}</p>
      </div>
    `;

    for (const r of resultado.rows) {
      htmlFinal += `
        <div style="margin-top: 15px; padding-left: 12px; border-left: 4px solid ${corBarra};">
          <h4 style="margin: 6px 0;">${labelNivel} ${r.codigo} – ${r.nivel_estado}</h4>
          <p><strong>${labelSinal}:</strong> ${r.sinal_comportamental}</p>
          <p><strong>${labelFam}:</strong> ${r.esfera_familiar}</p>
          <p><strong>${labelSoc}:</strong> ${r.esfera_social}</p>
          <p><strong>${labelProf}:</strong> ${r.esfera_profissional}</p>
          <p><strong>${labelInd}:</strong> ${r.esfera_individual}</p>
        </div>
      `;
    }

    htmlFinal += `</div>`;
  }

  return htmlFinal;
}


async function gerarTabelaMapaEspiritual(isEn = false) {
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

  const langCode = isEn ? 'en' : 'pt';

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

      let resultado;
      if (isEn) {
        // EN: usa tradução de nivel_estado em i18n_translations
        resultado = await pool.query(`
          SELECT
            COALESCE(t_nivel.text, me.nivel_estado) AS nivel_estado
          FROM mapa_espiritual me
          LEFT JOIN i18n_translations t_nivel
            ON t_nivel.entity = 'mapa_espiritual'
           AND t_nivel.entity_id = me.codigo
           AND t_nivel.field = 'nivel_estado'
           AND t_nivel.lang = $3
          WHERE me.codigo = $1
            AND TRIM(LOWER(me.polaridade)) = TRIM(LOWER($2))
          LIMIT 1
        `, [codigo, polaridade, langCode]);
      } else {
        // PT: mesma query antiga
        resultado = await pool.query(`
          SELECT nivel_estado FROM mapa_espiritual
          WHERE codigo = $1 AND polaridade = $2
          LIMIT 1
        `, [codigo, polaridade]);
      }

      const valor = resultado.rows[0]?.nivel_estado || '—';
      html += `<td>${valor}</td>`;
    }

    html += `</tr>`;
  }

  html += `</tbody></table></div>`;
  return html;
}


async function gerarTabelaMapaDaAlma(isEn = false) {
  let resultado;

  if (isEn) {
    // Versão EN: fruta e par de forças traduzidos via i18n_translations
    resultado = await pool.query(`
      SELECT
        ma.codigo,
        COALESCE(t_par.text,   ma.par_forca) AS par_forca,
        COALESCE(t_fruto.text, ma.fruto)     AS fruto
      FROM mapa_da_alma ma
      LEFT JOIN i18n_translations t_fruto
        ON t_fruto.entity = 'mapa_da_alma'
       AND t_fruto.entity_id = ma.codigo
       AND t_fruto.field = 'fruto'
       AND t_fruto.lang = $1
      LEFT JOIN i18n_translations t_par
        ON t_par.entity = 'mapa_da_alma'
       AND t_par.entity_id = ma.codigo
       AND t_par.field = 'par_forca'
       AND t_par.lang = $1
      ORDER BY ma.codigo
    `, ['en']); // se quiser no futuro multi-idioma, troca por langCode
  } else {
    // Versão PT: mesma query antiga, intocada
    resultado = await pool.query(`
      SELECT codigo, par_forca, fruto
      FROM mapa_da_alma
      ORDER BY codigo
    `);
  }

  const estrutura = {};
  const pares = new Set();

  for (const row of resultado.rows) {
    const nivel = parseInt(row.codigo.slice(-2), 10); // Últimos dois dígitos
    const par = (row.par_forca || '').trim();

    if (!par) continue;
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


function gerarTabelaPredisposicoes(predisposicoes, isEn = false) {
  const colunaFruto  = isEn ? 'Fruit'                    : 'Fruto';
  const colunaNivel  = isEn ? 'Level'                    : 'Nível';
  const colunaEstado = isEn ? 'State'                    : 'Estado';
  const colunaSinais = isEn ? 'Physical Signs'           : 'Sinais Físicos';
  const colunaFisio  = isEn ? 'Phys. Predispositions'    : 'Pred. Fisiológicas';
  const colunaPsico  = isEn ? 'Psych. Predispositions'   : 'Pred. Psicológicas';

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
      <h2>📉 ${isEn ? 'Physiological and Psychological Predispositions' : 'Predisposições Fisiológicas e Psicológicas'}</h2>
      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse; font-size:12px; width:100%;">
        <thead style="background:#f3f4f6;">
          <tr>
            <th>${colunaFruto}</th>
            <th>${colunaNivel}</th>
            <th>${colunaEstado}</th>
            <th>${colunaSinais}</th>
            <th>${colunaFisio}</th>
            <th>${colunaPsico}</th>
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

  // 🔤 1) detecta idioma e escolhe sufixo de template
  // data.idioma veio da tabela diagnosticos (ex: 'pt-BR', 'en', 'en-US')
  const lang = String(data.idioma || '').toLowerCase();
  const tipoCanonico = String(tipo || data.tipo_relatorio || 'completo').toLowerCase();

  // se começar com 'en', usa template _en; senão, usa padrão em pt
  const suffix = lang.startsWith('en') ? '_en' : '';
    const isEn = lang.startsWith('en');


  let htmlPath;
  switch (tipoCanonico) {
    case 'completo':
      htmlPath = path.resolve(__dirname, `../../templates/relatorio_completo${suffix}.html`);
      break;
    case 'premium':
      htmlPath = path.resolve(__dirname, `../../templates/relatorio_premium${suffix}.html`);
      break;
    case 'essencial':
    default:
      htmlPath = path.resolve(__dirname, `../../templates/relatorio_essencial${suffix}.html`);
      break;
  }

  // 🔎 fallback de segurança: se o arquivo _en não existir por algum motivo,
  // volta pro template original em português.
  if (!fs.existsSync(htmlPath)) {
    console.warn("⚠️ Template não encontrado, usando versão padrão PT:", htmlPath);
    switch (tipoCanonico) {
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
  }

  let html = fs.readFileSync(htmlPath, 'utf8');
    // Se estiver gerando o relatório em inglês, remove completamente
  // a seção "Arquétipo Dominante" do HTML.
  if (isEn) {
    html = html.replace(
      /<section id="arquetipo"[\s\S]*?<\/section>/,
      ''
    );
  }


  // 🔻 a partir daqui, deixa tudo igual como já estava
    let arquetipo = {};

if (!isEn && data.codigo_arquetipo) {
  // PT: mantém o comportamento atual, buscando o arquétipo normalmente
  const resultado = await pool.query(
    'SELECT * FROM arquetipos WHERE chave_correspondencia = $1',
    [data.codigo_arquetipo]
  );
  if (resultado.rows.length > 0) arquetipo = resultado.rows[0];
}

// Se isEn = true, arquetipo fica {} mesmo,
// e todos os {{gatilho_*}}, {{tecnico}}, etc. vão virar string vazia
// com os replaces que você já tem mais abaixo.



 let frutosDetalhados = [];
let nomesFrutos = [];
let notasFrutos = [];
let paresForca = [];

if (data.respostas_codificadas && Array.isArray(data.respostas_codificadas)) {
  let perguntas;

  if (isEn) {
    // Versão EN: busca textos traduzidos na i18n_translations
    perguntas = await pool.query(`
      SELECT
        ma.codigo,
        ma.par_forca,

        COALESCE(t_fruto.text, ma.fruto)                     AS fruto,
        COALESCE(t_nivel.text, ma.nivel_emocional)           AS nivel_emocional,
        COALESCE(t_diag.text,  ma.diagnostico_emocional)     AS diagnostico_emocional,
        COALESCE(t_desc.text,  ma.descricao_estado_da_alma)  AS descricao_estado_da_alma,
        COALESCE(t_fam.text,   ma.exemplo_vida_familiar)     AS exemplo_vida_familiar,
        COALESCE(t_soc.text,   ma.exemplo_vida_social)       AS exemplo_vida_social,
        COALESCE(t_prof.text,  ma.exemplo_vida_profissional) AS exemplo_vida_profissional,
        COALESCE(t_exe.text,   ma.exercicio_de_elevacao)     AS exercicio_de_elevacao

      FROM mapa_da_alma ma

      LEFT JOIN i18n_translations t_fruto
        ON t_fruto.entity = 'mapa_da_alma'
       AND t_fruto.entity_id = ma.codigo
       AND t_fruto.field = 'fruto'
       AND t_fruto.lang = $2

      LEFT JOIN i18n_translations t_nivel
        ON t_nivel.entity = 'mapa_da_alma'
       AND t_nivel.entity_id = ma.codigo
       AND t_nivel.field = 'nivel_emocional'
       AND t_nivel.lang = $2

      LEFT JOIN i18n_translations t_diag
        ON t_diag.entity = 'mapa_da_alma'
       AND t_diag.entity_id = ma.codigo
       AND t_diag.field = 'diagnostico_emocional'
       AND t_diag.lang = $2

      LEFT JOIN i18n_translations t_desc
        ON t_desc.entity = 'mapa_da_alma'
       AND t_desc.entity_id = ma.codigo
       AND t_desc.field = 'descricao_estado_da_alma'
       AND t_desc.lang = $2

      LEFT JOIN i18n_translations t_fam
        ON t_fam.entity = 'mapa_da_alma'
       AND t_fam.entity_id = ma.codigo
       AND t_fam.field = 'exemplo_vida_familiar'
       AND t_fam.lang = $2

      LEFT JOIN i18n_translations t_soc
        ON t_soc.entity = 'mapa_da_alma'
       AND t_soc.entity_id = ma.codigo
       AND t_soc.field = 'exemplo_vida_social'
       AND t_soc.lang = $2

      LEFT JOIN i18n_translations t_prof
        ON t_prof.entity = 'mapa_da_alma'
       AND t_prof.entity_id = ma.codigo
       AND t_prof.field = 'exemplo_vida_profissional'
       AND t_prof.lang = $2

      LEFT JOIN i18n_translations t_exe
        ON t_exe.entity = 'mapa_da_alma'
       AND t_exe.entity_id = ma.codigo
       AND t_exe.field = 'exercicio_de_elevacao'
       AND t_exe.lang = $2

      WHERE ma.codigo = ANY($1)
      ORDER BY ma.codigo
    `, [data.respostas_codificadas, 'en']);  // por enquanto, língua fixa 'en'
  } else {
    // Versão PT: mesma query antiga, intocada
    perguntas = await pool.query(
      'SELECT * FROM mapa_da_alma WHERE codigo = ANY($1)',
      [data.respostas_codificadas]
    );
  }

  frutosDetalhados = perguntas.rows.map((row) => {
    const grau = parseInt(row.codigo.slice(-2), 10);
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

const htmlFrutos = gerarHtmlFrutos(frutosDetalhados, isEn);

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

 html = html.replace('{{html_frutos}}', htmlFrutos);
  html = html.replace('{{nomes_frutos_json}}', JSON.stringify(nomesFrutos));
  html = html.replace('{{notas_frutos_json}}', JSON.stringify(notasFrutos));
  html = html.replace('{{pares_forca_json}}', JSON.stringify(paresForca));

  // ... (daqui pra baixo mantenha exatamente como já estava no seu arquivo)
  // média, blocos, substituições, puppeteer, twemoji, etc.



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
  reflexoEspiritualHtml = await gerarHtmlReflexoEspiritual(mediaPercentual, isEn);
}

// Só gera o mapa da alma para premium e completo
if (tipo === 'premium' || tipo === 'completo') {
  tabelaMapaAlmaHtml = await gerarTabelaMapaDaAlma(isEn);
}

// Só gera o mapa espiritual e as predisposições no completo
if (tipo === 'completo') {
  tabelaEspiritualHtml = await gerarTabelaMapaEspiritual(isEn);

  let predisposicoesQuery;

  if (isEn) {
    predisposicoesQuery = await pool.query(`
      SELECT
        p.id,
        COALESCE(t_fruto.text,  p.fruto)             AS fruto,
        p.nivel,
        COALESCE(t_estado.text, p.estado)            AS estado,
        COALESCE(t_sinais.text, p.sinais_fisicos)    AS sinais_fisicos,
        COALESCE(t_fisio.text,  p.pred_fisiologicas) AS pred_fisiologicas,
        COALESCE(t_psico.text,  p.pred_psicologicas) AS pred_psicologicas
      FROM predisposicoes p
      LEFT JOIN i18n_translations t_fruto
        ON t_fruto.entity     = 'predisposicoes'
       AND t_fruto.entity_id  = p.id::text
       AND t_fruto.field      = 'fruto'
       AND t_fruto.lang       = $1
      LEFT JOIN i18n_translations t_estado
        ON t_estado.entity    = 'predisposicoes'
       AND t_estado.entity_id = p.id::text
       AND t_estado.field     = 'estado'
       AND t_estado.lang      = $1
      LEFT JOIN i18n_translations t_sinais
        ON t_sinais.entity    = 'predisposicoes'
       AND t_sinais.entity_id = p.id::text
       AND t_sinais.field     = 'sinais_fisicos'
       AND t_sinais.lang      = $1
      LEFT JOIN i18n_translations t_fisio
        ON t_fisio.entity     = 'predisposicoes'
       AND t_fisio.entity_id  = p.id::text
       AND t_fisio.field      = 'pred_fisiologicas'
       AND t_fisio.lang       = $1
      LEFT JOIN i18n_translations t_psico
        ON t_psico.entity     = 'predisposicoes'
       AND t_psico.entity_id  = p.id::text
       AND t_psico.field      = 'pred_psicologicas'
       AND t_psico.lang       = $1
      ORDER BY fruto, nivel
    `, ['en']);
  } else {
    predisposicoesQuery = await pool.query('SELECT * FROM predisposicoes ORDER BY fruto, nivel');
  }

  const predisposicoesData = predisposicoesQuery.rows;
  predisposicoesHtml = gerarTabelaPredisposicoes(predisposicoesData, isEn);
}



// Substituições de blocos por tipo
// Substituições de blocos por tipo
if (tipo === 'essencial') {
  html = html.replace('{{reflexo_espiritual}}', blocoUpsell('Reflexo Espiritual'));
  html = html.replace(
    '{{intro_reflexo_espiritual}}',
    isEn ? blocoIntroReflexoEspiritualEn : blocoIntroReflexoEspiritualPt
  );

  html = html.replace('{{gatilhos}}', blocoUpsell('Gatilhos Sensoriais'));
  html = html.replace(
    '{{intro_gatilhos}}',
    isEn ? blocoIntroGatilhosEn : blocoIntroGatilhosPt
  );

  html = html.replace('{{protocolo_elevacao}}', blocoUpsell('Protocolo de Elevação'));

  html = html.replace('{{tabela_mapa_da_alma}}', blocoUpsell('Mapa da Alma'));
  html = html.replace('{{tabela_mapa_espiritual}}', blocoUpsell('Mapa Espiritual'));

  html = html.replace(
    '{{intro_mapas}}',
    isEn ? blocoIntroMapasEn : blocoIntroMapasPt
  );

  html = html.replace('{{predisposicoes}}', blocoUpsell('Predisposições de Saúde'));
  html = html.replace(
    '{{intro_predisposicoes}}',
    isEn ? blocoIntroPredisposicoesEn : blocoIntroPredisposicoesPt
  );

 html = html.replace('{{html_frutos}}', htmlFrutos);


} else if (tipo === 'premium') {
  html = html.replace('{{reflexo_espiritual}}', reflexoEspiritualHtml);
  html = html.replace(
    '{{intro_reflexo_espiritual}}',
    isEn ? blocoIntroReflexoEspiritualEn : blocoIntroReflexoEspiritualPt
  );

  html = html.replace('{{gatilhos}}', ''); // limpa o marcador
  html = html.replace(
    '{{intro_gatilhos}}',
    isEn ? blocoIntroGatilhosEn : blocoIntroGatilhosPt
  );

  html = html.replace(
    '{{protocolo_elevacao}}',
    isEn ? blocoProtocoloIntroEn : blocoProtocoloIntroPt
  );
  html = html.replace(
    '{{intro_protocolo}}',
    isEn ? blocoProtocoloIntroEn : blocoProtocoloIntroPt
  );

  html = html.replace('{{tabela_mapa_da_alma}}', tabelaMapaAlmaHtml);
  html = html.replace('{{tabela_mapa_espiritual}}', blocoUpsell('Mapa Espiritual'));

  html = html.replace(
    '{{intro_mapas}}',
    isEn ? blocoIntroMapasEn : blocoIntroMapasPt
  );

  html = html.replace('{{predisposicoes}}', blocoUpsell('Predisposições de Saúde'));
  html = html.replace(
    '{{intro_predisposicoes}}',
    isEn ? blocoIntroPredisposicoesEn : blocoIntroPredisposicoesPt
  );

 html = html.replace('{{html_frutos}}', htmlFrutos);


} else if (tipo === 'completo') {
  html = html.replace('{{reflexo_espiritual}}', reflexoEspiritualHtml);
  html = html.replace(
    '{{intro_reflexo_espiritual}}',
    isEn ? blocoIntroReflexoEspiritualEn : blocoIntroReflexoEspiritualPt
  );

  html = html.replace('{{gatilhos}}', ''); // limpa o marcador
  html = html.replace(
    '{{intro_gatilhos}}',
    isEn ? blocoIntroGatilhosEn : blocoIntroGatilhosPt
  );

  html = html.replace(
    '{{protocolo_elevacao}}',
    isEn ? blocoProtocoloIntroEn : blocoProtocoloIntroPt
  );
  html = html.replace(
    '{{intro_protocolo}}',
    isEn ? blocoProtocoloIntroEn : blocoProtocoloIntroPt
  );

  html = html.replace('{{tabela_mapa_da_alma}}', tabelaMapaAlmaHtml);
  html = html.replace('{{tabela_mapa_espiritual}}', tabelaEspiritualHtml);

  html = html.replace(
    '{{intro_mapas}}',
    isEn ? blocoIntroMapasEn : blocoIntroMapasPt
  );

  html = html.replace('{{predisposicoes}}', predisposicoesHtml);
  html = html.replace(
    '{{intro_predisposicoes}}',
    isEn ? blocoIntroPredisposicoesEn : blocoIntroPredisposicoesPt
  );

  html = html.replace('{{html_frutos}}', htmlFrutos);

}


// Substituições simples
if (html.includes('{{media_frutos_num}}')) {
  html = html.replace('{{media_frutos_num}}', mediaFrutosFixado.toString());
}

const dataHoraFormatada = new Date().toLocaleString('pt-BR');

html = html.replace(
  '{{intro_metodologia}}',
  isEn ? blocoIntroMetodologiaEn : blocoIntroMetodologiaPt
);
html = html.replace(
  '{{intro_grafico}}',
  isEn ? blocoIntroGraficoEn : blocoIntroGraficoPt
);
html = html.replace(
  '{{intro_media_geral}}',
  isEn ? blocoIntroMediaGeralEn : blocoIntroMediaGeralPt
);
html = html.replace(
  '{{intro_reflexos}}',
  isEn ? blocoIntroReflexosEn : blocoIntroReflexosPt
);
html = html.replace(
  '{{intro_arquetipo}}',
  isEn ? blocoIntroArquetipoEn : blocoIntroArquetipoPt
);
html = html.replace(
  '{{intro_gatilhos}}',
  isEn ? blocoIntroGatilhosEn : blocoIntroGatilhosPt
);
html = html.replace(
  '{{intro_reflexo_espiritual}}',
  isEn ? blocoIntroReflexoEspiritualEn : blocoIntroReflexoEspiritualPt
);
html = html.replace(
  '{{intro_protocolo}}',
  isEn ? blocoProtocoloIntroEn : blocoProtocoloIntroPt
);
html = html.replace(
  '{{intro_mapas}}',
  isEn ? blocoIntroMapasEn : blocoIntroMapasPt
);
html = html.replace(
  '{{intro_predisposicoes}}',
  isEn ? blocoIntroPredisposicoesEn : blocoIntroPredisposicoesPt
);
html = html.replace(
  '{{chamada_curso_ebook}}',
  isEn ? blocoChamadaCursoEn : blocoChamadaCursoPt
);


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
