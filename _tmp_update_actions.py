from pathlib import Path

path = Path('src/main.js')
text = path.read_text(encoding='utf-8')

old_segment = "    const actions = document.createElement('div');\n    actions.className = 'message__actions';\n\n    const deleteButton = document.createElement('button');\n    deleteButton.type = 'button';\n    deleteButton.innerHTML = ${createIcon('trash')} Eliminar;\n    deleteButton.addEventListener('click', () => {\n      group.messages = group.messages.filter((item) => item.id !== message.id);\n      markGroupAsUpdated(group);\n      renderMessages(group);\n      updateMessageMeta(group);\n      scheduleSave();\n    });\n    actions.appendChild(deleteButton);\n\n    header.appendChild(actions);\n    messageWrapper.appendChild(header);\n\n    const textarea = document.createElement('textarea');\n"

if old_segment not in text:
    raise SystemExit('actions segment not found')

new_segment = "    const actions = document.createElement('div');\n    actions.className = 'message__actions';\n    let textareaRef = null;\n\n    const copyButton = document.createElement('button');\n    copyButton.type = 'button';\n    copyButton.innerHTML = ${createIcon('copy')} Copiar;\n    copyButton.addEventListener('click', () => {\n      const value = textareaRef?.value ?? message.content ?? '';\n      if (!value) return;\n      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {\n        navigator.clipboard.writeText(value).catch((error) => {\n          console.warn('No se pudo copiar el mensaje al portapapeles', error);\n        });\n      } else {\n        try {\n          const temp = document.createElement('textarea');\n          temp.value = value;\n          temp.setAttribute('readonly', '');\n          temp.style.position = 'absolute';\n          temp.style.left = '-9999px';\n          document.body.appendChild(temp);\n          temp.select();\n          document.execCommand('copy');\n          document.body.removeChild(temp);\n        } catch (error) {\n          console.warn('No se pudo copiar el mensaje al portapapeles', error);\n        }\n      }\n    });\n    actions.appendChild(copyButton);\n\n    const deleteButton = document.createElement('button');\n    deleteButton.type = 'button';\n    deleteButton.innerHTML = ${createIcon('trash')} Eliminar;\n    deleteButton.addEventListener('click', () => {\n      group.messages = group.messages.filter((item) => item.id !== message.id);\n      markGroupAsUpdated(group);\n      renderMessages(group);\n      updateMessageMeta(group);\n      scheduleSave();\n    });\n    actions.appendChild(deleteButton);\n\n    header.appendChild(actions);\n    messageWrapper.appendChild(header);\n\n    const textarea = document.createElement('textarea');\n    textareaRef = textarea;\n"

text = text.replace(old_segment, new_segment, 1)

if "createIcon('copy')" not in text:
    insert_before = "  if (name === 'trash') {\n"
    if insert_before not in text:
        raise SystemExit('trash icon block not found')
    copy_block = "  if (name === 'copy') {\n    return \n      <svg xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\" stroke-width=\"1.5\" stroke=\"currentColor\">\n        <path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M8.25 7.5v12a.75.75 0 00.75.75h9.75a.75.75 0 00.75-.75V9.75L16.5 6.75h-7.5a.75.75 0 00-.75.75z\" />\n        <path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M15 6.75V4.5a.75.75 0 00-.75-.75h-9a.75.75 0 00-.75.75V16.5a.75.75 0 00.75.75H6\" />\n      </svg>\n    ;\n  }\n\n"
    text = text.replace(insert_before, copy_block + insert_before, 1)

path.write_text(text, encoding='utf-8')
