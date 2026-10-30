"""Exercise same-period commission joins without the user's private documents."""
import copy
import json
from pathlib import Path
from commission_vending import machine_signature, validated_statements


groups = {
    ('1025', '1'): {'machines': {'sample-a', 'sample-b'}},
    ('1026', '1'): {'machines': {'sample-c'}},
}
manifest = {'period': 'September 2026', 'locations': [
    {'account': account, 'location': location, 'machineCount': len(group['machines']),
     'machineSignature': machine_signature(group['machines'])}
    for (account, location), group in groups.items()
]}
joined = validated_statements(manifest, groups, 'September 2026')
assert len(joined) == 2, 'Reused location numbers must remain separate by account'
assert machine_signature({'sample-b', 'sample-a'}) == machine_signature({'sample-a', 'sample-b'})


def rejects(evidence, workbook, period='September 2026'):
    try:
        validated_statements(evidence, workbook, period)
    except ValueError:
        return
    raise AssertionError('Unsafe statement/workbook join was accepted')


changed = copy.deepcopy(groups)
changed[('1025', '1')]['machines'] = {'sample-a', 'replacement-machine'}
rejects(manifest, changed)  # Same count, different machines: must not silently match.
rejects(manifest, groups, 'October 2026')
rejects(manifest, {('1025', '1'): groups[('1025', '1')]})
duplicate = copy.deepcopy(manifest)
duplicate['locations'].append(duplicate['locations'][0])
rejects(duplicate, groups)

root = Path(__file__).resolve().parent.parent
data = json.loads((root / 'src/examples/campus-map/vending-locations.json').read_text(encoding='utf-8'))
buildings = {b['mapObjectId']: b for b in data['buildings']}
assert sum(b['machineCount'] for b in data['buildings']) + sum(r['machineCount'] for r in data['unresolved']) == 237
assert sum(b['locationCount'] for b in data['buildings']) + len(data['unresolved']) == 111
assert buildings[472]['areas'] == ['Sterling Hall \u2014 ground floor, room 1305'], 'Stale Shell alias must not survive the statement correction'
assert buildings[729]['machineCount'] == 4 and buildings[729]['locationCount'] == 2
assert buildings[729]['diningBuildingId'] == 'way/1391651477'
assert buildings[347]['diningBuildingId'] == buildings[360]['diningBuildingId']
assert buildings[347]['rings'] != buildings[360]['rings'], 'Vending must retain individual hall footprints'
assert buildings[362]['name'] == 'Chamberlin House (Kronshage)', 'Do not confuse the residence with academic Chamberlin Hall'
historical = next(b for b in data['buildings'] if b['provider'] == 'other' and b['locationCount'] == 2)
assert historical['areas'] == ['Historical Society \u2014 1st floor', 'Historical Society \u2014 3rd floor']
assert all('initObj=None' not in b['coordinateSource'] for b in data['buildings'])
print('Commission account/machine/period validation and reviewed map corrections passed.')
