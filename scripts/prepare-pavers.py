"""Import the supplied headerless, 15-column paver CSV without executing its text.

Usage: python scripts/prepare-pavers.py <pavers.csv>
Purchaser fields are separate from inscription lines; zones remain unverified.
"""
import argparse
import collections
import csv
import hashlib
import io
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
PHOTO_TEXT = {
    'eastman': 'LAURA & GREG EASTMAN FAMILY ON WISCONSIN!',
    'gibson': 'GIBSON FAMILY MEMORIES HERE',
    'christianson': 'IN LOVING MEMORY OF MARGARET CHRISTIANSON FROM AMY BA 2007 NICHOLAS BS 2006 ANDREW BBA 2002 JD 2005 PETER BA 1971 JD 1977',
    'kamp': 'CONGRATS WILLIAM CLASS OF 2015 KAMP FAMILY',
    'council': 'UNION COUNCIL EXPRESSES APPRECIATION TO THE UNION STAFF WHOSE DEDICATION, HARD WORK AND ADVICE ALLOW ALL STUDENTS, FACULTY,',
}


def fingerprint(text):
    return re.sub(r'[^A-Z0-9]', '', text.upper())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv', type=pathlib.Path)
    args = parser.parse_args()
    raw = args.csv.read_bytes()
    # This export is not valid UTF-8 or Windows-1252; retain a documented
    # Mac-Roman interpretation rather than silently dropping undecodable bytes.
    try:
        text, encoding = raw.decode('utf-8-sig'), 'utf-8-sig'
    except UnicodeDecodeError:
        text, encoding = raw.decode('mac_roman'), 'mac_roman'
    rows = list(csv.reader(io.StringIO(text)))
    records, links = [], collections.Counter()
    for index, row in enumerate(rows, 1):
        if len(row) != 15 or not re.fullmatch(r'[A-F][1-6]', row[14].strip()):
            raise ValueError(f'Unexpected column count or zone on source row {index}; review before importing.')
        lines = [value.strip() for value in row[3:14]]
        while lines and not lines[-1]:
            lines.pop()
        normalized = fingerprint(' '.join(lines))
        matches = [key for key, expected in PHOTO_TEXT.items() if normalized == fingerprint(expected)]
        if len(matches) > 1:
            raise ValueError(f'Ambiguous photo link on row {index}')
        photo = matches[0] if matches else None
        if photo:
            links[photo] += 1
        records.append({'id': f'paver-{index:04d}', 'sourceRow': index, 'firstName': row[0].strip(),
                        'lastName': row[1].strip(), 'size': row[2].strip().lower().replace(' ', ''),
                        'lines': lines, 'zone': row[14].strip(), 'photoSampleId': photo})
    if links != collections.Counter({key: 1 for key in PHOTO_TEXT}):
        raise ValueError(f'Expected exactly one reviewed inscription match per photo landmark; got {dict(links)}')
    data = {'source': args.csv.name, 'sha256': hashlib.sha256(raw).hexdigest(), 'encoding': encoding,
            'encodingNote': 'Legacy export decoded as Mac Roman when UTF-8 fails. Some source text may already be corrupted; no inscription dates or wording have been inferred or repaired.',
            'locationMeaning': 'Zone assignments supplied in CSV; not verified against current post-restoration positions. No per-paver coordinates supplied.',
            'records': records}
    target = ROOT / 'src/examples/terrace-pavers/paver-records.json'
    target.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'{len(records)} records; {len(set(r["zone"] for r in records))} reported zones; {sum(links.values())} reviewed photo links; source encoding {encoding}')


if __name__ == '__main__':
    main()
