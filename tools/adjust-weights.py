import json, math, copy

with open(r'H:\program\mindmatch-demo\mock\ideal-profiles.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# === Weakening plan ===
# 6 weak dimensions: ideal spread widening + weight reduction
# Weight multipliers: CH×0.5, LS×0.5, nAch×0.7, SE×0.6, AU×0.8, search×0.7

# Ideal value adjustments (psychologically guided, widen spread)
ideal_adjust = {
    # system-builder: keep high, deep-reader: keep high, creative: keep high,
    # people-connector: lower, value-driver: high, empowerment: lowest
    'CH': {
        'system-builder': 0.75,  # was 0.70
        'deep-reader': 0.80,     # was 0.75
        'creative-molder': 0.75, # was 0.75 (unchanged)
        'people-connector': 0.50, # was 0.55
        'value-driver': 0.75,    # was 0.70
        'empowerment-companion': 0.40, # was 0.50
    },
    # LS: value-driver lifestyle-oriented, system-builder least
    'LS': {
        'system-builder': 0.40,  # was 0.50
        'deep-reader': 0.35,     # was 0.45
        'creative-molder': 0.55, # was 0.60
        'people-connector': 0.50, # was 0.55
        'value-driver': 0.80,    # was 0.70
        'empowerment-companion': 0.60, # was 0.65
    },
    # nAch: slight push at both ends
    'nAch': {
        'system-builder': 0.80,  # was 0.75
        'deep-reader': 0.85,     # was 0.80
        'creative-molder': 0.70, # was 0.70 (unchanged)
        'people-connector': 0.60, # was 0.65
        'value-driver': 0.85,    # was 0.80
        'empowerment-companion': 0.50, # was 0.55
    },
    # SE: security-seeking vs risk-tolerant
    'SE': {
        'system-builder': 0.50,  # was 0.55
        'deep-reader': 0.45,     # was 0.50
        'creative-molder': 0.25, # was 0.30
        'people-connector': 0.55, # was 0.60
        'value-driver': 0.70,    # was 0.65
        'empowerment-companion': 0.75, # was 0.70
    },
    # AU: widen autonomy extremes
    'AU': {
        'system-builder': 0.65,  # was 0.65 (unchanged)
        'deep-reader': 0.55,     # was 0.60
        'creative-molder': 0.90, # was 0.85
        'people-connector': 0.45, # was 0.50
        'value-driver': 0.35,    # was 0.40
        'empowerment-companion': 0.65, # was 0.65 (unchanged)
    },
    # search: widen exploration spread
    'search': {
        'system-builder': 0.75,  # was 0.70
        'deep-reader': 0.85,     # was 0.80
        'creative-molder': 0.90, # was 0.85
        'people-connector': 0.55, # was 0.60
        'value-driver': 0.50,    # was 0.55
        'empowerment-companion': 0.70, # was 0.75
    },
}

weight_multipliers = {
    'CH': 0.5,
    'LS': 0.5,
    'nAch': 0.7,
    'SE': 0.6,
    'AU': 0.8,
    'search': 0.7,
}

changes = []

# Apply to directions
for dir_id, dir_data in data['directions'].items():
    for pf in dir_data['profiles']:
        field = pf['field']
        if field in ideal_adjust and dir_id in ideal_adjust[field]:
            old_ideal = pf['ideal']
            new_ideal = ideal_adjust[field][dir_id]
            if old_ideal != new_ideal:
                changes.append(f"  {dir_id}.{field} ideal: {old_ideal}→{new_ideal}")
                pf['ideal'] = new_ideal

        if field in weight_multipliers:
            old_w = pf['weight']
            new_w = round(old_w * weight_multipliers[field], 2)
            if old_w != new_w:
                changes.append(f"  {dir_id}.{field} weight: {old_w}→{new_w}")
                pf['weight'] = new_w

# Also adjust direction column for CH/LS/SE – keep consistent
for dir_id, dir_data in data['directions'].items():
    for pf in dir_data['profiles']:
        field = pf['field']
        if field in ideal_adjust and dir_id in ideal_adjust[field]:
            new_ideal = ideal_adjust[field][dir_id]
            if new_ideal >= 0.70:
                dir = 'high'
            elif new_ideal <= 0.35:
                dir = 'low'
            else:
                dir = 'mid'
            old_dir = pf.get('direction', '')
            if old_dir != dir:
                pf['direction'] = dir
                changes.append(f"  {dir_id}.{field} direction: {old_dir}→{dir}")

print(f"Applied {len(changes)} changes:")
for c in changes:
    print(c)

# Write output
out_path = r'H:\program\mindmatch-demo\mock\ideal-profiles.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\nWritten to {out_path}")
print("Done.")

# Also compute new spreads for verification
print("\n=== New spread verification ===")
weak_fields = ['CH', 'LS', 'nAch', 'SE', 'AU', 'search']
for field in weak_fields:
    vals = []
    for dir_id, dir_data in data['directions'].items():
        for pf in dir_data['profiles']:
            if pf['field'] == field:
                vals.append((dir_id, pf['ideal'], pf['weight']))
    ideals = [v[1] for v in vals]
    spread = round(max(ideals) - min(ideals), 2)
    avg_weight = round(sum(v[2] for v in vals) / len(vals), 2)
    print(f"  {field}: spread {round(min(ideals),2)}-{round(max(ideals),2)} = {spread}, avg_weight={avg_weight}")
