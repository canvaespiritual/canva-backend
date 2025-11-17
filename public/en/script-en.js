/* =========================
   Soul Map – Quiz (EN)
   ========================= */


const LANG = 'en';
// ——— fruit details (code -> { description, diagnostic }) ———
let fruitDetails = {};

async function loadFruitDetails(lang = LANG){
  try{
    const r = await fetch(`/api/fruit-details?lang=${encodeURIComponent(lang)}`);
    if (!r.ok) throw new Error('fruit-details failed');
    fruitDetails = await r.json();
  }catch(e){
    console.warn('No fruit details loaded (fallback to no description).', e);
    fruitDetails = {};
  }
}

/* ——— Transitions between questions ——— */
const transitions = [
  "🌞 Now, feel the light of your inner joy.",
  "🌬️ Let’s touch the essence of your peace.",
  "🔥 Dive into how you handle your desires.",
  "⚖️ Let’s look at your self-control and moderation.",
  "🕊️ Notice how you position yourself: with strength or meekness?",
  "🎭 Contemplate how you reveal yourself to the world.",
  "🤝 Perceive how you honor your bonds and promises.",
  "💖 Let’s go to the center: your capacity to love.",
  "🌱 See how your intention becomes action.",
  "🤲 Let’s observe how it shows up in real behavior.",
  "⏳ Contemplate your constancy over time."
];

/* ——— Gentle prompts under the question ——— */
const stimuli = [
  "🧭 Choose sincerely. Your answer won’t be judged.",
  "🤔 Doubt is natural. Trust your first feeling.",
  "🌿 There’s no perfect answer — there’s your truth.",
  "🧘 Don’t overthink. Just feel.",
  "🌱 You’re doing something for yourself. That’s already rare.",
  "💡 Be honest with what you feel — not what you expect to be.",
  "⚖️ There’s no right or wrong here, only vibration.",
  "🌊 Your reflection changes when you’re sincere with it.",
  "🔍 Self-knowledge begins with the courage to see yourself.",
  "✨ You’re closer to the truth than you imagine.",
  "🎭 No mask needs to follow you here.",
  "🕊️ This is a conversation between you… and your soul."
];

/* ——— Questions (titles, codes, options) ——— */
const answers = [];
const questions = [
  {
    title: "⏳ How is your patience energy before life itself?",
    codes: ["PC01","PC02","PC03","PC04","PC05","PC06","PC07","PC08","PC09","PC10","PC11","PC12"],
    options: [
      "🧁 Martyr-like Patience","🌿 Sacred Patience","💪 Perseverance","👍 Active Tolerance",
      "🥀 Calm Resilience","☺️ Neutrality","💪 Tired Tolerance","😡 Contained Impatience",
      "😠 Active Irritation","❗ Intolerance","😡 Aggressive Impatience","❌ Self-destructive Anger"
    ]
  },
  {
    title: "🎉 How do you feel joy vibrating inside you?",
    codes: ["AL01","AL02","AL03","AL04","AL05","AL06","AL07","AL08","AL09","AL10","AL11","AL12"],
    options: [
      "🌟 Heavenly Joy","💫 Spontaneous Joy","🌈 Authentic Enthusiasm","🌺 Serene Satisfaction",
      "🌞 Contentment","😐 Neutral Joy","😔 Mechanical Joy","😓 Disinterest",
      "😞 Latent Sadness","😢 Lamentation","😭 Contained Suffering","😱 Despair"
    ]
  },
  {
    title: "🌳 How do you sense inner peace before what surrounds you?",
    codes: ["PA01","PA02","PA03","PA04","PA05","PA06","PA07","PA08","PA09","PA10","PA11","PA12"],
    options: [
      "🌿 Heavenly Peace","🕊 Contagious Peace","🌤 Deep Peace","🍃 Peace with Swings",
      "📅 Pragmatic Peace","⚪ Neutral Zone","❓ Subtle Restlessness","😐 Apparently Calm",
      "🌪 Inner Turbulence","⚠️ Emotional Conflict","😡 Constant Tension","❌ Inner War"
    ]
  },
  {
    title: "🪩 How do you handle your desires, instincts, and inner purity?",
    codes: ["CA01","CA02","CA03","CA04","CA05","CA06","CA07","CA08","CA09","CA10","CA11","CA12"],
    options: [
      "💖 Consecrated Chastity","🤍 Sublimated Desire","🌺 Practical Purity","🍄 Refined Instinct",
      "🔧 Sexual Balance","🌌 Holding Zone","😏 Struggle with Pleasure","😋 Contained Desire",
      "😳 Repressed Desire","🚫 Impulsive Use","😈 Emotional Addiction","❌ Uncontrolled Release"
    ]
  },
  {
    title: "🌬 How do you moderate impulses and excesses?",
    codes: ["CO01","CO02","CO03","CO04","CO05","CO06","CO07","CO08","CO09","CO10","CO11","CO12"],
    options: [
      "🥁 Consecrated Continence","🥛 Intuitive Moderation","🌿 Conscious Balance","📏 Initial Mastery",
      "⚠️ Effort to Restrain","⚪ Oscillating Neutrality","🍺 Controlled Impulse","🤢 Occasional Excess",
      "😔 Moderate Loss of Control","😠 Frequent Impulsivity","😈 Active Compulsion","❌ Self-destructive Excess"
    ]
  },
  {
    title: "⚖️ How is your inner government regarding desires, words, and impulses?",
    codes: ["MA01","MA02","MA03","MA04","MA05","MA06","MA07","MA08","MA09","MA10","MA11","MA12"],
    options: [
      "🔮 Virtuous Mastery","🌿 Discipline in Peace","🤓 Active Awareness","🌺 Aligned Will",
      "📆 Self-control in Training","🥵 Oscillation Zone","🌪 Intermittent Reaction","😐 Unstable Command",
      "❓ Difficulty Restraining","😡 Lack of Self-control","🤬 Active Impulsivity","❌ Broken Inner Government"
    ]
  },
  {
    title: "🧔 How do you express identity and self-worth to the world?",
    codes: ["MO01","MO02","MO03","MO04","MO05","MO06","MO07","MO08","MO09","MO10","MO11","MO12"],
    options: [
      "🌟 Sacred Modesty","🦄 True Humility","🙏 Genuine Simplicity","🌈 Positive Discretion",
      "🕵️ Stable Inner Value","⚪ Neutral Presence","🤦 Masked Vanity","😎 Controlled Self-image",
      "🌚 Craving Applause","😏 Subtle Pride","😊 Displayed Vanity","😱 Declared Egocentrism"
    ]
  },
  {
    title: "🔍 How committed are you to what you believe and to your relationships?",
    codes: ["FI01","FI02","FI03","FI04","FI05","FI06","FI07","FI08","FI09","FI10","FI11","FI12"],
    options: [
      "🌟 Spiritual Fidelity","🤝 True Commitment","🧳 Serene Loyalty","📅 Emotional Constancy",
      "💭 Aligned Word","⚪ Transition Zone","😏 Promise Oscillation","📉 Commitment Instability",
      "😓 Responsibility Avoidance","😡 Emotional Infidelity","😈 Active Betrayal","❌ Break with Values"
    ]
  },
  {
    title: "💖 How do you manifest love in attitudes and relationships?",
    codes: ["AM01","AM02","AM03","AM04","AM05","AM06","AM07","AM08","AM09","AM10","AM11","AM12"],
    options: [
      "💫 Divine Love","🌿 Altruistic Love","🙏 Compassionate Love","🤝 Responsible Love",
      "🌺 Mutual Care","⚪ Neutral Zone","😐 Affective Indifference","😓 Conditional Affection",
      "😠 Veiled Rejection","😡 Controlling Love","😈 Emotional Manipulation","❌ Toxic Love"
    ]
  },
  {
    title: "🌿 How do you deal with your intention to do good?",
    codes: ["BE01","BE02","BE03","BE04","BE05","BE06","BE07","BE08","BE09","BE10","BE11","BE12"],
    options: [
      "💖 Heavenly Benignity","🤝 Intuitive Kindness","💜 Steady Benevolence","🌈 Generous Help",
      "🌺 Empathic Collaboration","⚪ Neutral Zone","😐 Forced Help","😓 Conditional Benignity",
      "😞 Moral Coldness","😡 Active Negligence","😈 Hidden Malice","❌ Destructive Intention"
    ]
  },
  {
    title: "💚 How do you express kindness, compassion, and care in relationships?",
    codes: ["BO01","BO02","BO03","BO04","BO05","BO06","BO07","BO08","BO09","BO10","BO11","BO12"],
    options: [
      "🤍 Loving Kindness","💜 Present Gentleness","🌺 Caring Attitude","😊 Active Empathy",
      "🙏 True Compassion","⚪ Neutral Zone","😐 Superficial Politeness","😓 Kindness with Interest",
      "😠 Irritation with Others","😡 Subtle Aggressiveness","😈 Passive Cruelty","❌ Declared Wickedness"
    ]
  },
  {
    title: "⏳ How do you react to long processes that demand perseverance?",
    codes: ["LO01","LO02","LO03","LO04","LO05","LO06","LO07","LO08","LO09","LO10","LO11","LO12"],
    options: [
      "🕊 Heavenly Longsuffering","💚 Serene Perseverance","🙏 Loving Constancy","🌿 Trusting Wait",
      "🌧 Active Hope","⚪ Neutral Zone","😐 Silent Resistance","😓 Hidden Impatience",
      "😞 Recurring Discouragement","😡 Revolt against Time","😈 Emotional Sabotage","❌ Spiritual Giving-up"
    ]
  }
];
/* ===== Mini EN: 12 perguntas × 5 opções (espelho do PT) ===== */
// manter 5 opções por pergunta (0-based): 0, 4, 6, 8, 11
const OPT_IDX = [0, 4, 6, 8, 11];

// aplica o filtro em TODAS as perguntas (sem mexer em títulos/códigos)
for (let i = 0; i < questions.length; i++) {
  const q = questions[i];
  if (!q || !Array.isArray(q.codes) || !Array.isArray(q.options)) continue;

  const newCodes = [];
  const newOpts  = [];
  OPT_IDX.forEach(j => {
    if (q.codes[j] !== undefined && q.options[j] !== undefined) {
      newCodes.push(q.codes[j]);
      newOpts.push(q.options[j]);
    }
  });

  questions[i] = { ...q, codes: newCodes, options: newOpts };
}

/* ——— Helpers ——— */
function levelFromCode(code){ return parseInt(code.slice(-2),10); }
function avgFromCodes(list){ return Math.round(list.reduce((s,c)=>s+levelFromCode(c),0)/list.length); }
function zoneFromCode(code){
  const n = levelFromCode(code);
  if (n <= 4) return 'virtue';
  if (n <= 8) return 'transition';
  return 'degradation';
}
function percentFromCode(code){
  const n = levelFromCode(code);
  return Math.floor(((13 - n)/12)*100);
}
function fruitFromCode(code){
  const p = code.slice(0,2);
  const map = {
    PC:'patience', AL:'joy', PA:'peace', CA:'chastity', CO:'continence',
    MA:'self-mastery', MO:'modesty', FI:'fidelity', AM:'love',
    BE:'benignity', BO:'kindness', LO:'longsuffering'
  };
  return map[p] || 'fruit';
}

function imageForZone(zone, cls="w-48 h-48 mx-auto rounded"){
  return `
  <picture>
    <source srcset="../assets/imagens/zona_${zone}.webp" type="image/webp" />
    <img src="../assets/imagens/zona_${zone}.png" alt="Zone ${zone}" class="${cls}" loading="lazy" />
  </picture>`;
}

/* ——— Loader ——— */
function showLoader(msg="Processing..."){
  if(!document.getElementById("loader-style")){
    const s=document.createElement("style"); s.id="loader-style";
    s.textContent="@keyframes spin{to{transform:rotate(360deg)}}";
    document.head.appendChild(s);
  }
  let el=document.getElementById("globalLoader");
  if(!el){
    el=document.createElement("div");
    el.id="globalLoader";
    el.setAttribute("role","alert");
    el.style.cssText="position:fixed;inset:0;background:rgba(17,24,39,.55);display:flex;align-items:center;justify-content:center;z-index:9999";
    el.innerHTML=`
      <div style="background:#fff;padding:20px 24px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,.2);display:flex;gap:12px;align-items:center;min-width:260px;">
        <div style="width:28px;height:28px;border:3px solid #e5e7eb;border-top-color:#0ea5e9;border-radius:50%;animation:spin 1s linear infinite;"></div>
        <div id="globalLoaderText" style="font:600 14px/20px system-ui,-apple-system,Segoe UI,Roboto">${msg}</div>
      </div>`;
    document.body.appendChild(el);
  } else {
    document.getElementById("globalLoaderText").textContent=msg;
  }
}
function hideLoader(){ const el=document.getElementById("globalLoader"); if(el) el.remove(); }

/* ——— Progress bar ——— */
function updateProgress(i){
  const total=questions.length;
  const pct=Math.floor(((i+1)/total)*100);
  const p=document.getElementById('progresso');
  const t=document.getElementById('porcentagem');
  if(p) p.style.width=pct+'%';
  if(t) t.textContent=pct+'%';
}

/* ——— Previous mirror (top toast) ——— */
function mirrorBlock(i){
  if(i===0) return '';
  const code = answers[i-1];
  if(!code) return '';
  const zone = zoneFromCode(code);
  const pct  = percentFromCode(code);
  const fruit= fruitFromCode(code);
  const icons = { virtue:"🌟", transition:"⏳", degradation:"🔥" };
  const icon  = icons[zone];

  return `
    <div id="mirror-block" class="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-[#fefce8] border border-yellow-500 rounded-xl shadow-lg px-4 py-4 w-[90%] max-w-md text-center">
      <div class="flex flex-col items-center justify-center space-y-2 mb-2">
        <picture>
          <source srcset="../assets/icones/${fruit}_${zone}.webp" type="image/webp" />
          <img src="../assets/icones/${fruit}_${zone}.png" class="w-20 h-20" alt="${fruit} icon">
        </picture>
        <p class="text-[13px] text-gray-700 font-medium">Keep observing. Your last choice shows a living vibration inside you.</p>
      </div>
      <p class="text-sm text-gray-800 font-semibold mt-2">Your ${fruit} is at <span class="text-yellow-600">${pct}%</span></p>
      <div class="relative w-full h-4 mt-4 mb-2 rounded bg-gradient-to-r from-red-500 via-white to-blue-600">
        <div class="absolute -top-2 left-[${pct}%] -translate-x-1/2 z-10 text-2xl animate-pulse">${icon}</div>
      </div>
      <p class="text-xs text-gray-500 mt-2 italic">Zone: ${zone}</p>
    </div>`;
}

/* ——— Render one question ——— */
function showQuestion(i){
  window.scrollTo({top:0, behavior:'smooth'});
  const intro=document.getElementById('intro');
  if(intro) intro.classList.add('hidden');

  // remove existing progress + blocks
  document.querySelectorAll('#barra-container').forEach(b=>b.remove());
  document.querySelectorAll('section[id^="question-"]').forEach(s=>s.remove());

  // progress bar
  if(i>=0){
    const barHTML = `
      <div id="barra-container" class="w-full">
        <div class="relative w-full max-w-2xl mx-auto bg-gray-200 rounded h-4 mt-8 mb-6">
          <div id="progresso" class="bg-blue-600 h-full rounded transition-all duration-300" style="width:0%"></div>
          <span id="porcentagem" class="absolute right-0 -top-7 text-sm text-gray-600 pr-2">0%</span>
        </div>
      </div>`;
    document.getElementById('quiz-container').insertAdjacentHTML('beforebegin', barHTML);
  }

  // first-time sound hint
  if(i===0){
    const tip=document.createElement('div');
    tip.id="soundHint";
    tip.className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-white/90 px-4 py-2 rounded shadow text-sm text-gray-800";
    tip.textContent="🧘 For a more immersive experience, enable ambient sound.";
    document.body.appendChild(tip);
    setTimeout(()=>tip.remove(), 6000);
  }

  const q = questions[i];
  const sec = document.createElement('section');
  sec.id = `question-${i}`;
  sec.className = "max-w-2xl mx-auto p-6 space-y-4";

  sec.innerHTML = mirrorBlock(i) + `
    <h2 class="text-lg md:text-xl font-semibold max-w-md mx-auto leading-snug">${q.title}</h2>
    <p class="text-sm text-gray-600 max-w-md mx-auto">${stimuli[i]}</p>

    <div class="flex flex-col gap-3">
  ${q.codes.map((c, idx)=>{
    const desc = fruitDetails[c]?.description
      ? `<br><span class="text-xs text-gray-500">(${fruitDetails[c].description})</span>` : '';
    return `
      <button class="option bg-gray-100 hover:bg-blue-100 p-3 rounded text-left" data-code="${c}">
        ${q.options[idx]} ${desc}
      </button>`;
  }).join('')}
</div>


    ${i < questions.length - 1
      ? `<p class="text-sm text-gray-700 mt-4 mb-2 italic">${transitions[i]}</p>
         <button onclick="nextStep(${i})"
                 class="px-5 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 w-full max-w-xs transition">
           Next question →
         </button>`
      : `<button onclick="nextStep(${i})"
                 class="mt-4 px-5 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 w-full max-w-xs transition">
           Finish & Continue ✔
         </button>`
    }
  `;

  document.getElementById('quiz-container').appendChild(sec);

  // auto-remove mirror after 5s
  setTimeout(()=>{ const b=document.getElementById('mirror-block'); if(b) b.remove(); }, 5000);

  // progress
  updateProgress(i);

  // click handlers
  sec.querySelectorAll('.option').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      btn.parentNode.querySelectorAll('.option').forEach(b=>b.classList.remove('bg-blue-200'));
      btn.classList.add('bg-blue-200');
      answers[i] = btn.getAttribute('data-code');
    });
  });
}

/* ——— Navigation ——— */
function nextStep(i){
  if(!answers[i]){
    alert("Please select an option before continuing.");
    return;
  }
  if(i < questions.length - 1) showQuestion(i+1);
  else renderForm();
}

/* ——— Summary helpers ——— */
function summaryBlock(label, color, percent, emoji="🌟"){
  const level = Math.round(13 - (percent/100)*12);
  return `
    <div>
      <h3 class="text-${color}-600 font-semibold">${emoji} ${label}</h3>
      <p class="text-sm text-gray-800 font-medium italic">Position around level ${level}</p>
      <p class="text-xs text-gray-500 italic">Vibration ~ ${percent}%</p>
    </div>`;
}

/* ——— Final form ——— */
function renderForm(){
  const wrap = document.getElementById('quiz-container');
  wrap.classList.remove('hidden');
  wrap.innerHTML = "";

  const avg = avgFromCodes(answers);
  const zone = (avg <= 4) ? 'virtue' : (avg <= 8) ? 'transition' : 'degradation';
  const avgPct = Math.floor(((13 - avg)/12)*100);

  const topVisual = `
    <div class="text-center space-y-4 mb-8">
      <h2 class="text-xl font-bold text-gray-800">🎉 Congratulations — your Soul Map was created</h2>
      <p class="text-gray-600">You’ve completed your self-knowledge journey.</p>
      <p class="text-gray-700 text-base">
        Your predominant frequency is in the <strong class="capitalize text-${zone==='virtue'?'blue':zone==='transition'?'yellow':'red'}-600">${zone}</strong> zone.
      </p>
      ${imageForZone(zone)}
      <p class="text-sm text-gray-500 italic">Your complete analysis will arrive by email.</p>
    </div>`;

  const avgBar = `
    <div class="text-center mt-6 mb-4">
      <p class="text-gray-700 text-sm mb-1">🧭 Your average vibration is <strong>${avgPct}%</strong></p>
      <div class="w-full max-w-sm mx-auto h-3 rounded bg-gray-200">
        <div class="h-full rounded bg-blue-500 transition-all" style="width:${avgPct}%"></div>
      </div>
    </div>`;

  const trioText = `
    <div class="text-center text-gray-700 text-sm max-w-xl mx-auto mt-6 mb-4 leading-relaxed">
      Your average reveals three deep spiritual pairs:
      <strong>Faith vs. Unbelief</strong>, <strong>Blessing vs. Curse</strong>, and
      <strong>Purpose vs. Inner Slavery</strong>.
    </div>`;

  const trioBlocks = `
    <div class="flex items-start gap-6 justify-center mt-8">
      <div class="relative h-56 w-5 bg-gradient-to-t from-red-500 via-white to-blue-600 rounded-full shadow-inner">
        <div class="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-xl animate-pulse" style="bottom:${avgPct}%">🌡️</div>
      </div>
      <div class="flex flex-col gap-6">
        ${summaryBlock("Spiritual Faith","indigo",avgPct,"🌟")}
        ${summaryBlock("Purpose / Servitude","amber",avgPct,"⏳")}
        ${summaryBlock("Spiritual Blessing","emerald",avgPct,"💧")}
      </div>
    </div>`;

  const preForm = `
    <p class="text-center text-gray-700 text-sm mt-8 max-w-md mx-auto leading-relaxed">
      Your <strong>complete Spiritual Checkup</strong> is ready to be sent. It includes your average vibration,
      spiritual levels, and practical elevation paths.
    </p>`;

  const stayAlert = `
    <div id="stay-alert" role="alert" aria-live="assertive"
         style="background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.4);color:#b91c1c;
                padding:12px 16px;border-radius:6px;font-size:14px;font-weight:600;
                display:block;width:100%;max-width:520px;margin:18px auto 12px;">
      ⚠️ <strong>ATTENTION:</strong> stay on this page for the <u>last step</u> before receiving your report.<br>
      On the next screen you’ll <strong>choose the report type</strong> you want to receive.
    </div>`;

  const formHTML = `
    <form id="diagnostic-form" class="space-y-4 w-full max-w-md mx-auto mt-6">
      <input type="text" id="name"  placeholder="Your name"  class="w-full p-3 border border-gray-300 rounded" />
      <input type="email" id="email" placeholder="Your email" class="w-full p-3 border border-gray-300 rounded" />
      <div id="recaptcha-container" class="g-recaptcha" data-sitekey="6LdTWXYrAAAAABUR4V9cvyq-32jbZ_vixZBQBNTh"></div>
      <p id="email-error" class="text-sm text-red-500 hidden">Invalid email</p>
      <button type="button" id="btn-diagnostic"
              class="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700 transition">
        📬 Send my Spiritual Checkup
      </button>
      <p id="message" class="text-sm text-red-500 mt-2"></p>
    </form>`;

  wrap.innerHTML = topVisual + avgBar + trioText + trioBlocks + preForm + stayAlert + formHTML;
  window.scrollTo({top:0, behavior:'smooth'});

  // align alert to form width
  const alertEl = document.getElementById('stay-alert');
  const formEl  = document.getElementById('diagnostic-form');
  function syncAlertWidth(){
    if(alertEl && formEl){ alertEl.style.width = formEl.offsetWidth + 'px'; }
  }
  syncAlertWidth();
  window.addEventListener('resize', syncAlertWidth);

  // re-render reCAPTCHA (injected)
  if (typeof grecaptcha !== "undefined") {
    grecaptcha.render("recaptcha-container", {
      sitekey: "6LdTWXYrAAAAABUR4V9cvyq-32jbZ_vixZBQBNTh"
    });
  }
}

/* ——— Boot: sound control, CTA listener, timers ——— */
document.addEventListener("DOMContentLoaded", async () => {
  // ⬇️ carregar descrições EN do backend
  await loadFruitDetails(LANG);
  // ambient sound (slight delay)
  setTimeout(() => {
    const audio = document.getElementById("musicaAmbiente");
    const btn   = document.getElementById("botaoSom");
    const slider= document.getElementById("volumeSlider");
    const ctrl  = document.getElementById("controleSom");
    if (audio && btn && slider && ctrl) {
      audio.volume = 0.1;
      audio.play().catch(()=>{});
      ctrl.classList.remove("opacity-0");
      btn.classList.add("animate-pulse");
      setTimeout(()=>{ btn.classList.remove("animate-pulse"); btn.classList.add("opacity-30"); }, 6000);

      btn.addEventListener("click", ()=>{ slider.classList.toggle("hidden"); });
      slider.addEventListener("input", ()=>{
        const v = parseFloat(slider.value);
        audio.volume = v;
        btn.textContent = (v===0 ? "🔇" : "🔊");
      });
    }
  }, 5000);

  // final form submit handler (delegated)
  document.addEventListener("click", async (e) => {
    if (e.target.id !== "btn-diagnostic") return;
    const btn = e.target;

    // lock button + loader
    btn.disabled = true; btn.style.opacity="0.7"; btn.style.cursor="not-allowed";
    showLoader("Validating security...");

    try {
      const token = grecaptcha.getResponse();
      if (!token) throw new Error("Please confirm the reCAPTCHA.");

      const check = await fetch("/verificar-recaptcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const ok = await check.json();
      if (!ok?.sucesso) throw new Error("Invalid reCAPTCHA. Try again.");

      const name  = document.getElementById("name")?.value?.trim() || "Unknown";
      const email = document.getElementById("email")?.value?.trim();
      if (!email || answers.length !== questions.length) {
        document.getElementById("message").textContent =
          "Please fill all fields and answer the 12 questions.";
        throw new Error("Missing fields / unanswered questions.");
      }

      // notes (1..12) from codes
      const notes = answers.map(code => levelFromCode(code));

      // localStorage snapshot
      localStorage.setItem("fruits", JSON.stringify(notes));
      localStorage.setItem("quizData", JSON.stringify({ name, email }));

      // session_id
      const session_id = "sess-" + Date.now();
      localStorage.setItem("session_id", session_id);

      // save on backend
      showLoader("Saving your data...");
      const resp = await fetch("/api/salvar-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id, nome: name, email, respostas: notes, lang: LANG })
      });
      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(msg || "Server error.");
      }

      // redirect to EN checkout, preserving ref/aff
      showLoader("Redirecting to checkout...");
      const qs = new URLSearchParams(window.location.search);
      const ref = qs.get("ref") || qs.get("aff");
      const refPart = ref ? `&ref=${encodeURIComponent(ref)}` : "";
      window.location.href = `/en/pay.html?session_id=${encodeURIComponent(session_id)}${refPart}`;
      return;

    } catch (err) {
      console.error("❌ Save failed:", err);
      alert(err.message || "Error saving your data. Please try again.");
    } finally {
      hideLoader();
      // if not redirected yet
      const b = document.getElementById("btn-diagnostic");
      if (b) { b.disabled=false; b.style.opacity=""; b.style.cursor=""; }
    }
  });

  // time-on-page events (Meta/GA4) — 30 / 60 / 120 / 180s
  (function(){
    const MARKS=[30,60,120,180]; const fired=new Set();
    const Q={ id:'quiz', name:'Soul Map — Quiz', category:'quiz', price:0, currency:'USD' };
    let active = !document.hidden;
    document.addEventListener('visibilitychange', ()=>{ active = !document.hidden; });
    let seconds=0;
    const timer=setInterval(()=>{
      if(!active) return;
      seconds++;
      for(const t of MARKS){
        if(seconds>=t && !fired.has(t)){
          fired.add(t);
          if(typeof fbq==='function'){
            fbq('trackCustom','TimeOnPage',{
              seconds:t, content_ids:[Q.id], content_name:Q.name,
              content_type:'product', content_category:Q.category,
              currency:Q.currency, value:Q.price
            });
          }
          if(typeof gtag==='function'){
            gtag('event','time_on_page',{
              seconds:t, currency:Q.currency, value:Q.price,
              items:[{ item_id:Q.id, item_name:Q.name, item_category:Q.category, price:Q.price, quantity:1 }]
            });
          }
        }
      }
    },1000);
    window.addEventListener('beforeunload', ()=>clearInterval(timer));
  })();
});

/* ——— Public API (for HTML buttons) ——— */
window.showQuestion = showQuestion;
window.nextStep     = nextStep;
