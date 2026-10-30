"""Extract a facility PDF and audit reviewed vending matches; outputs stay local.

Requires PyMuPDF. Usage: python scripts/audit-facility-pdf.py <pdf> --out-dir <private-folder>
No PDF content is executed. Numeric equality alone never assigns a vendor location.
"""
import argparse
import csv
import json
import pathlib
import re
import pymupdf

ROOT = pathlib.Path(__file__).resolve().parent.parent


def write_csv(path, records):
    with path.open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(records[0]))
        writer.writeheader()
        writer.writerows(records)


def normalize(address):
    value = re.sub(r'[^a-z0-9]', '', address.lower())
    for word, short in [('street', 'st'), ('avenue', 'ave'), ('drive', 'dr'), ('road', 'rd'), ('north', 'n'), ('south', 's'), ('east', 'e'), ('west', 'w')]:
        value = value.replace(word, short)
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf')
    parser.add_argument('--out-dir', type=pathlib.Path, required=True)
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    facilities = []
    with pymupdf.open(args.pdf) as document:
        for index, page in enumerate(document):
            # Reuse the page's text cache; rebuilding it for every cell is costly.
            textpage = page.get_textpage()
            for table in page.find_tables().tables:
                for row in table.rows:
                    fields = [' '.join(page.get_textbox(pymupdf.Rect(cell), textpage=textpage).split()) if cell else '' for cell in row.cells]
                    if len(fields) == 6 and re.fullmatch(r'\d{4}[A-Z]?', fields[0]):
                        facilities.append(dict(zip(['facility', 'name', 'address', 'city', 'state', 'zip'], fields)) | {'pdf_page': index + 1})
    if not facilities or len({f['facility'] for f in facilities}) != len(facilities):
        raise ValueError('No facility table found or duplicate IDs; review extraction before use')
    by_code = {f['facility']: f for f in facilities}
    data = json.loads((ROOT / 'src/examples/campus-map/vending-locations.json').read_text(encoding='utf-8'))
    by_map_id = {b['mapObjectId']: b for b in data['buildings']}
    matches = json.loads((ROOT / 'scripts/vending-building-matches.json').read_text(encoding='utf-8'))
    audit = []
    for match in matches:
        host = by_map_id.get(match['mapObjectId'])
        facility = by_code.get(host['buildingNumber']) if host else None
        if facility:
            status = 'mapped_address_verified' if normalize(host['address']) == normalize(facility['address']) else 'mapped_address_needs_review'
            notes = 'Building match retained; PDF does not establish current vending service or exact floor position.'
        elif host:
            status = 'mapped_not_in_pdf_under_source_id'
            notes = 'Retain existing public-source mapping; absence from this facility list is not evidence of closure.'
        elif match['expectedSourceNames']:
            status = 'named_vendor_record_needs_building_confirmation'
            notes = match['reason']
        else:
            status = 'unnamed_vendor_id_no_crosswalk'
            coincidence = by_code.get(match['location'].zfill(4))
            notes = f"Numeric coincidence only: {coincidence['facility']} {coincidence['name']}. NOT a verified vendor match." if coincidence else 'No defensible building assignment from an accountless facility-number comparison.'
        audit.append({'account': match['account'], 'vendor_location_id': match['location'], 'vendor_names': ' | '.join(match['expectedSourceNames']), 'map_host': host['name'] if host else '', 'facility_number': facility['facility'] if facility else '', 'facility_name': facility['name'] if facility else '', 'facility_address': facility['address'] if facility else '', 'pdf_page': facility['pdf_page'] if facility else '', 'status': status, 'notes': notes})
    supplemental = []
    for match in json.loads((ROOT / 'scripts/supplemental-vending-matches.json').read_text(encoding='utf-8')):
        host = by_map_id.get(match['mapObjectId'])
        facility = by_code.get(host['buildingNumber']) if host else None
        supplemental.append({'vendor_location_id': match['location'], 'vendor_name': match['name'], 'map_host': host['name'] if host else '', 'facility_number': facility['facility'] if facility else '', 'pdf_page': facility['pdf_page'] if facility else '', 'status': 'mapped_host_verified_in_pdf' if facility else 'pending_vendor_building_confirmation', 'notes': match.get('reason', 'Previously reviewed named host; no new machine count inferred.')})
    write_csv(args.out_dir / 'facility-list-private.csv', facilities)
    write_csv(args.out_dir / 'sales-location-audit.csv', audit)
    write_csv(args.out_dir / 'supplemental-location-audit.csv', supplemental)
    print(f'Extracted {len(facilities)} unique facilities; audited {len(audit)} sales locations and {len(supplemental)} supplemental references.')
    print('Full extraction and audit CSVs are local review artifacts, not website data.')


if __name__ == '__main__':
    main()
