"""
从所有相关 session JSONL 中恢复 agent-v2/ 全部源码
策略：
1. 收集 Write function_call (file_path → content) - 完整文件
2. 收集 Read function_call_result (callId → content) - 已被读取的
3. 优先用 Write（完整），Read 结果作为补充
"""
import json, os, re

sessions = [
    'C:/Users/27653/.workbuddy/projects/h-program/3fd5c9cf-18d9-4178-92d6-32ca3ebe6e74.jsonl',
    'C:/Users/27653/.workbuddy/projects/h-program/a27fc85d-d287-4c14-a4fc-5d81ed15e5e6.jsonl',
]

base = 'H:/program/mindmatch-demo/agent-v2'
os.makedirs(base, exist_ok=True)
os.makedirs(os.path.join(base, 'prompt'), exist_ok=True)

# 存储文件内容 {rel_path: content}
file_contents = {}

all_lines = []
for sf in sessions:
    with open(sf, 'r', encoding='utf-8') as f:
        all_lines.extend(f.readlines())

# ===== 第1遍: 收集 Write 调用 =====
for line in all_lines:
    try:
        data = json.loads(line)
    except:
        continue
    if data.get('type') != 'function_call' or data.get('name') != 'Write':
        continue
    try:
        args = json.loads(data.get('arguments', '{}'))
        fp = args.get('file_path', '')
        content = args.get('content', '')
    except:
        continue
    if 'agent-v2' not in fp:
        continue
    rel = fp.replace('H:\\program\\mindmatch-demo\\', '').replace('\\', '/')
    # 取最新的（后出现的覆盖先出现的）
    file_contents[rel] = content
    print(f'[Write] {rel}')

# ===== 第2遍: 收集 Read 结果（补充缺失的）=====
call_map = {}  # callId → file_path
for line in all_lines:
    try:
        data = json.loads(line)
    except:
        continue
    if data.get('type') != 'function_call' or data.get('name') != 'Read':
        continue
    try:
        args = json.loads(data.get('arguments', '{}'))
        fp = args.get('file_path', '')
    except:
        continue
    if 'agent-v2' not in fp:
        continue
    call_id = data.get('callId', '')
    if call_id:
        call_map[call_id] = fp

# 匹配 Read 结果
for line in all_lines:
    try:
        data = json.loads(line)
    except:
        continue
    if data.get('type') != 'function_call_result':
        continue
    call_id = data.get('callId', '')
    if call_id not in call_map:
        continue
    fp = call_map[call_id]
    rel = fp.replace('H:\\program\\mindmatch-demo\\', '').replace('\\', '/')
    if rel in file_contents:
        continue  # 已经有 Write 内容了
    
    output = data.get('output', {})
    text = output.get('text', '')
    if not text:
        continue
    
    # 去掉行号前缀 "   N→" 
    lines_out = []
    for raw_line in text.split('\n'):
        cleaned = re.sub(r'^\s+\d+\x86\s?', '', raw_line)
        lines_out.append(cleaned)
    code = '\n'.join(lines_out)
    
    file_contents[rel] = code
    print(f'[Read]  {rel}')

# ===== 写入磁盘 =====
restored = 0
for rel, content in file_contents.items():
    # 去掉 agent-v2/ 前缀
    parts = rel.split('/')
    if parts[0] == 'agent-v2':
        subpath = '/'.join(parts[1:])
    else:
        subpath = rel

    fullpath = os.path.join(base, subpath)
    os.makedirs(os.path.dirname(fullpath), exist_ok=True)

    with open(fullpath, 'w', encoding='utf-8') as out:
        out.write(content)
    print(f'SAVED: agent-v2/{subpath}  ({len(content)} chars)')
    restored += 1

print(f'\nTotal: {restored} files restored to {base}')
