// src/routes/affiliates.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { v4: uuid } = require("uuid");

const pool = require("../db");
const enviarEmailSimplesViaBrevo = require("../utils/enviarEmailSimplesViaBrevo");
// saldo/saque (usa o partner_ledger)
const {
  refreshAvailability,
  snapshotPayoutMethod,
  lockAvailableForWithdrawTx,
  settleWithdrawalNowTx,
} = require("../services/payoutService");


const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || "http://localhost:3000";
const PUBLIC_LANDING_PATH = process.env.PUBLIC_LANDING_PATH || "/quiz.html";
// caminho seguro para a landing (garante /quiz.html)
const QUIZ_PATH = (String(process.env.PUBLIC_LANDING_PATH || "/quiz.html").trim().startsWith("/")
  ? String(process.env.PUBLIC_LANDING_PATH || "/quiz.html").trim()
  : "/" + String(process.env.PUBLIC_LANDING_PATH || "/quiz.html").trim()
) || "/quiz.html";

const TERMS_VERSION = "1.0";
const PRIVACY_VERSION = "1.0";

// ----------------- helpers -----------------
const str = (v) => (typeof v === "string" ? v.trim() : v);

// normaliza porcentagem (se precisar no futuro)
const clampPct = (n) => Math.max(0, Math.min(100, Number.isFinite(+n) ? +n : 30));

// [ADD role] roles válidos (para cadastro)
const ROLE_WHITELIST = new Set(["affiliate", "vendor", "supervisor", "admin"]);

// Normaliza datas para "YYYY-MM-DD". Aceita "YYYY-MM-DD" ou "DD/MM/YYYY".
// NÃO usa Date/ISO para não ter bug de timezone.
function toYMD(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // já está normalizado
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;    // DD/MM/YYYY -> YYYY-MM-DD
  return null; // rejeita outros formatos para evitar cair em UTC
}

// -------------- criação de afiliado --------------
router.post("/", async (req, res) => {
  const b = req.body || {};
  try {
    const required = [
      "name",
      "email",
      "cpf_cnpj",
      "phone",
      "address",
      "address_number",
      "district",
      "city",
      "state",
      "postal_code",
    ];
    for (const k of required) {
      if (!b[k] || (typeof b[k] === "string" && !b[k].trim())) {
        return res.status(400).json({ error: `Campo obrigatório: ${k}` });
      }
    }
    if (b.terms !== true) {
      return res.status(400).json({ error: "É necessário aceitar os termos." });
    }

    // [ADD role] papel do usuário (opcional no payload). Default = 'affiliate'
    let role = String(b.role || "affiliate").toLowerCase();
    if (!ROLE_WHITELIST.has(role)) role = "affiliate";

    const COMMISSION_DEFAULT = Number(process.env.AFF_COMMISSION_DEFAULT || 30);
    const commission = COMMISSION_DEFAULT;

    const name = str(b.name);
    const email = str(b.email)?.toLowerCase();
    const cpf_cnpj = str(b.cpf_cnpj);
    const phone = str(b.phone);
    const address = str(b.address);
    const address_number = str(b.address_number);
    const district = str(b.district);
    const city = str(b.city);
    const state = str(b.state);
    const postal_code = str(b.postal_code);

    // unicidade
    const { rows: exists } = await pool.query(
      `SELECT id FROM affiliates WHERE email = $1 OR cpf_cnpj = $2 LIMIT 1`,
      [email, cpf_cnpj]
    );
    if (exists.length > 0) {
      return res.status(400).json({ error: "E-mail ou CPF/CNPJ já cadastrados." });
    }

    // gera id e token de definição de senha
    const id = uuid();
    const linkAfiliado = `${PUBLIC_BASE}${QUIZ_PATH}/?ref=${id}`;
    const reset_token = crypto.randomBytes(32).toString("hex");
    const reset_expires_at = new Date(Date.now() + 60 * 60 * 1000); // 1h
    const password_hash = null;

    // aceite (IP/UA)
    const ip = String((req.headers["x-forwarded-for"] || req.ip || "")).split(",")[0].trim();
    const ua = String(req.headers["user-agent"] || "");

    // insert
    await pool.query(
      `
      INSERT INTO affiliates (
        id, name, email, cpf_cnpj, phone, address, address_number, district,
        city, state, postal_code, commission_percent, password_hash, link, terms,
        terms_version, terms_accepted_at, terms_ip, terms_ua,
        privacy_version, privacy_accepted_at,
        reset_token, reset_expires_at,
        role,                 -- [ADD role] coluna adicionada
        created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,
        $16, NOW(), $17, $18,
        $19, NOW(),
        $20, $21,
        $22,                 -- [ADD role] valor
        NOW(), NOW()
      )`,
      [
        id,
        name,
        email,
        cpf_cnpj,
        phone,
        address,
        address_number,
        district,
        city,
        state,
        postal_code,
        commission,
        password_hash,
        linkAfiliado,
        true,
        TERMS_VERSION,
        ip,
        ua,
        PRIVACY_VERSION,
        reset_token,
        reset_expires_at,
        role, // [ADD role]
      ]
    );

    // e-mail para definir senha
    const linkDefinir = `${PUBLIC_BASE}/afiliado/definir-senha.html?token=${reset_token}`;
    const ok = await enviarEmailSimplesViaBrevo({
      nome: name,
      email,
      subject: "Defina sua senha - Canva Espiritual",
      htmlContent: `
        <p>Olá <strong>${name}</strong>!</p>
        <p>Seu cadastro como afiliado foi criado. Para acessar, primeiro defina sua senha:</p>
        <p><a href="${linkDefinir}" target="_blank">Definir senha</a></p>
        <p><small>Este link expira em 1 hora.</small></p>
      `,
      tags: ["affiliates", "password-set"],
    });

    return res.status(201).json({
      message: ok
        ? "Afiliado criado. Enviamos um e-mail para você definir a senha."
        : "Afiliado criado. Não conseguimos enviar o e-mail agora; use 'Esqueci/Definir senha' para receber o link.",
      id,
      link: linkAfiliado,
    });
  } catch (err) {
    if (err && err.code === "23505") {
      return res.status(400).json({ error: "Registro já existente (duplicado)." });
    }
    console.error("Erro ao criar afiliado:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// -------------- fluxo de senha --------------
router.post("/password/start", async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ error: "Informe o e-mail." });

    const { rows } = await pool.query(
      `SELECT id, name FROM affiliates WHERE email = $1 ORDER BY updated_at DESC LIMIT 1`,
      [email]
    );

    if (rows.length > 0) {
      const { id, name } = rows[0];
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await pool.query(
        `UPDATE affiliates SET reset_token = $1, reset_expires_at = $2, updated_at = NOW() WHERE id = $3`,
        [token, expires, id]
      );
      const link = `${PUBLIC_BASE}/afiliado/definir-senha.html?token=${token}`;
      await enviarEmailSimplesViaBrevo({
        nome: name,
        email,
        subject: "Defina sua senha - Canva Espiritual",
        htmlContent: `
          <p>Olá <strong>${name}</strong>!</p>
          <p>Clique no link abaixo para definir sua senha:</p>
          <p><a href="${link}" target="_blank">Definir senha</a></p>
          <p><small>Este link expira em 1 hora.</small></p>
        `,
        tags: ["affiliates", "password-set"],
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("password/start error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/password/finish", async (req, res) => {
  try {
    const token = String(req.body.token || "").trim();
    const password = String(req.body.password || "").trim();
    if (!token) return res.status(400).json({ error: "Token inválido." });
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Senha muito curta (mín. 6)." });
    }

    const { rows } = await pool.query(
      `SELECT id, reset_expires_at FROM affiliates WHERE reset_token = $1 LIMIT 1`,
      [token]
    );
    if (rows.length === 0) return res.status(400).json({ error: "Token inválido." });

    const { id, reset_expires_at } = rows[0];
    if (!reset_expires_at || new Date(reset_expires_at) < new Date()) {
      return res.status(400).json({ error: "Token expirado. Solicite novamente." });
    }

    const hash = await bcrypt.hash(password, 10);
    const upd = await pool.query(
      `UPDATE affiliates
         SET password_hash = $1,
             reset_token = NULL,
             reset_expires_at = NULL,
             updated_at = NOW()
       WHERE id = $2
       RETURNING password_hash`,
      [hash, id]
    );
    console.log("[affiliates] password updated for id", id, "hash prefix:", upd.rows[0].password_hash.slice(0, 7));
    res.json({
  ok: true,
  message: "Senha definida com sucesso.",
  next: "/afiliado/login.html"
});

  } catch (err) {
    console.error("password/finish error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// -------------- login/logout/me --------------
router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const password = String(req.body.password || "").trim();
    if (!email || !password) return res.status(400).json({ error: "Informe e-mail e senha." });

    const { rows } = await pool.query(
      `SELECT id, name, email, password_hash, role    -- [ADD role] seleciona role
         FROM affiliates
        WHERE email = $1
        ORDER BY updated_at DESC
        LIMIT 1`,
      [email]
    );
    if (rows.length === 0) return res.status(401).json({ error: "Credenciais inválidas." });

    const u = rows[0];
    if (!u.password_hash) return res.status(401).json({ error: "Senha não definida." });

    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: "Credenciais inválidas." });

    // [ADD role] guarda role na sessão
    req.session.aff = { id: u.id, email: u.email, name: u.name, role: u.role || "affiliate" };
    res.json({ ok: true, message: "Login ok" });
  } catch (e) {
    console.error("affiliates/login error:", e);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/me", (req, res) => {
  if (!req.session?.aff) return res.status(401).json({ error: "Não autenticado" });
  res.json({ me: req.session.aff });
});

// === [ADD] Visão efetiva do painel do afiliado (link e comissão travada + contato do vendedor)
router.get("/me/overview", async (req, res) => {
  try {
    if (!req.session?.aff?.id) return res.status(401).json({ error: "Não autenticado" });
    const affId = req.session.aff.id;

    // 1) base do afiliado (fallback para link/comissão padrão)
    const baseQ = await pool.query(
      `SELECT id, name, email, link, commission_percent
         FROM affiliates
        WHERE id = $1
        LIMIT 1`,
      [affId]
    );
    if (!baseQ.rowCount) return res.status(404).json({ error: "Afiliado não encontrado" });
    const base = baseQ.rows[0];

    // 2) tenta achar link travado criado por vendedor (mais recente e ativo)
    const linkQ = await pool.query(
      `SELECT al.url,
              al.pct_aff,
              al.active AS vendor_link_active,
              v.id   AS vendor_id,
              v.name AS vendor_name,
              v.email AS vendor_email,
              v.phone  AS vendor_phone        
         FROM affiliate_links al
         JOIN affiliates v ON v.id = al.vendor_id
        WHERE al.affiliate_id = $1
          AND al.active = TRUE
        ORDER BY al.created_at DESC
        LIMIT 1`,
      [affId]
    );

    let effectiveLink = base.link;
    let effectivePct  = base.commission_percent || 30;
    let vendor = null;
    let vendorLinkActive = null;

    if (linkQ.rowCount) {
      effectiveLink = linkQ.rows[0].url || effectiveLink;
      effectivePct  = Number(linkQ.rows[0].pct_aff ?? effectivePct);
      vendorLinkActive = !!linkQ.rows[0].vendor_link_active;
      vendor = {
        id:    linkQ.rows[0].vendor_id,
        name:  linkQ.rows[0].vendor_name || "",
        email: linkQ.rows[0].vendor_email || "",
         phone: linkQ.rows[0].vendor_phone || ""
      };
    }
     {
      const rawPath = String(process.env.PUBLIC_LANDING_PATH || "/quiz.html").trim() || "/quiz.html";
      const QUIZ_PATH =
        rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
      if (!/\/quiz\.html/i.test(String(effectiveLink || ""))) {
        effectiveLink = `${PUBLIC_BASE}${QUIZ_PATH}/?ref=${base.id}`;
      }
    }
    res.json({
      id: base.id,
      name: base.name,
      email: base.email,
      link: effectiveLink,
      commission_percent: effectivePct,
      vendor_contact: vendor,
      vendor_link_active: vendorLinkActive // null se não veio de vendedor
    });
  } catch (e) {
    console.error("[GET /affiliates/me/overview] error:", e);
    res.status(500).json({ error: "Erro ao carregar overview" });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// sanidade
router.get("/", (req, res) => {
  res.json({ ok: true, from: "affiliates" });
});

// -------------- perfil/KYC (titular) --------------
router.get("/me/profile", async (req, res) => {
  if (!req.session?.aff?.id) return res.status(401).json({ error: "Não autenticado" });
  const { rows } = await pool.query(
    `SELECT person_type, birth_date FROM affiliates WHERE id = $1 LIMIT 1`,
    [req.session.aff.id]
  );
  const r = rows[0] || {};
  // garanta que o front receba YYYY-MM-DD
  res.json({
    person_type: r.person_type || "FISICA",
    birth_date: r.birth_date ? toYMD(r.birth_date) : null,
  });
});

// salva tipo de pessoa + data de nascimento
router.post("/me/holder", async (req, res) => {
  try {
    if (!req.session?.aff?.id) return res.status(401).json({ error: "Não autenticado" });

    const person_type = String(req.body.person_type || "FISICA").toUpperCase() === "JURIDICA" ? "JURIDICA" : "FISICA";
    const birth_raw = req.body.birth_date ?? req.body.birthDate; // aceita os dois nomes
    const birth_date = person_type === "FISICA" ? toYMD(birth_raw) : null;

    if (person_type === "FISICA" && !birth_date) {
      return res.status(400).json({ error: "Informe a data de nascimento (YYYY-MM-DD ou DD/MM/YYYY)." });
    }

    await pool.query(
      `UPDATE affiliates
         SET person_type = $1,
             birth_date  = $2,
             updated_at  = NOW()
       WHERE id = $3`,
      [person_type, birth_date, req.session.aff.id]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error("/me/holder error:", e);
    res.status(500).json({ error: "Erro ao salvar dados do titular" });
  }
});

// -------------- vendas do afiliado --------------
router.get("/me/sales", async (req, res) => {
  const aff = req.session?.aff;
  if (!aff?.id) return res.status(401).json({ error: "Não autenticado" });

  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "10", 10)));
  const offset = Math.max(0, parseInt(req.query.offset || "0", 10));

  try {
    const listSql = `
      SELECT
        id,
        created_at,
        gateway,
        gateway_payment_id,
        amount,
        status,
        commission_percent,
        buyer_name,
        buyer_email
      FROM sales
      WHERE affiliate_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM sales
      WHERE affiliate_id = $1
    `;

    const [list, count] = await Promise.all([
      pool.query(listSql, [aff.id, limit, offset]),
      pool.query(countSql, [aff.id]),
    ]);

    res.json({ items: list.rows || [], total: count.rows?.[0]?.total || 0 });
  } catch (err) {
    if (err.code === "42P01") return res.json({ items: [], total: 0 });
    console.error("GET /affiliates/me/sales error:", err);
    res.status(500).json({ error: "Erro ao listar vendas" });
  }
});
// RESUMO: total líquido e total da comissão do afiliado (já pago)
router.get("/me/summary", async (req, res) => {
  const me = req.session?.aff;
  if (!me?.id) return res.status(401).json({ error: "Não autenticado" });

  try {
    const q = await pool.query(
      `SELECT
         COALESCE(SUM(net_amount_cents),0)::bigint AS net_cents,
         COALESCE(SUM(ROUND((net_amount_cents::numeric * commission_percent)/100)),0)::bigint AS my_cents,
         COUNT(*)::int AS qtd
       FROM sales
       WHERE affiliate_id = $1`,
      [me.id]
    );
    const r = q.rows[0];
    return res.json({
      net: Number(r.net_cents || 0) / 100,
      mine: Number(r.my_cents || 0) / 100,
      count: r.qtd || 0
    });
  } catch (e) {
    console.error("[GET /affiliates/me/summary] error:", e);
    return res.status(500).json({ error: "Falha ao calcular resumo" });
  }
});

// debug opcional
router.get("/me/sales-debug", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, affiliate_id::text AS affiliate_id, created_at, amount, status, gateway
       FROM sales
       ORDER BY created_at DESC
       LIMIT 5`
    );
    res.json({ sample: rows });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
router.post("/accept-invite", async (req, res) => {
  const b = req.body || {};
  try {
    const token = String(b.invite_token || "").trim();
    if (!token) return res.status(400).json({ error: "Convite inválido." });

    const iq = await pool.query(
      `SELECT id, vendor_id, invite_email, pct_aff 
         FROM affiliate_links
        WHERE token = $1 AND status IN ('vendors-invite','pending_review')
        LIMIT 1`,
      [token]
    );
    if (!iq.rowCount) return res.status(400).json({ error: "Convite inválido ou expirado." });
    const inv = iq.rows[0];

    // normaliza dados
    const name        = (b.name || "").trim();
    const email       = (b.email || "").trim().toLowerCase() || inv.invite_email;
    const cpf_cnpj    = (b.cpf_cnpj || "").trim();
    const phone       = (b.phone || "").trim();
    const address     = (b.address || "").trim();
    const address_num = (b.address_number || "").trim();
    const district    = (b.district || "").trim();
    const city        = (b.city || "").trim();
    const state       = (b.state || "").trim();
    const postal_code = (b.postal_code || "").trim();
    const person_type = String(b.person_type || "FISICA").toUpperCase() === "JURIDICA" ? "JURIDICA" : "FISICA";

    // data de nascimento (agora já coletada no cadastro)
    const birth_date  = person_type === "FISICA" ? toYMD(b.birth_date || b.birthDate) : null;
    if (person_type === "FISICA" && !birth_date) {
      return res.status(400).json({ error: "Informe a data de nascimento (YYYY-MM-DD ou DD/MM/YYYY)." });
    }

    // existe afiliado com este e-mail?
    const ex = await pool.query(`SELECT id FROM affiliates WHERE email = $1 LIMIT 1`, [email]);

    let affiliateId;
    if (ex.rowCount) {
      // atualiza dados essenciais + comissão proposta + vendor origem
      affiliateId = ex.rows[0].id;
      await pool.query(`
        UPDATE affiliates
   SET name=$1, cpf_cnpj=$2, phone=$3, address=$4, address_number=$5, district=$6, city=$7, state=$8, postal_code=$9,
       person_type=$10, birth_date=$11,
       commission_percent=$12,
       updated_at=NOW()
 WHERE id=$13

      `, [name, cpf_cnpj, phone, address, address_num, district, city, state, postal_code,
          person_type, birth_date,
          Number(inv.pct_aff),  affiliateId ]);
    } else {
      // cria novo afiliado já com a comissão proposta
      const id = uuid();
      const linkAfiliado = `${PUBLIC_BASE}${QUIZ_PATH}/?ref=${id}`;
      await pool.query(`
        INSERT INTO affiliates (
          id, name, email, cpf_cnpj, phone, address, address_number, district, city, state, postal_code,
          person_type, birth_date,
          commission_percent, password_hash, link, terms,
          terms_version, terms_accepted_at, terms_ip, terms_ua,
          privacy_version, privacy_accepted_at,
          role, 
          created_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
          $12,$13,
          $14, NULL, $15, TRUE,
          $16, NOW(), 'invite', 'invite',
          $17, NOW(),
          'affiliate', 
          NOW(), NOW()
        )
      `, [id, name, email, cpf_cnpj, phone, address, address_num, district, city, state, postal_code,
          person_type, birth_date,
          Number(inv.pct_aff), linkAfiliado,
          TERMS_VERSION, PRIVACY_VERSION ]);
      affiliateId = id;

      // envia e-mail para definir senha
      const reset_token = crypto.randomBytes(32).toString("hex");
      const reset_expires_at = new Date(Date.now() + 60*60*1000);
      await pool.query(`UPDATE affiliates SET reset_token=$1, reset_expires_at=$2 WHERE id=$3`, [reset_token, reset_expires_at, affiliateId]);
      await enviarEmailSimplesViaBrevo({
        nome: name || email,
        email,
        subject: "Defina sua senha - Canva Espiritual",
        htmlContent: `<p>Olá!</p><p>Para acessar seu painel, defina sua senha:</p>
                      <p><a href="${PUBLIC_BASE}/afiliado/definir-senha.html?token=${reset_token}" target="_blank">Definir senha</a></p>`,
        tags: ["affiliates","password-set"]
      }).catch(()=>{});
    }

    // vincula o link ao afiliado e deixa em revisão (ou ative se preferir)
    await pool.query(
      `UPDATE affiliate_links 
          SET affiliate_id=$1, status='pending_review', active=FALSE, accepted_at=NOW()
        WHERE id=$2`,
      [affiliateId, inv.id]
    );

    res.json({ ok:true, affiliate_id: affiliateId, status: "pending_review" });
  } catch (e) {
    console.error("POST /affiliates/accept-invite error:", e);
    res.status(500).json({ error: "Erro ao aceitar convite." });
  }
});

router.get("/affiliate-invites/:token", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) return res.status(400).json({ error: "Token inválido." });

    const q = await pool.query(`
      SELECT al.id, al.pct_aff, al.pct_vendor, al.pct_supervisor, al.invite_email,
             v.id AS vendor_id, v.name AS vendor_name, v.email AS vendor_email, v.phone AS vendor_phone
        FROM affiliate_links al
        JOIN affiliates v ON v.id = al.vendor_id
       WHERE al.token = $1 AND al.status IN ('vendors-invite','pending_review') 
       LIMIT 1
    `, [token]);

    if (!q.rowCount) return res.status(404).json({ error: "Convite não encontrado ou expirado." });

    const r = q.rows[0];
    res.json({
      invite_id: r.id,
      invite_email: r.invite_email,
      pct_aff_proposed: Number(r.pct_aff),
      pct_vendor: Number(r.pct_vendor),
      pct_supervisor: Number(r.pct_supervisor),
      vendor: { id: r.vendor_id, name: r.vendor_name, email: r.vendor_email, phone: r.vendor_phone }
    });
  } catch (e) {
    console.error("GET /affiliate-invites/:token error:", e);
    res.status(500).json({ error: "Erro interno" });
  }
});
// === SALDO DO AFILIADO (disponível/pendente/D+7) ===
router.get("/me/balance", async (req, res) => {
  const me = req.session?.aff;
  if (!me?.id) return res.status(401).json({ error: "Não autenticado" });

  try {
    // move 'pending' → 'available' quando already D+7
    await refreshAvailability(me.id, "affiliate");

    const q = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN pl_status='pending'     THEN amount_cents END),0)::int  AS pending_cents,
        COALESCE(SUM(CASE WHEN pl_status='available'   THEN amount_cents END),0)::int  AS available_cents,
        COALESCE(SUM(CASE WHEN pl_status='withdrawing' THEN amount_cents END),0)::int  AS withdrawing_cents,
        COALESCE(SUM(CASE WHEN pl_status='paid'        THEN amount_cents END),0)::int  AS paid_cents,
        MIN(CASE WHEN pl_status='pending' THEN available_at END)                       AS next_available_at
      FROM partner_ledger
      WHERE partner_id=$1 AND role='affiliate'
    `, [me.id]);

    const r = q.rows[0] || {};
    res.json({
      pending:      (r.pending_cents      || 0) / 100,
      available:    (r.available_cents    || 0) / 100,
      withdrawing:  (r.withdrawing_cents  || 0) / 100,
      paid:         (r.paid_cents         || 0) / 100,
      next_available_at: r.next_available_at
    });
  } catch (e) {
    console.error("[GET /affiliates/me/balance]", e);
    res.status(500).json({ error: "Falha ao consultar saldo." });
  }
});

// === SOLICITAR SAQUE (saca TUDO que estiver 'available' agora) ===
router.post("/me/withdraw", async (req, res) => {
  const me = req.session?.aff;
  if (!me?.id) return res.status(401).json({ error: "Não autenticado" });

  const client = await pool.connect();
  try {
    // atualiza disponibilidades
    await refreshAvailability(me.id, "affiliate");

    // snapshot do método de saque (Pix/Conta) no momento do pedido
    const method = await snapshotPayoutMethod(me.id);

    await client.query("BEGIN");

    // trava todas as linhas 'available' para este parceiro/papel
    const withdrawalId = uuid();
    const lockedCents = await lockAvailableForWithdrawTx(client, me.id, "affiliate", withdrawalId);

    if (!lockedCents) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Nenhum valor disponível para saque." });
    }

    // cria a solicitação
    await client.query(`
      INSERT INTO withdrawals (id, partner_id, role, amount_cents, method, status)
      VALUES ($1,$2,'affiliate',$3,$4::jsonb,'requested')
    `, [withdrawalId, me.id, lockedCents, JSON.stringify(method)]);

    // sandbox: liquida na hora (em produção, deixe 'processing' e liquide via webhook)
    await settleWithdrawalNowTx(client, withdrawalId);

    await client.query("COMMIT");
    res.json({ ok: true, withdrawal_id: withdrawalId, amount: lockedCents / 100, status: "paid" });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[POST /affiliates/me/withdraw]", e);
    res.status(500).json({ error: "Falha ao solicitar saque." });
  } finally {
    client.release();
  }
});

// === HISTÓRICO DE SAQUES ===
router.get("/me/withdrawals", async (req, res) => {
  const me = req.session?.aff;
  if (!me?.id) return res.status(401).json({ error: "Não autenticado" });

  try {
    const { rows } = await pool.query(`
      SELECT id, amount_cents, status, created_at, updated_at
        FROM withdrawals
       WHERE partner_id=$1 AND role='affiliate'
       ORDER BY created_at DESC
       LIMIT 50
    `, [me.id]);

    res.json(rows.map(r => ({
      id: r.id,
      amount: Number(r.amount_cents || 0) / 100,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at
    })));
  } catch (e) {
    console.error("[GET /affiliates/me/withdrawals]", e);
    res.status(500).json({ error: "Falha ao consultar saques." });
  }
});

module.exports = router;
