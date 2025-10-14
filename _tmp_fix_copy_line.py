from pathlib import Path
path = Path('src/main.js')
text = path.read_text(encoding='utf-8')
text = text.replace("    copyButton.innerHTML =  Copiar;\n", "    copyButton.innerHTML = ${createIcon('copy')} Copiar;\n")
path.write_text(text, encoding='utf-8')
