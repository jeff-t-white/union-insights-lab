"""Validate private workbook joins against reviewed, same-period statement evidence."""
import hashlib


def machine_signature(machines):
    return hashlib.sha256('\n'.join(sorted(machines)).encode('utf-8')).hexdigest()


def validated_statements(manifest, groups, period):
    if manifest['period'] != period:
        raise ValueError('Commission evidence belongs to a different report period; review new statements first.')
    rows = {}
    for row in manifest['locations']:
        key = (row['account'], row['location'])
        if key in rows:
            raise ValueError(f'Duplicate statement account/location: {key}')
        group = groups.get(key)
        if group is None or len(group['machines']) != row['machineCount'] or machine_signature(group['machines']) != row['machineSignature']:
            raise ValueError(f'Statement machine list differs from workbook for {key}; review before importing.')
        rows[key] = row
    if rows.keys() != groups.keys():
        raise ValueError('Statement and workbook location coverage differ; review before importing.')
    return rows
