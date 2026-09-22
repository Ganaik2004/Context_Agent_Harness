import React, { useState, useRef, useCallback, useEffect } from 'react';

// Types
interface TextBlock {
  id: string;
  type: 'text';
  content: string;
}

interface ImageBlock {
  id: string;
  type: 'image';
  src: string;
  natW: number;
  natH: number;
  width: number;
  left: number;
}

type Block = TextBlock | ImageBlock;

// Helper to generate unique IDs
let idCounter = 0;
const genId = () => `block-${++idCounter}`;

// SVG generator for sample images
const makeSvg = (w: number, h: number, label: string, c1: string, c2: string) => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='${w}' height='${h}' fill='#232a36'/><rect x='24' y='24' width='${w - 48}' height='${h - 48}' rx='16' fill='#2d3547'/><circle cx='${w * 0.28}' cy='${h * 0.42}' r='${h * 0.14}' fill='${c1}' opacity='.85'/><path d='M40 ${h - 60} L${w * 0.35} ${h * 0.45} L${w * 0.55} ${h * 0.68} L${w * 0.75} ${h * 0.38} L${w - 40} ${h - 60} Z' fill='${c2}'/><text x='${w / 2}' y='52' fill='#8b93a7' font-family='sans-serif' font-size='22' text-anchor='middle'>${label}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
};

// Text Block Component
const TextBlockComponent = React.memo(function TextBlockComponent({
  block,
  onUpdate,
  onEnter,
  onBackspace,
  onFocus,
}: {
  block: TextBlock;
  onUpdate: (id: string, content: string) => void;
  onEnter: (id: string) => void;
  onBackspace: (id: string) => void;
  onFocus: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // Set initial content only once on mount
  useEffect(() => {
    if (ref.current && !initialized.current) {
      ref.current.textContent = block.content;
      initialized.current = true;
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onEnter(block.id);
    }
    if (e.key === 'Backspace' && ref.current && ref.current.textContent === '') {
      e.preventDefault();
      onBackspace(block.id);
    }
  };

  const handleInput = () => {
    if (ref.current) {
      onUpdate(block.id, ref.current.textContent || '');
    }
  };

  return (
    <div
      className="editable"
      ref={ref}
      contentEditable
      data-ph="Type here…  (Enter = new block)"
      onKeyDown={handleKeyDown}
      onInput={handleInput}
      onFocus={() => onFocus(block.id)}
      suppressContentEditableWarning
    />
  );
});

// Image Block Component
function ImageBlockComponent({
  block,
  onWidthChange,
  onPositionChange,
  onClick,
}: {
  block: ImageBlock;
  onWidthChange: (id: string, width: number) => void;
  onPositionChange: (id: string, left: number) => void;
  onClick?: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);
  const [resizeSide, setResizeSide] = useState<'left' | 'right' | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const startLeft = useRef(0);
  const aspect = block.natW / block.natH;

  const handleRightPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    startWidth.current = block.width;
    startLeft.current = block.left || 0;
    setResizing(true);
    setResizeSide('right');
  };

  const handleLeftPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    startWidth.current = block.width;
    startLeft.current = block.left || 0;
    setResizing(true);
    setResizeSide('left');
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!resizing || !stageRef.current) return;
    const maxW = stageRef.current.clientWidth;
    const delta = e.clientX - startX.current;

    if (resizeSide === 'right') {
      // Right handle: width changes, left stays fixed
      const newW = Math.max(140, Math.min(startWidth.current + delta, maxW - startLeft.current));
      onWidthChange(block.id, newW);
    } else if (resizeSide === 'left') {
      // Left handle: width changes AND left position changes (right edge stays fixed)
      const newLeft = Math.max(0, startLeft.current + delta);
      const newW = Math.max(140, startWidth.current - delta);
      const maxLeft = maxW - 140;
      if (newLeft <= maxLeft && newW >= 140) {
        onPositionChange(block.id, newLeft);
        onWidthChange(block.id, newW);
      }
    }
  };

  const handlePointerUp = () => {
    setResizing(false);
    setResizeSide(null);
  };

  const h = Math.round(block.width / aspect);
  const currentLeft = block.left || 0;

  return (
    <div
      className={`img-stage ${resizing ? 'resizing' : ''}`}
      ref={stageRef}
      style={{ height: h + 'px' }}
      onClick={onClick}
    >
      <img
        className="img-abs"
        src={block.src}
        alt=""
        style={{
          left: currentLeft + 'px',
          top: '0px',
          width: block.width + 'px',
          height: h + 'px',
        }}
      />
      {/* Left resize handle */}
      <div
        className="resize-handle resize-handle-left"
        style={{ left: currentLeft + 'px', top: h / 2 + 'px' }}
        onPointerDown={handleLeftPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      {/* Right resize handle */}
      <div
        className="resize-handle resize-handle-right"
        style={{ left: currentLeft + block.width + 'px', top: h / 2 + 'px' }}
        onPointerDown={handleRightPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      <div className="size-badge" style={{ left: currentLeft + block.width - 10 + 'px' }}>
        {block.width} × {h} px
      </div>
      <div className="anchor-dot" style={{ left: currentLeft - 4 + 'px' }} />
      <div className="anchor-note">drag edges to resize</div>
    </div>
  );
}

// Gutter Component
function Gutter({
  onAdd,
  blockId,
}: {
  onAdd: (blockId: string, btnRef: HTMLButtonElement) => void;
  blockId: string;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="gutter">
      <button
        className="gbtn"
        ref={btnRef}
        title="Insert block"
        onClick={(e) => {
          e.stopPropagation();
          if (btnRef.current) onAdd(blockId, btnRef.current);
        }}
      >
        +
      </button>
      <button className="gbtn grip" title="Drag (look only)">
        ⋮⋮
      </button>
    </div>
  );
}

// Main App
export default function App() {
  const [blocks, setBlocks] = useState<Block[]>([
    { id: genId(), type: 'text', content: 'Note 1 — the block editor' },
    {
      id: genId(),
      type: 'text',
      content:
        'This is a text block. Press Enter to create a new block below; Backspace on an empty block removes it. The document is just an ordered list of blocks — order is the layout.',
    },
    {
      id: genId(),
      type: 'image',
      src: makeSvg(800, 600, 'Sample image · 4:3', '#7c6ff0', '#4c5468'),
      natW: 800,
      natH: 600,
      width: 560,
      left: 0,
    },
    {
      id: genId(),
      type: 'text',
      content:
        'Images are blocks in the flow. Hover one and drag the purple handle on its right edge: width changes, height follows the aspect ratio at the same time, and the top-left corner stays pinned — position is written once at load, resize only ever touches width and height.',
    },
    {
      id: genId(),
      type: 'image',
      src: makeSvg(960, 540, 'Sample image · 16:9', '#ec6a9f', '#3d4557'),
      natW: 960,
      natH: 540,
      width: 420,
      left: 0,
    },
    { id: genId(), type: 'text', content: '' },
  ]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(330);
  const [fontSize, setFontSize] = useState(16);
  const [saved, setSaved] = useState('Saved');
  const [savedColor, setSavedColor] = useState('var(--green)');
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ left: 0, top: 0 });
  const [pendingInsertId, setPendingInsertId] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(true);
  const [caretBlockId, setCaretBlockId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const sidebarResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Touch / save indicator
  const touch = useCallback(() => {
    setSaved('Saving…');
    setSavedColor('var(--amber)');
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaved('Saved ' + new Date().toLocaleTimeString());
      setSavedColor('var(--green)');
    }, 600);
  }, []);

  // Word/char count
  const getWordCharCount = useCallback(() => {
    const txt = blocks
      .filter((b): b is TextBlock => b.type === 'text')
      .map((b) => b.content)
      .join(' ')
      .trim();
    const words = txt ? txt.split(/\s+/).length : 0;
    return { words, chars: txt.length };
  }, [blocks]);

  // Block operations
  const updateTextBlock = useCallback(
    (id: string, content: string) => {
      setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, content } : b)));
      touch();
    },
    [touch]
  );

  const handleEnter = useCallback(
    (id: string) => {
      const newBlock: TextBlock = { id: genId(), type: 'text', content: '' };
      setBlocks((prev) => {
        const idx = prev.findIndex((b) => b.id === id);
        const next = [...prev];
        next.splice(idx + 1, 0, newBlock);
        return next;
      });
      setCaretBlockId(newBlock.id);
      touch();
      // Focus the new block after render
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-block-id="${newBlock.id}"] .editable`) as HTMLDivElement;
        if (el) {
          el.focus();
          // Place cursor at end
          const range = document.createRange();
          const sel = window.getSelection();
          if (el.childNodes.length > 0) {
            range.setStart(el.childNodes[el.childNodes.length - 1], el.textContent?.length || 0);
          } else {
            range.setStart(el, 0);
          }
          range.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      });
    },
    [touch]
  );

  const handleBackspace = useCallback(
    (id: string) => {
      setBlocks((prev) => {
        if (prev.length <= 1) return prev;
        const idx = prev.findIndex((b) => b.id === id);
        const next = prev.filter((b) => b.id !== id);
        // Focus previous block
        if (idx > 0) {
          const prevBlock = next[idx - 1];
          setCaretBlockId(prevBlock.id);
          requestAnimationFrame(() => {
            const el = document.querySelector(`[data-block-id="${prevBlock.id}"] .editable`) as HTMLDivElement;
            if (el) {
              el.focus();
              // Place cursor at end of content
              const range = document.createRange();
              const sel = window.getSelection();
              if (el.childNodes.length > 0) {
                const lastNode = el.childNodes[el.childNodes.length - 1];
                const textLen = lastNode.textContent?.length || 0;
                range.setStart(lastNode, textLen);
              } else {
                range.setStart(el, 0);
              }
              range.collapse(true);
              sel?.removeAllRanges();
              sel?.addRange(range);
            }
          });
        }
        return next;
      });
      touch();
    },
    [touch]
  );

  const handleImageWidthChange = useCallback(
    (id: string, width: number) => {
      setBlocks((prev) => prev.map((b) => (b.id === id && b.type === 'image' ? { ...b, width } : b)));
    },
    []
  );

  const handleImagePositionChange = useCallback(
    (id: string, left: number) => {
      setBlocks((prev) => prev.map((b) => (b.id === id && b.type === 'image' ? { ...b, left } : b)));
    },
    []
  );

  // Add text block
  const addTextBlock = () => {
    const newBlock: TextBlock = { id: genId(), type: 'text', content: '' };
    setBlocks((prev) => {
      if (caretBlockId) {
        const idx = prev.findIndex((b) => b.id === caretBlockId);
        const next = [...prev];
        next.splice(idx + 1, 0, newBlock);
        return next;
      }
      return [...prev, newBlock];
    });
    setCaretBlockId(newBlock.id);
    touch();
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-block-id="${newBlock.id}"] .editable`) as HTMLDivElement;
      if (el) {
        el.focus();
        // Place cursor at end
        const range = document.createRange();
        const sel = window.getSelection();
        range.setStart(el, 0);
        range.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    });
  };

  // Add image block
  const addImageBlock = (src: string, natW: number, natH: number, afterId?: string | null) => {
    const docEl = document.querySelector('.doc');
    const width = Math.min(560, (docEl?.clientWidth || 760) * 0.7);
    const newBlock: ImageBlock = { id: genId(), type: 'image', src, natW, natH, width, left: 0 };
    setBlocks((prev) => {
      if (afterId) {
        const idx = prev.findIndex((b) => b.id === afterId);
        const next = [...prev];
        next.splice(idx + 1, 0, newBlock);
        return next;
      }
      if (caretBlockId) {
        const idx = prev.findIndex((b) => b.id === caretBlockId);
        const next = [...prev];
        next.splice(idx + 1, 0, newBlock);
        return next;
      }
      return [...prev, newBlock];
    });
    touch();
  };

  // File input handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    [...files].forEach((f) => {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => addImageBlock(url, img.naturalWidth, img.naturalHeight, pendingInsertId || caretBlockId);
      img.src = url;
    });
    e.target.value = '';
    setMenuOpen(false);
  };

  // Plus menu
  const openMenu = (blockId: string, btnEl: HTMLButtonElement) => {
    const r = btnEl.getBoundingClientRect();
    setMenuPos({ left: r.left, top: r.bottom + 6 });
    setPendingInsertId(blockId);
    setMenuOpen(true);
  };

  const handleMenuClick = (kind: string) => {
    setMenuOpen(false);
    if (kind === 'text') {
      const newBlock: TextBlock = { id: genId(), type: 'text', content: '' };
      setBlocks((prev) => {
        if (pendingInsertId) {
          const idx = prev.findIndex((b) => b.id === pendingInsertId);
          const next = [...prev];
          next.splice(idx + 1, 0, newBlock);
          return next;
        }
        return [...prev, newBlock];
      });
      setCaretBlockId(newBlock.id);
      touch();
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-block-id="${newBlock.id}"] .editable`) as HTMLDivElement;
        if (el) {
          el.focus();
          const range = document.createRange();
          const sel = window.getSelection();
          range.setStart(el, 0);
          range.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      });
    } else {
      fileInputRef.current?.click();
    }
  };

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.menu') && !target.closest('.gbtn')) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Paste handler for images
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.type.startsWith('image/')) {
          e.preventDefault();
          const file = it.getAsFile();
          if (file) {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => addImageBlock(url, img.naturalWidth, img.naturalHeight);
            img.src = url;
          }
          return;
        }
      }
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, []);

  // Font size
  const changeFontSize = (delta: number) => {
    const newSize = Math.max(13, Math.min(22, fontSize + delta));
    setFontSize(newSize);
    document.documentElement.style.setProperty('--doc-fs', newSize + 'px');
  };

  // Sidebar resize
  const handleSidebarResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    sidebarResizeRef.current = { startX: e.clientX, startWidth: sidebarWidth };

    const handleMouseMove = (e: MouseEvent) => {
      if (!sidebarResizeRef.current) return;
      const delta = sidebarResizeRef.current.startX - e.clientX;
      const newWidth = Math.max(200, Math.min(600, sidebarResizeRef.current.startWidth + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      sidebarResizeRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const { words, chars } = getWordCharCount();

  return (
    <div className="app">
      {/* Title bar */}
      <div className="titlebar">
        <div className="brand">
          <div className="logo">✦</div> AI Notepad
        </div>
        <div className="crumbs">
          Home <span>›</span> <span className="dot"></span> Web Development <span>›</span> <b>Note 1</b>
        </div>
        <div className="spacer"></div>
        <div className="pill">Disconnected</div>
        <button className="iconbtn" onClick={() => setSidebarOpen(!sidebarOpen)} title="Toggle AI panel">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="15" y1="4" x2="15" y2="20" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div className="tab active">
          Note 1 <span className="x">✕</span>
        </div>
        <div className="tab">Note 2</div>
        <button className="tab add">+</button>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <button className="tbtn primary" onClick={addTextBlock}>
          <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4" fill="none">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Text
        </button>
        <button
          className="tbtn primary"
          onClick={() => {
            setPendingInsertId(null);
            fileInputRef.current?.click();
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="M4 19l6-6 4 4 3-3 3 3" />
          </svg>
          Image
        </button>
        <div className="sep"></div>
        <button className="tbtn" title="Undo">
          ↩
        </button>
        <button className="tbtn" title="Redo">
          ↪
        </button>
        <div className="sep"></div>
        <button className="tbtn">🔍 Search</button>
        <div className="sep"></div>
        <button className="tbtn" onClick={() => changeFontSize(-1)}>
          A−
        </button>
        <span className="fsread">{fontSize}px</span>
        <button className="tbtn" onClick={() => changeFontSize(1)}>
          A+
        </button>
      </div>

      <div className="main">
        {/* Document canvas */}
        <div className="canvas">
          <div className="doc">
            {blocks.map((block) => (
              <div
                key={block.id}
                className={`block ${block.type === 'image' ? 'image-block' : 'text-block'}`}
                data-block-id={block.id}
                onClick={() => setCaretBlockId(block.id)}
              >
                <Gutter blockId={block.id} onAdd={openMenu} />
                {block.type === 'text' ? (
                  <TextBlockComponent
                    block={block}
                    onUpdate={updateTextBlock}
                    onEnter={handleEnter}
                    onBackspace={handleBackspace}
                    onFocus={(id) => setCaretBlockId(id)}
                  />
                ) : (
                  <ImageBlockComponent
                    block={block}
                    onWidthChange={handleImageWidthChange}
                    onPositionChange={handleImagePositionChange}
                    onClick={() => setCaretBlockId(block.id)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* AI Sidebar */}
        <div className={`sidebar ${sidebarOpen ? '' : 'hidden'}`} style={{ width: sidebarWidth + 'px' }}>
          <div className="sidebar-resize-handle" onMouseDown={handleSidebarResizeStart}></div>
          <div className="sb-head">AI Assistant</div>
          <div className="sb-body">
            <div>
              <div className="lbl">Base URL</div>
              <input defaultValue="https://openrouter.ai/api/v1" />
            </div>
            <div>
              <div className="lbl">API key</div>
              <input placeholder="sk-..." type="password" />
            </div>
            <button className="connect">Connect</button>
            <div className="sb-empty">
              <span>
                <span className="spark">✦</span>
                Ask anything about your notes — toggle
                <br />
                "Include current file" below so the AI can
                <br />
                read the document you're working on.
              </span>
            </div>
          </div>
          <div className="sb-foot">
            <label className="ctxrow">
              <input type="checkbox" style={{ width: 'auto' }} /> Include current file in context{' '}
              <span className="hint">Note 1 · {chars} chars</span>
            </label>
            <div className="askrow">
              <textarea placeholder="Ask AI..."></textarea>
              <button className="send">↑</button>
            </div>
            <div className="modelrow">
              ◷ Model: <b>OpenAI: GPT-4.1 Mini</b> <span className="spacer" style={{ flex: 1 }}></span> ⌄
            </div>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="statusbar">
        <span>
          {words} words · {chars} chars
        </span>
        <span>Note 1</span>
        <span className="saved" style={{ color: savedColor }}>
          {saved}
        </span>
      </div>

      {/* Plus menu */}
      <div
        className={`menu ${menuOpen ? 'open' : ''}`}
        style={{ left: menuPos.left + 'px', top: menuPos.top + 'px' }}
      >
        <button onClick={() => handleMenuClick('text')}>＋ Text block</button>
        <button onClick={() => handleMenuClick('image')}>🖼 Image from device</button>
      </div>

      {/* Hint chip */}
      {showHint && (
        <div className="hintchip">
          <span>
            <b>Preview:</b> paste a screenshot (Ctrl+V) · hover an image & drag its <b>left or right edge</b> · hover a
            block for the ＋ menu
          </span>
          <button onClick={() => setShowHint(false)} style={{ color: 'var(--muted)' }}>
            ✕
          </button>
        </div>
      )}

      {/* Hidden file input */}
      <input type="file" ref={fileInputRef} accept="image/*" multiple hidden onChange={handleFileChange} />
    </div>
  );
}
