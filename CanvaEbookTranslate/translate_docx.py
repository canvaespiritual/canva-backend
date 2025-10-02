import os
import time
import argparse
from typing import Optional, List
from dotenv import load_dotenv

import deepl
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

from docx import Document
from docx.oxml.text.paragraph import CT_P
from docx.oxml.table import CT_Tbl
from docx.text.paragraph import Paragraph
from docx.table import Table
from tqdm import tqdm

# ===== Config =====
BATCH_SIZE = 40  # quantas frases/linhas mandamos por requisição (DeepL aceita lista)
SLEEP_BETWEEN = 0.2  # leve pausa entre lotes

# ===== Util =====
def iter_block_items(parent):
    """Itera parágrafos e tabelas na ordem em que aparecem (corpo, células, etc.)."""
    if hasattr(parent, "element") and hasattr(parent.element, "body"):
        parent_elm = parent.element.body
    else:
        parent_elm = parent._element

    for child in parent_elm.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, parent)
        elif isinstance(child, CT_Tbl):
            yield Table(child, parent)

def collect_all_paragraphs(doc: Document) -> List[Paragraph]:
    """Coleta TODOS os parágrafos do corpo, tabelas e cabeçalhos/rodapés."""
    targets: List[Paragraph] = []

    # corpo do documento (parágrafos e tabelas)
    for block in iter_block_items(doc):
        if isinstance(block, Paragraph):
            targets.append(block)
        elif isinstance(block, Table):
            for row in block.rows:
                for cell in row.cells:
                    for b in iter_block_items(cell):
                        if isinstance(b, Paragraph):
                            targets.append(b)

    # cabeçalhos/rodapés
    for section in doc.sections:
        for hdr in [section.header, section.first_page_header, section.even_page_header]:
            if hdr:
                for block in iter_block_items(hdr):
                    if isinstance(block, Paragraph):
                        targets.append(block)
                    elif isinstance(block, Table):
                        for row in block.rows:
                            for cell in row.cells:
                                for b in iter_block_items(cell):
                                    if isinstance(b, Paragraph):
                                        targets.append(b)

        for ftr in [section.footer, section.first_page_footer, section.even_page_footer]:
            if ftr:
                for block in iter_block_items(ftr):
                    if isinstance(block, Paragraph):
                        targets.append(block)
                    elif isinstance(block, Table):
                        for row in block.rows:
                            for cell in row.cells:
                                for b in iter_block_items(cell):
                                    if isinstance(b, Paragraph):
                                        targets.append(b)

    return targets

def para_text(p: Paragraph) -> str:
    if p.runs:
        return "".join(run.text for run in p.runs)
    return p.text or ""

def set_para_preserving_basic(p: Paragraph, new_text: str):
    """
    Escreve o texto traduzido no parágrafo.
    Estratégia: limpar runs e criar um novo run — preserva estrutura (tabelas/cabeçalhos).
    Observação: se o parágrafo tinha mix de negrito/itálico por palavra, isso pode simplificar.
    """
    # limpa conteúdo existente
    for r in p.runs:
        r.text = ""
    if not p.runs:
        p.add_run(new_text)
    else:
        p.runs[0].text = new_text

def chunk_list(lst, size):
    for i in range(0, len(lst), size):
        yield lst[i:i+size]

# ===== DeepL =====
class DeeplTranslator:
    def __init__(self, api_key: str, target_lang: str = "EN-US", formality: Optional[str] = None):
        self.client = deepl.Translator(api_key)
        self.target = target_lang
        self.formality = formality

    @retry(wait=wait_exponential(multiplier=1, min=1, max=20),
           stop=stop_after_attempt(6),
           retry=retry_if_exception_type(Exception))
    def translate_batch(self, texts: List[str]) -> List[str]:
        # DeepL aceita lista; devolve lista
        result = self.client.translate_text(
            texts,
            target_lang=self.target,
            formality=self.formality if self.formality else None
        )
        if isinstance(result, list):
            return [r.text for r in result]
        else:
            return [result.text]

def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description="Traduz um DOCX PT-BR → EN mantendo estrutura (parágrafos, tabelas, cabeçalhos/rodapés).")
    parser.add_argument("input_docx", help="Caminho do .docx de entrada (português).")
    parser.add_argument("output_docx", help="Caminho do .docx de saída (inglês).")
    parser.add_argument("--target", default="EN-US", help="Idioma alvo (ex.: EN-US ou EN-GB).")
    parser.add_argument("--formality", choices=["more", "less", "prefer_more", "prefer_less", "default"], default="prefer_more",
                        help="Grau de formalidade do DeepL.")
    args = parser.parse_args()

    api_key = os.getenv("DEEPL_API_KEY")
    if not api_key:
        raise RuntimeError("DEEPL_API_KEY não encontrado. Coloque no .env (DEEPL_API_KEY=...) ou exporte a variável de ambiente.")

    formality_map = {
        "more": "more", "less": "less",
        "prefer_more": "prefer_more", "prefer_less": "prefer_less",
        "default": None
    }
    translator = DeeplTranslator(api_key, target_lang=args.target, formality=formality_map[args.formality])

    print(f"→ Lendo: {args.input_docx}")
    doc = Document(args.input_docx)
    paragraphs = collect_all_paragraphs(doc)

    # coleta os textos na mesma ordem
    originals = [para_text(p) for p in paragraphs]

    translated: List[str] = []
    batches = list(chunk_list(originals, BATCH_SIZE))

    for batch in tqdm(batches, desc="Traduzindo", ncols=100):
        # evita chamadas quando o lote é todo vazio
        if any(s.strip() for s in batch):
            out = translator.translate_batch([s if s else "" for s in batch])
        else:
            out = batch
        translated.extend(out)
        time.sleep(SLEEP_BETWEEN)

    # aplica de volta
    for p, new_text in zip(paragraphs, translated):
        set_para_preserving_basic(p, new_text or "")

    doc.save(args.output_docx)
    print(f"✅ Tradução concluída: {args.output_docx}")

if __name__ == "__main__":
    main()
