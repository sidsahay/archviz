export function initEditor(containerId, initialCode) {
  return new Promise((resolve) => {
    // Wait for require to be available (loaded via CDN in index.html)
    const checkRequire = setInterval(() => {
      if (window.require) {
        clearInterval(checkRequire);
        window.require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});
        window.require(['vs/editor/editor.main'], function() {
          const editor = window.monaco.editor.create(document.getElementById(containerId), {
            value: initialCode,
            language: 'verilog',
            theme: 'vs-dark',
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            padding: { top: 16 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: "smooth",
            formatOnPaste: true,
            automaticLayout: true
          });
          resolve(editor);
        });
      }
    }, 50);
  });
}
