"""Compare monthly workbooks and private statement extracts without changing map data.

Repeat --month LABEL WORKBOOK STATEMENT_CACHE in chronological order; the last
month is the baseline. Statement caches are produced by extract-commission-locations.py
or equivalent reviewed text extraction. Output contains no machine IDs or finances.
"""
import argparse
import csv
import importlib.util
import json
import pathlib
import sys

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('prepare_vending', pathlib.Path(__file__).with_name('prepare-vending.py'))
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--month', nargs=3, action='append', required=True, metavar=('LABEL', 'WORKBOOK', 'STATEMENT_CACHE'))
    parser.add_argument('--out-dir', required=True, type=pathlib.Path)
    args = parser.parse_args()
    months = []
    for label, workbook, cache in args.month:
        if label in [m['label'] for m in months]:
            raise ValueError(f'Duplicate month label: {label}')
        groups = prepare.read_locations(workbook)
        statements = {}
        for path in pathlib.Path(cache).glob('*-location-review.json'):
            for row in json.loads(path.read_text(encoding='utf-8')):
                key = (row['account'], row['location'])
                if key in statements:
                    raise ValueError(f'Duplicate statement key in {label}: {key}')
                if key not in groups or set(row['machines']) != groups[key]['machines']:
                    raise ValueError(f'Statement/workbook machine mismatch in {label}: {key}')
                statements[key] = row
        months.append({'label': label, 'workbook': pathlib.Path(workbook).name, 'groups': groups, 'statements': statements})
    baseline = months[-1]['groups']
    summary = []
    rows = []
    for month in months:
        groups, statements = month['groups'], month['statements']
        shared = groups.keys() & baseline.keys()
        summary.append({
            'label': month['label'], 'workbook': month['workbook'],
            'reportedLocations': len(groups), 'reportedMachines': sum(len(g['machines']) for g in groups.values()),
            'statementLocationsVerified': len(statements),
            'statementMachinesVerified': sum(len(r['machines']) for r in statements.values()),
            'workbookLocationsWithoutStatement': len(groups.keys() - statements.keys()),
            'locationsAbsentFromBaseline': len(groups.keys() - baseline.keys()),
            'changedWorkbookNameGroups': sum(groups[k]['names'] != baseline[k]['names'] for k in shared),
            'differentMachineListGroups': sum(groups[k]['machines'] != baseline[k]['machines'] for k in shared),
        })
        for key in sorted(baseline, key=lambda k: (k[0], int(k[1]))):
            older = groups.get(key)
            statement = statements.get(key)
            rows.append([month['label'], *key, '; '.join(sorted(older['names'])) if older else '',
                         '; '.join(statement['names']) if statement else '', len(older['machines']) if older else '',
                         len(baseline[key]['machines']), len(older['machines'] & baseline[key]['machines']) if older else 0,
                         'exact match' if statement else 'not supplied' if older else 'no sales row this month',
                         '; '.join(map(str, statement['pages'])) if statement else ''])
    args.out_dir.mkdir(parents=True, exist_ok=True)
    with (args.out_dir / 'monthly-vending-comparison.csv').open('w', newline='', encoding='utf-8-sig') as output:
        writer = csv.writer(output)
        writer.writerow(['Month label', 'Account', 'Location', 'Workbook names', 'Statement names', 'Month machines', 'Baseline machines', 'Machines shared with baseline', 'Statement/workbook machine validation', 'Statement pages'])
        writer.writerows(rows)
    (args.out_dir / 'monthly-vending-summary.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
