from pathlib import Path
text = Path('src/main.js').read_text(encoding='utf-8')
old = "  if (name === 'copy') {\n    return \n      <svg xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\" stroke-width=\"1.5\" stroke=\"currentColor\">\n        <path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M8.25 7.5v12a.75.75 0 00.75.75h9.75a.75.75 0 00.75-.75V9.75L16.5 6.75h-7.5a.75.75 0 00-.75.75z\" />\n        <path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M15 6.75V4.5a.75.75 0 00-.75-.75h-9a.75.75 0 00-.75.75V16.5a.75.75 0 00.75.75H6\" />\n      </svg>\n    ;\n  }\n\n"
new = "  if (name === 'copy') {\n    return \n      <svg xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\" stroke-width=\"1.5\" stroke=\"currentColor\">\n        <path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M8.25 7.5v12a.75.75 0 00.75.75h9.75a.75.75 0 00.75-.75V9.75L16.5 6.75h-7.5a.75.75 0 00-.75.75z\" />\n        <path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M15 6.75V4.5a.75.75 0 00-.75-.75h-9a.75.75 0 00-.75.75V16.5a.75.75 0 00.75.75H6\" />\n      </svg>\n    ;\n  }\n\n"
if old not in text:
    raise SystemExit('copy icon block in unexpected format')
Path('src/main.js').write_text(text.replace(old, new, 1), encoding='utf-8')
