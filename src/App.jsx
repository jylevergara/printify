import { useMemo, useState, useRef, useEffect } from 'react'
import { jsPDF } from 'jspdf'
import './App.css'

const PAGE_W_IN = 11 // Letter landscape
const PAGE_H_IN = 8.5
const PREVIEW_DPI = 64 // px per inch in the on-screen preview

// jsPDF uses points (1pt = 1/72in) internally for font sizing.
// We use unit: 'in' so getTextWidth returns inches.
function fitFontSizePdf(doc, text, maxWidthIn, maxHeightIn) {
  // Cap by height: cap-height of most fonts is ~0.7 of em, so 0.85*height
  // leaves a small visual margin.
  let size = Math.max(4, Math.floor(maxHeightIn * 72 * 0.85))
  doc.setFontSize(size)
  while (size > 4 && doc.getTextWidth(text) > maxWidthIn) {
    size -= 1
    doc.setFontSize(size)
  }
  return size
}

// Mirror the PDF sizing logic on-screen using a measurement canvas.
function fitFontSizePx(text, maxWidthPx, maxHeightPx, family, weight) {
  if (!text) return 0
  const ctx = fitFontSizePx.ctx || (fitFontSizePx.ctx = document.createElement('canvas').getContext('2d'))
  let size = Math.max(4, Math.floor(maxHeightPx * 0.85))
  while (size > 4) {
    ctx.font = `${weight} ${size}px ${family}`
    if (ctx.measureText(text).width <= maxWidthPx) return size
    size -= 1
  }
  return size
}

const FONT_MAP = {
  Helvetica: { pdf: 'helvetica', css: 'Helvetica, Arial, sans-serif' },
  Times: { pdf: 'times', css: '"Times New Roman", Times, serif' },
  Courier: { pdf: 'courier', css: '"Courier New", Courier, monospace' },
}

export default function App() {
  const [labelWidth, setLabelWidth] = useState(4)
  const [labelHeight, setLabelHeight] = useState(2)
  const [margin, setMargin] = useState(0.25)
  const [gap, setGap] = useState(0.1)
  const [padding, setPadding] = useState(0.1)
  const [drawBorders, setDrawBorders] = useState(true)
  const [fontKey, setFontKey] = useState('Helvetica')
  const [fontWeight, setFontWeight] = useState('bold')
  const [text, setText] = useState('Hello World\nKitchen\nBathroom Cabinet\nGuest Room — Linens\nGarage Shelf A')
  const [previewPage, setPreviewPage] = useState(0)

  const labels = useMemo(
    () => text.split('\n').map((s) => s.trim()).filter(Boolean),
    [text]
  )

  const layout = useMemo(() => {
    const cellW = labelWidth + gap
    const cellH = labelHeight + gap
    const availW = PAGE_W_IN - 2 * margin + gap
    const availH = PAGE_H_IN - 2 * margin + gap
    const cols = Math.max(0, Math.floor(availW / cellW))
    const rows = Math.max(0, Math.floor(availH / cellH))
    const perPage = cols * rows
    const pages = perPage > 0 ? Math.ceil(labels.length / perPage) : 0
    return { cols, rows, perPage, pages }
  }, [labelWidth, labelHeight, margin, gap, labels.length])

  useEffect(() => {
    if (previewPage >= layout.pages) setPreviewPage(Math.max(0, layout.pages - 1))
  }, [layout.pages, previewPage])

  const tooSmall = layout.perPage > 0 && layout.perPage < 2
  const noFit = layout.perPage === 0

  function generatePdf() {
    const doc = new jsPDF({ unit: 'in', format: 'letter', orientation: 'landscape' })
    doc.setFont(FONT_MAP[fontKey].pdf, fontWeight)

    const { cols, rows, perPage } = layout
    if (perPage === 0 || labels.length === 0) return

    labels.forEach((label, i) => {
      const pageIdx = Math.floor(i / perPage)
      const slot = i % perPage
      if (slot === 0 && pageIdx > 0) doc.addPage()
      const col = slot % cols
      const row = Math.floor(slot / cols)
      const x = margin + col * (labelWidth + gap)
      const y = margin + row * (labelHeight + gap)

      if (drawBorders) {
        doc.setLineWidth(0.005)
        doc.setDrawColor(180)
        doc.rect(x, y, labelWidth, labelHeight)
      }

      const innerW = labelWidth - 2 * padding
      const innerH = labelHeight - 2 * padding
      const size = fitFontSizePdf(doc, label, innerW, innerH)
      doc.setFontSize(size)
      doc.setTextColor(0, 0, 0)
      doc.text(label, x + labelWidth / 2, y + labelHeight / 2, {
        align: 'center',
        baseline: 'middle',
      })
    })

    doc.save('labels.pdf')
  }

  const pageLabels = useMemo(() => {
    const { perPage } = layout
    if (!perPage) return []
    return labels.slice(previewPage * perPage, (previewPage + 1) * perPage)
  }, [labels, layout, previewPage])

  return (
    <div className="app">
      <h1>Printify</h1>
      <p className="subtitle">Generate a printable label sheet (US Letter, landscape).</p>

      <div className="layout">
        <div className="panel">
          <div className="row">
            <div className="field">
              <label>Label width (in)</label>
              <input
                type="number"
                step="0.05"
                min="0.5"
                value={labelWidth}
                onChange={(e) => setLabelWidth(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="field">
              <label>Label height (in)</label>
              <input
                type="number"
                step="0.05"
                min="0.5"
                value={labelHeight}
                onChange={(e) => setLabelHeight(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label>Page margin (in)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                value={margin}
                onChange={(e) => setMargin(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="field">
              <label>Gap between (in)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                value={gap}
                onChange={(e) => setGap(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label>Text padding (in)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                value={padding}
                onChange={(e) => setPadding(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="field">
              <label>Font</label>
              <select value={fontKey} onChange={(e) => setFontKey(e.target.value)}>
                {Object.keys(FONT_MAP).map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label>Weight</label>
              <select value={fontWeight} onChange={(e) => setFontWeight(e.target.value)}>
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
              </select>
            </div>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <label style={{ marginTop: 20 }}>
                <input
                  type="checkbox"
                  checked={drawBorders}
                  onChange={(e) => setDrawBorders(e.target.checked)}
                />{' '}
                Draw cut borders
              </label>
            </div>
          </div>

          <div className="field">
            <label>Labels (one per line)</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} />
          </div>

          <div className="summary">
            {noFit ? (
              <strong style={{ color: 'crimson' }}>
                Labels are too large to fit on the page. Reduce size or margins.
              </strong>
            ) : (
              <>
                {layout.cols} × {layout.rows} = <strong>{layout.perPage}</strong> labels per page.
                {' '}
                {labels.length} label{labels.length === 1 ? '' : 's'} →{' '}
                <strong>{layout.pages}</strong> page{layout.pages === 1 ? '' : 's'}.
                {tooSmall && (
                  <div style={{ color: 'darkorange', marginTop: 4 }}>
                    Only 1 label per page — reduce label size to fit at least 2.
                  </div>
                )}
              </>
            )}
          </div>

          <button onClick={generatePdf} disabled={noFit || labels.length === 0}>
            Download PDF
          </button>
        </div>

        <div className="panel">
          <div className="preview-wrap">
            <PagePreview
              cols={layout.cols}
              rows={layout.rows}
              labelW={labelWidth}
              labelH={labelHeight}
              margin={margin}
              gap={gap}
              padding={padding}
              drawBorders={drawBorders}
              fontKey={fontKey}
              fontWeight={fontWeight}
              pageLabels={pageLabels}
            />
          </div>
          {layout.pages > 1 && (
            <div className="page-nav">
              <button
                onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}
                disabled={previewPage === 0}
              >
                ← Prev
              </button>
              <span>
                Page {previewPage + 1} of {layout.pages}
              </span>
              <button
                onClick={() => setPreviewPage((p) => Math.min(layout.pages - 1, p + 1))}
                disabled={previewPage >= layout.pages - 1}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PagePreview({
  cols,
  rows,
  labelW,
  labelH,
  margin,
  gap,
  padding,
  drawBorders,
  fontKey,
  fontWeight,
  pageLabels,
}) {
  const pageWpx = PAGE_W_IN * PREVIEW_DPI
  const pageHpx = PAGE_H_IN * PREVIEW_DPI
  const labelWpx = labelW * PREVIEW_DPI
  const labelHpx = labelH * PREVIEW_DPI
  const innerWpx = (labelW - 2 * padding) * PREVIEW_DPI
  const innerHpx = (labelH - 2 * padding) * PREVIEW_DPI
  const cssFamily = FONT_MAP[fontKey].css

  const slots = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      slots.push({ col, row })
    }
  }

  return (
    <div
      className="preview-page"
      style={{ width: pageWpx, height: pageHpx, minWidth: pageWpx }}
    >
      {slots.map(({ col, row }, i) => {
        const text = pageLabels[i] || ''
        const left = (margin + col * (labelW + gap)) * PREVIEW_DPI
        const top = (margin + row * (labelH + gap)) * PREVIEW_DPI
        const size = fitFontSizePx(text, innerWpx, innerHpx, cssFamily, fontWeight)
        return (
          <div
            key={`${row}-${col}`}
            className="preview-label"
            style={{
              left,
              top,
              width: labelWpx,
              height: labelHpx,
              borderStyle: drawBorders ? 'dashed' : 'none',
              fontFamily: cssFamily,
              fontWeight,
              fontSize: size ? `${size}px` : 0,
            }}
          >
            {text}
          </div>
        )
      })}
    </div>
  )
}
