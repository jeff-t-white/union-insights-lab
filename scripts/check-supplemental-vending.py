"""Check supplemental evidence matching without a private workbook."""
import json
from unittest.mock import patch
from supplemental_vending import append_supplemental


def building(source, provider):
    return {'mapObjectId': source['id'], 'name': source['name'], 'provider': provider,
            'machineCount': 0, 'locationCount': 0, 'supplementalOnly': False,
            'supplementalAreas': [], 'supplementalEvidence': [], 'supplementalReferences': []}


campus = {i: {'id': i, 'name': name} for i, name in [(486, 'Waisman Center'), (366, 'Computer Sciences'), (417, 'Law Building'), (454, 'Rust-Schreiner Hall')]}
existing = building(campus[366], 'union')
existing.update(machineCount=3, locationCount=1)
data = {'buildings': [existing]}
rows = {
    10: [
        {'A': 'private-machine-one', 'B': 'Waisman Center 6th fl', 'C': '23'},
        {'A': 'private-machine-two', 'B': 'DoIT Center-3rd Fl', 'C': '32'},
        {'A': 'private-machine-three', 'B': 'Law Bldg Career Serv-1st', 'C': '75'},
        # A reused numeric ID alone must not match a reviewed building.
        {'A': 'private-machine-four', 'B': 'A different Housing building', 'C': '87'},
        # An accountless lookup row can be linked only by its explicit machine.
        {'A': '10101', 'B': 'Rust/Schreiner House'},
        {'A': '20202', 'B': 'Rust/Schreiner House', 'C': '163'},
    ],
    6: [{'A': 'Campus'}, {'A': 'private-machine-two'}, {'A': '22225', 'B': '75'}, {'A': '10101', 'B': '163'}, {'A': 'Housing'}],
}
with patch('supplemental_vending.read_supplemental_rows', return_value=rows):
    append_supplemental(data, 'unused.xlsx', campus, building)
assert len(data['buildings']) == 4, 'Existing host building should be enriched, not duplicated'
assert data['supplementalMappedLocations'] == 4
assert existing['machineCount'] == 3 and existing['locationCount'] == 1, 'Lookup references must not inflate sales counts'
assert existing['supplementalAreas'] == ['DoIT Center-3rd Fl']
assert 'Not Serviced this Month' in existing['supplementalEvidence']
law = next(b for b in data['buildings'] if b['mapObjectId'] == 417)
assert law['supplementalOnly'] and law['machineCount'] == 0
assert 'Not Serviced this Month' in law['supplementalEvidence']
assert any(r['location'] == '87' and 'changed' in r['reason'] for r in data['supplementalPending'])
assert not any(r['location'] == '163' for r in data['supplementalPending'])
rust = next(b for b in data['buildings'] if b['mapObjectId'] == 454)
assert rust['provider'] == 'union' and rust['supplementalOnly']
assert 'Not Serviced this Month' in rust['supplementalEvidence']
assert '10101' not in json.dumps(data) and '20202' not in json.dumps(data)
assert 'private-machine' not in json.dumps(data), 'Never export raw supplemental machine IDs'
print('Supplemental vending checks passed: reviewed names/IDs, existing-building merge, evidence, unchanged sales counts, pending entries, and private-ID exclusion.')
