#!/usr/bin/env python3
"""Fix imports in .mjs files and convert prompt/ .js files too."""
import os, re, glob

root = os.path.dirname(os.path.abspath(__file__))

# Build rename map
rename_map = {}
for f in glob.glob(os.path.join(root, '*.mjs')):
    basename = os.path.basename(f)
    old_name = basename.replace('.mjs', '.js')
    rename_map[old_name] = basename

# Convert prompt/*.js -> prompt/*.mjs
prompt_files = glob.glob(os.path.join(root, 'prompt', '*.js'))
for f in prompt_files:
    content = open(f, 'r', encoding='utf-8').read()
    basename = os.path.basename(f)
    rename_map[basename] = basename.replace('.js', '.mjs')
    os.rename(f, f.replace('.js', '.mjs'))
    print(f"Renamed: prompt/{basename} -> prompt/{basename.replace('.js', '.mjs')}")

# Fix imports in all .mjs, .cjs files
all_files = glob.glob(os.path.join(root, '*.mjs')) + \
            glob.glob(os.path.join(root, '*.cjs')) + \
            glob.glob(os.path.join(root, 'prompt', '*.mjs'))

for f in all_files:
    content = open(f, 'r', encoding='utf-8').read()
    
    lines = content.split('\n')
    updated_lines = []
    changed = False
    for line in lines:
        if ('from ' in line and "'" in line) or ('import(' in line and "'" in line):
            orig = line
            # Replace from './xxx.js' -> from './xxx.mjs'
            line = re.sub(r"from\s+('(?:\.[^']+)\.js')", lambda m: m.group(0).replace('.js', '.mjs'), line)
            line = re.sub(r'from\s+("(?:\.[^"]+)\.js")', lambda m: m.group(0).replace('.js', '.mjs'), line)
            line = re.sub(r"import\('(?:\.[^']+)\.js'\)", lambda m: m.group(0).replace('.js', '.mjs'), line)
            if line != orig:
                changed = True
        updated_lines.append(line)
    
    if changed:
        with open(f, 'w', encoding='utf-8') as fh:
            fh.write('\n'.join(updated_lines))
        print(f"Fixed: {os.path.basename(f)}")

# Update scf-bridge.cjs import path
bridge = os.path.join(root, 'scf-bridge.cjs')
content = open(bridge, 'r', encoding='utf-8').read()
content = content.replace("import('./scf-handler.js')", "import('./scf-handler.mjs')")
with open(bridge, 'w', encoding='utf-8') as fh:
    fh.write(content)
print("Fixed: scf-bridge.cjs")

print("\nDone!")
