from pathlib import Path
lines = Path('src/main.js').read_text(encoding='utf-8').splitlines()
for idx, line in enumerate(lines, 1):
    if 'copyButton.innerHTML' in line:
        print(idx, repr(line))
