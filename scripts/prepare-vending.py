"""Import location metadata from sales sheets 7–9 and supplemental sheets 6/10.

Usage: python scripts/prepare-vending.py <workbook.xlsx> <campus-map-source.json>
The second argument is a saved https://map.wisc.edu/api/v1/map_objects.geojson.
Explicit reviewed matches live in vending-building-matches.json. No financial
values or individual machine numbers are written to the application dataset.
"""
import argparse
import collections
import datetime
import json
import math
import pathlib
import re
import xml.etree.ElementTree as ET
import zipfile
from supplemental_vending import append_supplemental
from commission_vending import validated_statements

ROOT = pathlib.Path(__file__).resolve().parent.parent
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
SOURCE = "https://map.wisc.edu/api/v1/map_objects.geojson"
PRINTING_FOOTPRINT = json.loads((ROOT / 'src/examples/campus-map/printing-services-footprint.json').read_text(encoding='utf-8'))
WORKDAY_EVIDENCE = json.loads((ROOT / 'scripts/workday-vending-evidence.json').read_text(encoding='utf-8'))['buildings']
FACILITY_REVIEW = json.loads((ROOT / 'scripts/facility-reviewed-vending-evidence.json').read_text(encoding='utf-8'))['buildings']
# Reuse reviewed dining geometry for shared buildings so both outlines align.
DINING_BUILDING_IDS = {
    647: 'way/153660065', 689: 'way/174188355', 490: 'way/37749300',
    551: 'way/38855860', 378: 'way/56997838', 721: 'relation/17899257',
    407: 'way/38855397', 397: 'way/107463323', 404: 'way/38855398',
    385: 'way/103242254', 374: 'way/37751511', 360: 'way/39201164',
    546: 'way/102239119', 534: 'way/173709889',
    347: 'way/39201164', 729: 'way/1391651477',
}


def make_building(building, provider, dining):
    override = PRINTING_FOOTPRINT if building['id'] == PRINTING_FOOTPRINT['mapObjectId'] else None
    if building['object_type'] not in ('building', 'building_partial') and not override:
        raise ValueError(f"Not a building: {building['id']}")
    coordinates = building['lnglat']
    if len(coordinates) != 2 or not all(math.isfinite(v) for v in coordinates) or not (-90 < coordinates[0] < -88 and 42 < coordinates[1] < 44):
        raise ValueError(f"Invalid campus coordinates: {building['id']}")
    dining_id = DINING_BUILDING_IDS.get(building['id'])
    geometry = building['geojson']
    if geometry['type'] != 'Polygon' and not override:
        raise ValueError(f"Unreviewed footprint geometry: {building['id']}")
    # A hall's vending does not establish machines across an entire dining complex.
    use_dining_rings = dining_id and not dining[dining_id].get('components')
    rings = override['rings'] if override else dining[dining_id]['rings'] if use_dining_rings else geometry['coordinates']
    if not rings or any(len(ring) < 4 or ring[0] != ring[-1] or any(len(point) != 2 or not all(math.isfinite(v) for v in point) or not (-90 < point[0] < -88 and 42 < point[1] < 44) for point in ring) for ring in rings):
        raise ValueError(f"Invalid footprint rings: {building['id']}")
    if override or building.get('sourceUrl'):
        x, y = coordinates
        inside = False
        for a, b in zip(rings[0], rings[0][1:]):
            if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
                inside = not inside
        if not inside:
            raise ValueError(f"Reference point lies outside reviewed footprint: {building['id']}")
    return {
        'id': f"vending-{building['id']}-{provider}", 'name': building['name'],
        'provider': provider, 'address': building.get('street_address') or '',
        'coordinates': coordinates, 'mapObjectId': building['id'],
        'coordinateSource': building.get('sourceUrl', SOURCE),
        'buildingNumber': building.get('building_number'), 'areas': [],
        'machineCount': 0, 'locationCount': 0, 'rings': rings,
        'diningBuildingId': dining_id,
        'footprintSource': override['sourceUrl'] if override else 'Reviewed dining footprint (OpenStreetMap)' if use_dining_rings else building.get('sourceUrl', SOURCE),
        'buildingConfirmation': FACILITY_REVIEW.get(str(building['id']), WORKDAY_EVIDENCE.get(str(building['id']), {})).get('confirmation'),
        'supplementalOnly': False, 'managementLabel': None,
        'supplementalAreas': [], 'supplementalEvidence': [], 'supplementalReferences': [],
    }


def read_locations(path):
    groups = collections.defaultdict(lambda: {"names": set(), "machines": set()})
    with zipfile.ZipFile(path) as archive:
        strings = ["".join(e.itertext()) for e in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("m:si", NS)]
        relationships = {e.attrib["Id"]: e.attrib["Target"] for e in ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))}
        sheets = ET.fromstring(archive.read("xl/workbook.xml")).findall("m:sheets/m:sheet", NS)
        for index in (6, 7, 8):
            sheet = sheets[index]
            target = relationships[sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]]
            member = target.lstrip("/") if target.startswith("/") else "xl/" + target
            for row in ET.fromstring(archive.read(member)).findall("m:sheetData/m:row", NS):
                if row.attrib["r"] == "1":
                    continue
                values = {}
                for cell in row.findall("m:c", NS):
                    value = cell.find("m:v", NS)
                    text = value.text if value is not None else "".join(cell.itertext()) if cell.attrib.get("t") == "inlineStr" else ""
                    if cell.attrib.get("t") == "s":
                        text = strings[int(text)]
                    values[re.sub(r"\d", "", cell.attrib["r"])] = text
                if not values.get("E") or not values.get("C"):
                    continue
                group = groups[(values["B"], values["C"])]
                group["machines"].add(values["E"])
                if values.get("G") and not values["G"].startswith("#"):
                    group["names"].add(values["G"].strip())
    return groups


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workbook')
    parser.add_argument('campus_source')
    parser.add_argument('--period', default='September 2026')
    parser.add_argument('--checked', default=datetime.date.today().isoformat(), type=lambda s: datetime.date.fromisoformat(s).isoformat())
    args = parser.parse_args()
    groups = read_locations(args.workbook)
    commission_manifest = json.loads((ROOT / 'scripts/commission-vending-evidence.json').read_text(encoding='utf-8'))
    statements = validated_statements(commission_manifest, groups, args.period)
    campus = {b["id"]: b for b in json.loads(pathlib.Path(args.campus_source).read_text(encoding="utf-8-sig"))}
    for external in json.loads((ROOT / 'src/examples/campus-map/commission-external-buildings.json').read_text(encoding='utf-8')):
        if external['id'] in campus:
            raise ValueError(f"Duplicate external building ID: {external['id']}")
        campus[external['id']] = external
    matches = json.loads((ROOT / "scripts/vending-building-matches.json").read_text())
    reviewed = {(m["account"], m["location"]): m for m in matches}
    dining = {b['id']: b for b in json.loads((ROOT / 'src/examples/campus-map/campus-dining.json').read_text(encoding='utf-8'))['buildings']}
    buildings = {}
    unresolved = []
    for key, group in groups.items():
        statement = statements[key]
        match = reviewed.get(key)
        # Changed names require another review; never silently reuse old mappings.
        if not match or not match["mapObjectId"] or set(match["expectedSourceNames"]) != group["names"]:
            unresolved.append({"account": key[0], "location": key[1], "name": statement['statementName'], "machineCount": len(group['machines']), "reason": match["reason"] if match and not match["mapObjectId"] else "New or changed source names require review."})
            continue
        building = campus[match["mapObjectId"]]
        provider = {"1025": "union", "1026": "housing", "1028": "other"}[key[0]]
        building_key = (building["id"], provider)
        if building_key not in buildings:
            buildings[building_key] = make_building(building, provider, dining)
        record = buildings[building_key]
        record["areas"] = sorted(set(record["areas"]) | ({statement['reviewedAreaName']} if statement['reviewedAreaName'] else group["names"]))
        if match.get('areaLabel') and not statement['reviewedAreaName']:
            record['areas'] = sorted(set(record['areas']) | {match['areaLabel']})
        if match.get('buildingAssignmentNote'):
            record['buildingConfirmation'] = match['buildingAssignmentNote']
        if match.get('managementLabel'):
            record['managementLabel'] = match['managementLabel']
        record["machineCount"] += len(group["machines"])
        record["locationCount"] += 1
    data = {"period": args.period, "checked": args.checked, "commissionChecked": commission_manifest['checked'], "coordinateSource": SOURCE, "coordinateMeaning": "Host-building reference point, not an exact machine position.", "totalLocations": len(groups), "unresolved": unresolved, "buildings": sorted(buildings.values(), key=lambda b: b["name"])}
    append_supplemental(data, args.workbook, campus, lambda building, provider: make_building(building, provider, dining))
    (ROOT / "src/examples/campus-map/vending-locations.json").write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(data['buildings'])} building markers; {sum(b['locationCount'] for b in buildings.values())} matched sales locations; {len(unresolved)} sales locations unresolved; {data['supplementalMappedLocations']} supplemental references mapped; {len(data['supplementalPending'])} supplemental references pending.")


if __name__ == "__main__":
    main()
