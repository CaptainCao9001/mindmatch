#!/usr/bin/env python3
"""Convert agent-v2 ESM .js files to .mjs, update all imports."""
import os, re, glob

root = os.path.dirname(os.path.abspath(__file__))

# Step 1: Find all .js files (excluding .cjs)
js_files = []
for pattern in ['*.js', '*/**/*.js']:
    for f in glob.glob(os.path.join(root, pattern)):
        if not f.endswith('.cjs') and not f.endswith('.py'):
            js_files.append(f)

print(f"Found {len(js_files)} .js files to convert")

# Step 2: Build a mapping of old name → new name
rename_map = {}
for f in js_files:
    dirname = os.path.dirname(f)
    basename = os.path.basename(f)
    new_name = basename.replace('.js', '.mjs')
    rename_map[basename] = new_name

import_pattern = re.compile(r"""(from\s+['"])((?:\.{1,2}/)?[^'"]+?)(\.js)(['"])|(import\s*\()((?:\.{1,2}/)?[^'"]+?)(\.js)(['"])""")

# Step 3: Update imports in ALL files (both .js and .cjs)
all_files = []
for pattern in ['*', '*/**/*']:
    for ext in ['.js', '.cjs', '.mjs', '.md']:
        all_files.extend(glob.glob(os.path.join(root, pattern + ext)))

for f in all_files:
    content = open(f, 'r', encoding='utf-8').read()
    updated = content
    
    # Replace: from './xxx.js' → from './xxx.mjs'
    def replace_import(m):
        if m.group(1):  # from 'xxx.js'
            prefix = m.group(1)
            path = m.group(2)
            suffix = m.group(4)
            base = os.path.basename(path) if '/' in path else path
            if base in rename_map:
                new_path = re.sub(r'(\.\.?/[^/]*)$', rename_map[base], path)
                return prefix + new_path + suffix
        return m.group(0)
    
    updated = import_pattern.sub(replace_import, updated)
    
    if updated != content:
        with open(f, 'w', encoding='utf-8') as fh:
            fh.write(updated)
        print(f"Updated imports in: {os.path.basename(f)}")

# Step 4: Rename .js → .mjs
for f in js_files:
    new_f = f.replace('.js', '.mjs')
    os.rename(f, new_f)
    print(f"Renamed: {os.path.basename(f)} → {os.path.basename(new_f)}")

print("\nDone! All .js converted to .mjs with updated imports.")
