"""Measure photo-to-photo transforms; never retouch or generate image pixels.

Requires OpenCV and numpy. Original JPEGs remain untouched. Browser composition
uses the resulting projective transforms; this is an experimental planar alignment,
not a surveyed orthophoto. Usage: python scripts/align-terrace-photos.py <photo-folder>
"""
import argparse
import json
import pathlib
import cv2
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder', type=pathlib.Path)
    args = parser.parse_args()
    cv2.setNumThreads(2)
    features, sizes = [], []
    sift = cv2.SIFT_create(nfeatures=14000)
    for number in range(3316, 3324):
        original = cv2.imread(str(args.folder / f'IMG_{number}.jpeg'))
        if original is None:
            raise ValueError(f'Missing image {number}')
        image = cv2.rotate(original, cv2.ROTATE_180)
        h, w = image.shape[:2]
        image = cv2.resize(image, (1400, round(h * 1400 / w)))
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        mask = np.full_like(gray, 255)
        mask[round(gray.shape[0] * .84):, round(gray.shape[1] * .35):round(gray.shape[1] * .65)] = 0
        points, descriptors = sift.detectAndCompute(gray, mask)
        features.append((points, descriptors))
        sizes.append([gray.shape[1], gray.shape[0]])
        print(f'IMG_{number}: {len(points)} features; source {w} x {h}', flush=True)
    matcher = cv2.BFMatcher()
    edges = []
    for i in range(len(features)):
        for j in range(i + 1, len(features)):
            a, da = features[i]
            b, db = features[j]
            good = [m for m, n in matcher.knnMatch(da, db, k=2) if m.distance < .72 * n.distance]
            if len(good) < 25:
                continue
            src = np.float32([a[m.queryIdx].pt for m in good])
            dst = np.float32([b[m.trainIdx].pt for m in good])
            matrix, inliers = cv2.findHomography(src, dst, cv2.USAC_MAGSAC, 3.5)
            count = int(inliers.sum()) if inliers is not None else 0
            print(f'{3316+i} -> {3316+j}: {len(good)} matches, {count} inliers', flush=True)
            if count < 20 or count / len(good) < .18:
                continue
            errors = np.linalg.norm(cv2.perspectiveTransform(src[:, None, :], matrix)[:, 0] - dst, axis=1)
            error = float(np.median(errors[inliers[:, 0].astype(bool)]))
            edges.append({'i': i, 'j': j, 'matrix': matrix, 'inliers': count, 'error': error})
    # Grow a maximum-confidence tree from the middle photo.
    # Four visible grout corners of one apparently square paver in IMG_3319.
    # This removes the anchor photo's perspective; square proportions are an
    # approximation, not a surveyed dimension. Points refer to the 1824px preview.
    reference_corners = np.float32([[748, 698], [350, 689], [304, 215], [726, 221]])
    reference_corners[:, 0] = (1 - reference_corners[:, 0] / 1824) * 1400
    reference_corners[:, 1] = (1 - reference_corners[:, 1] / 1368) * sizes[3][1]
    anchor = cv2.getPerspectiveTransform(reference_corners, np.float32([[0, 0], [350, 0], [350, 350], [0, 350]]))
    transforms = {3: anchor}
    tree = []
    while len(transforms) < len(features):
        choices = [e for e in edges if (e['i'] in transforms) != (e['j'] in transforms)]
        if not choices:
            raise ValueError('Some photos lack a reliable overlap; do not fabricate missing coverage.')
        edge = max(choices, key=lambda e: e['inliers'])
        i, j, h = edge['i'], edge['j'], edge['matrix']
        if i in transforms:
            transforms[j] = transforms[i] @ np.linalg.inv(h)
        else:
            transforms[i] = transforms[j] @ h
        tree.append({'from': 3316 + i, 'to': 3316 + j, 'inliers': edge['inliers'], 'medianError': round(edge['error'], 3)})
    corners = []
    for i, (w, h) in enumerate(sizes):
        points = np.float32([[[0, 0], [w, 0], [w, h], [0, h]]])
        corners.extend(cv2.perspectiveTransform(points, transforms[i])[0])
    minimum = np.min(corners, axis=0)
    maximum = np.max(corners, axis=0)
    shift = np.array([[1, 0, -minimum[0] + 40], [0, 1, -minimum[1] + 40], [0, 0, 1]])
    images = []
    for i, (w, h) in enumerate(sizes):
        matrix = shift @ transforms[i]
        matrix /= matrix[2, 2]
        images.append({'id': f'IMG_{3316 + i}', 'file': f'IMG_{3316 + i}.jpeg', 'width': w, 'height': h,
                       'rotate': 180, 'visibleHeight': 1, 'matrix': matrix.tolist()})
    data = {'width': float(maximum[0] - minimum[0] + 80), 'height': float(maximum[1] - minimum[1] + 80),
            'orientation': 'South at bottom, based on photographer guidance; approximate, not surveyed.',
            'images': images, 'alignmentChecks': tree, 'contextImage': 'IMG_3324.jpeg',
            'rectification': 'Anchor grout corners manually identified; approximately square paver used to reduce perspective. No surveyed dimensions.'}
    path = ROOT / 'src/examples/terrace-pavers/photo-layout.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'size': [data['width'], data['height']], 'connections': tree}, indent=2))


if __name__ == '__main__':
    main()
