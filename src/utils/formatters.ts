export function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffSec = Math.floor((now - timestamp) / 1000);

  if (diffSec < 10) return 'agora mesmo';
  if (diffSec < 60) return `há ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'ontem';
  return `há ${diffDays} dias`;
}

export function detectContentType(text: string): 'code' | 'url' | 'text' {
  if (!text) return 'text';
  const trimmed = text.trim();

  // Check URL
  try {
    if (/^https?:\/\/[^\s]+$/i.test(trimmed)) {
      new URL(trimmed);
      return 'url';
    }
  } catch {
    // Not a valid URL
  }

  // Check common code patterns
  const codeKeywords = [
    'import ', 'export ', 'const ', 'let ', 'var ', 'function', 'class ',
    'def ', 'return ', 'SELECT ', 'INSERT ', 'FROM ', 'WHERE ', '{', '}', '=>',
    'docker', 'version:', 'services:', 'git clone', 'npm install', 'curl ', 'ssh '
  ];
  
  const hasCodeMarkers = codeKeywords.some(kw => trimmed.includes(kw));
  const hasIndentOrLinebreaks = (trimmed.includes('\n') && (trimmed.includes('  ') || trimmed.includes('\t')));

  if (hasCodeMarkers && (hasIndentOrLinebreaks || trimmed.length > 30)) {
    return 'code';
  }

  return 'text';
}

export async function copyToClipboard(text: string): Promise<boolean> {
  // Method 1: Modern Clipboard API
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to fallback
    }
  }

  // Method 2: Document execCommand fallback (works in iframes & older browser contexts)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export function downloadItemContent(content: string, fileName: string, mimeType: string = 'text/plain') {
  try {
    const link = document.createElement('a');
    if (content.startsWith('data:')) {
      link.href = content;
    } else {
      const blob = new Blob([content], { type: mimeType });
      link.href = URL.createObjectURL(blob);
    }
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Falha ao descarregar item:', err);
  }
}
