"""
@fileoverview Extraherar Aeonik-subset från PTS-PDF, deduplicerar och konverterar till WOFF2.
Kör från projektroten: py scripts/extract_aeonik_from_pdf.py [pdf_sökväg]
"""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

import pymupdf as fitz
from fontTools.ttLib import TTFont


def find_pdf_path(arg: str | None) -> Path:
    if arg:
        path = Path(arg)
        if path.is_file():
            return path
        raise SystemExit(f"PDF hittades inte: {path}")

    test_dir = Path("testdokument")
    candidates = sorted(test_dir.glob("*.pdf"))
    if not candidates:
        raise SystemExit("Ingen PDF i testdokument/")
    return candidates[0]


def extract_aeonik_fonts(pdf_path: Path, output_dir: Path) -> dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)

    seen_hashes: dict[str, tuple[str, bytes, str]] = {}

    for page in doc:
        for font in page.get_fonts(full=True):
            xref = font[0]
            name, ext, _font_type, content = doc.extract_font(xref)
            if "Aeonik" not in name:
                continue

            digest = hashlib.sha256(content).hexdigest()
            if digest in seen_hashes:
                continue
            seen_hashes[digest] = (name, content, ext or "ttf")

    doc.close()

    extracted: dict[str, Path] = {}
    for name, content, ext in seen_hashes.values():
        label = "Bold" if "Bold" in name else "Regular"
        ttf_path = output_dir / f"Aeonik-{label}-subset.{ext}"
        ttf_path.write_bytes(content)
        extracted[label] = ttf_path
        print(f"Extraherad ({name}): {ttf_path} ({len(content)} byte)")

    if not extracted:
        raise SystemExit("Inga Aeonik-fonter hittades i PDF:en.")

    return extracted


def ttf_to_woff2(ttf_path: Path, woff2_path: Path) -> None:
    font = TTFont(ttf_path)
    font.flavor = "woff2"
    font.save(woff2_path)
    print(f"WOFF2 skapad: {woff2_path} ({woff2_path.stat().st_size} byte)")


def main() -> None:
    pdf_path = find_pdf_path(sys.argv[1] if len(sys.argv) > 1 else None)
    print(f"PDF: {pdf_path}")

    work_dir = Path("testdokument/extraherade_fonter")
    extracted = extract_aeonik_fonts(pdf_path, work_dir)

    fonts_dest = Path("shared/report_assets/fonts")
    fonts_dest.mkdir(parents=True, exist_ok=True)

    for label, ttf_path in extracted.items():
        woff2_dest = fonts_dest / f"Aeonik-{label}.woff2"
        ttf_to_woff2(ttf_path, woff2_dest)

    print("Klart. Fonter uppdaterade i shared/report_assets/fonts/")


if __name__ == "__main__":
    main()
