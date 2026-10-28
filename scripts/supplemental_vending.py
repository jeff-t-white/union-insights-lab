"""Review worksheet 10 names and worksheet 6 evidence without publishing machine IDs."""
import json
import pathlib
import re
import xml.etree.ElementTree as ET
import zipfile

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def read_supplemental_rows(path):
    result = {}
    with zipfile.ZipFile(path) as archive:
        strings = [''.join(e.itertext()) for e in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('m:si', NS)]
        relationships = {e.attrib['Id']: e.attrib['Target'] for e in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        sheets = ET.fromstring(archive.read('xl/workbook.xml')).findall('m:sheets/m:sheet', NS)
        for index in (5, 9):
            sheet = sheets[index]
            target = relationships[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
            member = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            rows = []
            for row in ET.fromstring(archive.read(member)).findall('m:sheetData/m:row', NS):
                values = {}
                for cell in row.findall('m:c', NS):
                    value = cell.find('m:v', NS)
                    text = value.text if value is not None else ''.join(cell.itertext()) if cell.attrib.get('t') == 'inlineStr' else ''
                    if cell.attrib.get('t') == 's':
                        text = strings[int(text)]
                    if text:
                        values[re.sub(r'\d', '', cell.attrib['r'])] = text.strip()
                if values:
                    rows.append(values)
            result[index + 1] = rows
    return result


def append_supplemental(data, workbook, campus, make_building):
    rows = read_supplemental_rows(workbook)
    matches = json.loads((pathlib.Path(__file__).parent / 'supplemental-vending-matches.json').read_text(encoding='utf-8'))
    pending = []
    matched = 0
    resolved_not_serviced = set()
    for match in matches:
        if match.get('matchVia') == 'not_serviced_machine_id':
            account = '1025'
            machine_ids = set()
            for row in rows[6]:
                if row.get('A') == 'Housing':
                    account = '1026'
                if account == match['account'] and row.get('B') == match['location'] and row.get('A', '').isdigit():
                    machine_ids.add(row['A'])
            references = [r for r in rows[10] if r.get('A') in machine_ids and r.get('B') == match['name']]
        else:
            references = [r for r in rows[10] if r.get('C') == match['location'] and r.get('B') == match['name']]
        if not references or not match['mapObjectId']:
            pending.append({'location': match['location'], 'name': match['name'], 'reason': match.get('reason') if references else 'Reviewed lookup name missing or changed; re-review required.'})
            continue
        # Match rows by name AND lookup number, never by an accountless ID alone.
        machine_ids = {r['A'] for r in references}
        in_not_serviced = any(r.get('A') in machine_ids for r in rows[6])
        # Law also has an explicit Campus/location-75 row in worksheet 6.
        if match['location'] == '75':
            in_not_serviced = in_not_serviced or any(r.get('B') == '75' and r.get('A', '').isdigit() for r in rows[6])
        existing = next((b for b in data['buildings'] if b['mapObjectId'] == match['mapObjectId']), None)
        if existing is None:
            existing = make_building(campus[match['mapObjectId']], 'union' if match.get('account') == '1025' else 'other')
            existing['supplementalOnly'] = True
            existing['managementLabel'] = 'Management account unconfirmed in provider lookup'
            if match.get('account') == '1025':
                existing['managementLabel'] = 'Campus vending account (not-serviced reference)'
            data['buildings'].append(existing)
        existing['supplementalAreas'] = sorted(set(existing['supplementalAreas']) | {match['name']})
        existing['supplementalEvidence'] = sorted(set(existing['supplementalEvidence']) | {'Milk Location Lookup'} | ({'Not Serviced this Month'} if in_not_serviced else set()))
        existing['supplementalReferences'] = sorted(set(existing['supplementalReferences']) | {match['reference']})
        matched += 1
        if match.get('matchVia') == 'not_serviced_machine_id':
            resolved_not_serviced.add((match['account'], match['location']))
    # These IDs have explicit Campus rows but no reliable host-building name.
    campus_section = True
    for row in rows[6]:
        if row.get('A') == 'Housing':
            campus_section = False
        if campus_section and row.get('B') in ('163', '189') and row.get('A', '').isdigit() and ('1025', row['B']) not in resolved_not_serviced:
            entry = {'account': '1025', 'location': row['B'], 'name': None, 'reason': 'Not-serviced machine has a location ID but no host-building name.'}
            if entry not in pending:
                pending.append(entry)
    data['supplementalMappedLocations'] = matched
    data['supplementalPending'] = pending
    data['buildings'].sort(key=lambda b: b['name'])
