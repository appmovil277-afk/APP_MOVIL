from pathlib import Path
import re

from docx import Document


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "Documentacion-TallerFlow-Muebles.docx"


def add_markdown_file(document: Document, path: Path, heading: str) -> None:
    document.add_heading(heading, level=1)
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text:
            continue
        if text.startswith("# "):
            document.add_heading(text[2:], level=2)
        elif text.startswith("## "):
            document.add_heading(text[3:], level=3)
        elif text.startswith("- "):
            document.add_paragraph(text[2:], style="List Bullet")
        elif re.match(r"^\d+\.", text):
            document.add_paragraph(text, style="List Number")
        else:
            document.add_paragraph(text)


def add_improvements(document: Document, path: Path) -> None:
    document.add_heading("250 mejoras", level=1)
    content = path.read_text(encoding="utf-8")
    blocks = content.split("items: [")
    category_titles = re.findall(r"title: '([^']+)'", content)

    for index, title in enumerate(category_titles):
        if index >= len(blocks) - 1:
            break
        items_block = blocks[index + 1].split("],", 1)[0]
        items = re.findall(r"'([^']+)'", items_block)
        document.add_heading(title, level=2)
        for item in items:
            document.add_paragraph(item, style="List Bullet")


def main() -> None:
    document = Document()
    document.add_heading("TallerFlow Muebles", level=0)
    document.add_paragraph("Documentación funcional, operativa y técnica de la aplicación móvil.")

    add_markdown_file(document, ROOT / "README.md", "Resumen ejecutivo")
    add_markdown_file(document, ROOT / "docs" / "documentacion.md", "Documentación funcional")
    add_markdown_file(document, ROOT / "docs" / "firebase-setup.md", "Guía Firebase")
    add_improvements(document, ROOT / "src" / "constants" / "improvements.ts")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    document.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    main()
