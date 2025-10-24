# translate_to_i18n.py  (v2-autodetect + RealDictCursor fix)
import os, re, time, requests, psycopg2, psycopg2.extras
from dotenv import load_dotenv
from tqdm import tqdm
from urllib.parse import urlencode

VERSION = "v2-autodetect"
print(f"[translate_to_i18n] starting {VERSION}")

load_dotenv()

DATABASE_URL  = os.getenv("DATABASE_URL")
DEEPL_API_KEY = os.getenv("DEEPL_API_KEY")
DEEPL_API_URL = os.getenv("DEEPL_API_URL", "https://api-free.deepl.com/v2/translate")

TABLES = [
    {"entity": "mapa_da_alma",    "table": "mapa_da_alma"},
    {"entity": "predisposicoes",  "table": "predisposicoes"},
    {"entity": "mapa_espiritual", "table": "mapa_espiritual"},
    {"entity": "arquetipos",      "table": "arquetipos"},
]

TARGET_LANG_DEFAULT = "en"
DEEPL_BATCH_SIZE = 40

SKIP_CODE_RE   = re.compile(r"^[A-Za-z0-9_\-]{1,12}$")
LIKELY_ID_COLS = {"id","codigo","cod","uid","code"}
TEXT_TYPES     = {"text","character varying","varchar"}

def connect():
    return psycopg2.connect(DATABASE_URL)

def get_text_columns(cur, table):
    """Descobre colunas textuais (com RealDictCursor)."""
    cur.execute("""
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = %s
      ORDER BY ordinal_position
    """, (table,))
    cols = []
    for row in cur.fetchall():
        col = row["column_name"]
        typ = row["data_type"].lower()
        if typ in TEXT_TYPES:
            cols.append(col)
    return cols

def guess_id_column(cur, table):
    """Acha uma coluna de ID/código (com RealDictCursor)."""
    cur.execute("""
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = %s
    """, (table,))
    names = {r["column_name"] for r in cur.fetchall()}

    for c in LIKELY_ID_COLS:
        if c in names:
            return c
    for n in names:
        if n.lower() == "id":
            return n

    # primeiro nome pela ordem
    cur.execute(
        'SELECT column_name FROM information_schema.columns WHERE table_name=%s ORDER BY ordinal_position LIMIT 1',
        (table,)
    )
    row = cur.fetchone()
    return row["column_name"] if row else None

def fetch_rows(cur, table, id_col, fields):
    collist = ','.join([f'"{id_col}"'] + [f'"{f}"' for f in fields])
    cur.execute(f'SELECT {collist} FROM "{table}"')
    return cur.fetchall()

def normalize_text(s):
    if s is None:
        return None
    s = str(s).strip()
    if not s:
        return None
    if SKIP_CODE_RE.match(s):
        return None
    return s

def deepl_translate_batch(texts, source_lang="PT", target_lang="EN"):
    if not texts:
        return []
    params = [("target_lang", target_lang), ("source_lang", source_lang)]
    for t in texts:
        params.append(("text", t))
    headers = {
        "Authorization": f"DeepL-Auth-Key {DEEPL_API_KEY}",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    r = requests.post(DEEPL_API_URL, data=urlencode(params), headers=headers, timeout=60)
    r.raise_for_status()
    data = r.json()
    return [item["text"] for item in data["translations"]]

def upsert_translation(cur, entity, entity_id, field, lang, text):
    cur.execute("""
      INSERT INTO i18n_translations (entity, entity_id, field, lang, text)
      VALUES (%s,%s,%s,%s,%s)
      ON CONFLICT (entity, entity_id, field, lang)
      DO UPDATE SET text=EXCLUDED.text
    """, (entity, entity_id, field, lang, text))

def already_translated(cur, entity, entity_id, field, lang):
    cur.execute("""
      SELECT 1 FROM i18n_translations
      WHERE entity=%s AND entity_id=%s AND field=%s AND lang=%s
      LIMIT 1
    """, (entity, entity_id, field, lang))
    return cur.fetchone() is not None

def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default=TARGET_LANG_DEFAULT, help="en | es | fr ...")
    ap.add_argument("--source", default="PT", help="PT | ES ... (idioma fonte)")
    ap.add_argument("--dry-run", action="store_true", help="Apenas contar/mostrar; não chama DeepL nem grava")
    args = ap.parse_args()

    target_lang = args.lang.lower()
    deepl_target = target_lang.upper()
    deepl_source = args.source.upper()

    conn = connect()
    conn.autocommit = False
    try:
        # Usaremos RealDictCursor em TODO o fluxo
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        work_items = []
        text_to_keys = {}

        for cfg in TABLES:
            entity = cfg["entity"]
            table  = cfg["table"]

            id_col   = guess_id_column(cur, table)
            txt_cols = get_text_columns(cur, table)

            if not id_col:
                print(f"[WARN] Sem coluna de ID detectada em {table}; pulando.")
                continue
            if not txt_cols:
                print(f"[INFO] Sem colunas textuais em {table}; pulando.")
                continue

            # remove prováveis IDs do conjunto textual
            txt_cols = [c for c in txt_cols if c.lower() not in LIKELY_ID_COLS]

            print(f"[{table}] id_col detectada: {id_col}")
            print(f"[{table}] colunas textuais: {txt_cols}")

            rows = fetch_rows(cur, table, id_col, txt_cols)
            for row in rows:
                entity_id = str(row[id_col]).strip() if row[id_col] is not None else None
                if not entity_id:
                    continue
                for f in txt_cols:
                    pt_text = normalize_text(row[f])
                    if not pt_text:
                        continue
                    if already_translated(cur, entity, entity_id, f, target_lang):
                        continue
                    key = (entity, entity_id, f)
                    work_items.append({"key": key, "pt_text": pt_text})
                    text_to_keys.setdefault(pt_text, []).append(key)

        unique_texts = list(text_to_keys.keys())
        print(f"Coletados {len(work_items)} textos (únicos: {len(unique_texts)})")

        if args.dry_run:
            print("DRY-RUN: nada será traduzido/gravado.")
            return

        translated_map = {}
        B = DEEPL_BATCH_SIZE
        for i in tqdm(range(0, len(unique_texts), B), desc=f"Traduzindo -> {deepl_target}"):
            chunk = unique_texts[i:i+B]
            tries = 0
            while True:
                try:
                    out = deepl_translate_batch(chunk, source_lang=deepl_source, target_lang=deepl_target)
                    break
                except Exception as e:
                    tries += 1
                    if tries >= 3:
                        raise
                    time.sleep(2 * tries)
            for src, dst in zip(chunk, out):
                translated_map[src] = dst

        saved = 0
        for pt_text, keys in text_to_keys.items():
            tx = translated_map.get(pt_text)
            if not tx:
                continue
            for (entity, entity_id, field) in keys:
                upsert_translation(cur, entity, entity_id, field, target_lang, tx)
                saved += 1

        conn.commit()
        print(f"OK! Gravadas/atualizadas {saved} traduções (lang={target_lang}).")

    finally:
        conn.close()

if __name__ == "__main__":
    main()
