"""Local OCR audit for vendor statements. Never writes financial amounts to app data.

Requires PyMuPDF, numpy, rapidocr-onnxruntime. Output directory must be private.
Usage: python scripts/extract-commission-locations.py <statement-folder> --out-dir <private-folder>
OCR headers and machine IDs require review against the original PDFs/workbook.
"""
import argparse
import json
import pathlib
import re
import numpy as np
import pymupdf
from rapidocr_onnxruntime import RapidOCR


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder', type=pathlib.Path)
    parser.add_argument('--out-dir', required=True, type=pathlib.Path)
    parser.add_argument('--parse-only', action='store_true', help='Reparse cached OCR without running recognition')
    parser.add_argument('--accounts', nargs='+', default=['1026', '1028', '1025'])
    parser.add_argument('--prefix', default='P12', help='Statement filename prefix; caches must use a separate directory per period')
    parser.add_argument('--statement', action='append', default=[], metavar='ACCOUNT=FILENAME', help='Explicit filename override; account comes from document contents, not its filename')
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    ocr = None if args.parse_only else RapidOCR()
    filenames = dict(value.split('=', 1) for value in args.statement)
    for account, suffix in [('1026', 'Housing'), ('1028', 'Hist Soc'), ('1025', 'UW Campus')]:
        if account not in args.accounts:
            continue
        filename = filenames.get(account, f'{args.prefix} Commission Statement {account} {suffix}.pdf')
        document = pymupdf.open(args.folder / filename)
        records = {}
        current = None
        for index, page in enumerate(document):
            cache = args.out_dir / f'{account}-page-{index + 1}-ocr.json'
            if cache.exists():
                result = json.loads(cache.read_text(encoding='utf-8'))
            else:
                if args.parse_only:
                    raise ValueError(f'Missing OCR cache: {cache}')
                clip = pymupdf.Rect(0, 0, page.rect.width * .39, page.rect.height)
                pix = page.get_pixmap(matrix=pymupdf.Matrix(2.5, 2.5), clip=clip, alpha=False)
                pixels = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).copy()
                result, _ = ocr(pixels)
                result = result or []
                cache.write_text(json.dumps(result), encoding='utf-8')
            # Merge OCR fragments sharing a baseline, retaining their source boxes.
            lines = []
            for box, text, score in sorted(result, key=lambda item: min(p[1] for p in item[0])):
                y = sum(p[1] for p in box) / 4
                line = next((line for line in lines if abs(line['y'] - y) < 12), None)
                if line is None:
                    line = {'y': y, 'parts': []}
                    lines.append(line)
                line['parts'].append((min(p[0] for p in box), text, float(score)))
            for line in lines:
                parts = sorted(line['parts'])
                text = ' '.join(part[1] for part in parts)
                match = re.search(r'locati[o0]n[\s:_()\-]*([0-9OoIlL|]{3})\s*(.+)', text, re.I)
                if match:
                    loc = str(int(match[1].translate(str.maketrans('OoIlL|', '001111'))))
                    current = loc
                    entry = records.setdefault(loc, {'account': account, 'location': loc, 'names': [], 'machines': [], 'pages': []})
                    name = match[2].strip(' _:-')
                    if name not in entry['names']:
                        entry['names'].append(name)
                    if index + 1 not in entry['pages']:
                        entry['pages'].append(index + 1)
                if current is not None:
                    for x, token, score in parts:
                        if x < page.rect.width * 2.5 * .12 and re.fullmatch(r'\d{5}', token):
                            if token not in records[current]['machines']:
                                records[current]['machines'].append(token)
            (args.out_dir / f'{account}-location-review.json').write_text(json.dumps(list(records.values()), indent=2), encoding='utf-8')
            print(f'{account}: OCR page {index + 1}/{len(document)}; {len(records)} location headers', flush=True)
        print(f'{account} LOCATION HEADERS: ' + json.dumps({loc: entry['names'] for loc, entry in records.items()}), flush=True)


if __name__ == '__main__':
    main()
