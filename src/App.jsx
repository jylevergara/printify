import { useMemo, useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import "./App.css";

const PAGE_W_IN = 11; // Letter landscape
const PAGE_H_IN = 8.5;
const PREVIEW_DPI = 64; // px per inch in the on-screen preview

// jsPDF uses points (1pt = 1/72in) internally for font sizing.
// We use unit: 'in' so getTextWidth returns inches.
function fitFontSizePdf(doc, text, maxWidthIn, maxHeightIn) {
  // Cap by height: cap-height of most fonts is ~0.7 of em, so 0.85*height
  // leaves a small visual margin.
  let size = Math.max(4, Math.floor(maxHeightIn * 72 * 0.85));
  doc.setFontSize(size);
  while (size > 4 && doc.getTextWidth(text) > maxWidthIn) {
    size -= 1;
    doc.setFontSize(size);
  }
  return size;
}

// Mirror the PDF sizing logic on-screen using a measurement canvas.
function fitFontSizePx(text, maxWidthPx, maxHeightPx, family, weight) {
  if (!text) return 0;
  const ctx =
    fitFontSizePx.ctx ||
    (fitFontSizePx.ctx = document.createElement("canvas").getContext("2d"));
  let size = Math.max(4, Math.floor(maxHeightPx * 0.85));
  while (size > 4) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidthPx) return size;
    size -= 1;
  }
  return size;
}

const FONT_CSS = "Helvetica, Arial, sans-serif";

const MIN_LABEL_IN = 0.5;

// Pick the (cols, rows) grid that fits all N labels on a single page.
// Text reads horizontally, so we maximize cell width first, then cell height
// as a tiebreaker. On a landscape page this favors wide stacked cells over
// tall side-by-side ones.
function autoFitLabelSize(n, pageW, pageH, margin, gap) {
  if (n <= 0) return null;
  const availW = pageW - 2 * margin + gap;
  const availH = pageH - 2 * margin + gap;
  if (availW <= 0 || availH <= 0) return null;
  let best = null;
  for (let c = 1; c <= n; c++) {
    const w = availW / c - gap;
    if (w < MIN_LABEL_IN) break;
    // For a given c, the smallest r that holds all n labels gives the tallest
    // cell. Any larger r would only shrink h without changing w.
    const r = Math.ceil(n / c);
    const h = availH / r - gap;
    if (h < MIN_LABEL_IN) continue;
    if (!best || w > best.w || (w === best.w && h > best.h)) best = { w, h };
  }
  return best;
}

export default function App() {
  const [manualWidth, setManualWidth] = useState(4);
  const [manualHeight, setManualHeight] = useState(2);
  const [margin, setMargin] = useState(0.25);
  const [gap, setGap] = useState(0.1);
  const [padding, setPadding] = useState(0.1);
  const [drawBorders, setDrawBorders] = useState(true);
  const [autoFit, setAutoFit] = useState(true);
  const [fontWeight, setFontWeight] = useState("normal");
  const [text, setText] = useState(
    "Kitty Cat Toys\nWhy Do I Own This\nMystery Cables\n",
  );
  const [previewPage, setPreviewPage] = useState(0);

  const labels = useMemo(
    () =>
      text
        .split("\n")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    [text],
  );

  const autoFitted = useMemo(
    () =>
      autoFit
        ? autoFitLabelSize(labels.length, PAGE_W_IN, PAGE_H_IN, margin, gap)
        : null,
    [autoFit, labels.length, margin, gap],
  );

  const labelWidth = autoFitted ? autoFitted.w : manualWidth;
  const labelHeight = autoFitted ? autoFitted.h : manualHeight;

  const layout = useMemo(() => {
    const cellW = labelWidth + gap;
    const cellH = labelHeight + gap;
    const availW = PAGE_W_IN - 2 * margin + gap;
    const availH = PAGE_H_IN - 2 * margin + gap;
    const cols = Math.max(0, Math.floor(availW / cellW));
    const rows = Math.max(0, Math.floor(availH / cellH));
    const perPage = cols * rows;
    const pages = perPage > 0 ? Math.ceil(labels.length / perPage) : 0;
    return { cols, rows, perPage, pages };
  }, [labelWidth, labelHeight, margin, gap, labels.length]);

  useEffect(() => {
    if (previewPage >= layout.pages)
      setPreviewPage(Math.max(0, layout.pages - 1));
  }, [layout.pages, previewPage]);

  const tooSmall = layout.perPage === 1 && labels.length > 1;
  const noFit = layout.perPage === 0;
  const autoFitFailed = autoFit && labels.length > 0 && !autoFitted;

  function previewPdf() {
    const doc = new jsPDF({
      unit: "in",
      format: "letter",
      orientation: "landscape",
    });
    doc.setFont("helvetica", fontWeight);

    const { cols, perPage } = layout;
    if (perPage === 0 || labels.length === 0) return;

    labels.forEach((label, i) => {
      const slot = i % perPage;
      if (i > 0 && slot === 0) doc.addPage();
      const col = slot % cols;
      const row = Math.floor(slot / cols);
      const x = margin + col * (labelWidth + gap);
      const y = margin + row * (labelHeight + gap);

      if (drawBorders) {
        doc.setLineWidth(0.005);
        doc.setDrawColor(180);
        doc.rect(x, y, labelWidth, labelHeight);
      }

      const innerW = labelWidth - 2 * padding;
      const innerH = labelHeight - 2 * padding;
      const size = fitFontSizePdf(doc, label, innerW, innerH);
      doc.setFontSize(size);
      doc.setTextColor(0, 0, 0);
      doc.text(label, x + labelWidth / 2, y + labelHeight / 2, {
        align: "center",
        baseline: "middle",
      });
    });

    window.open(doc.output("bloburl"), "_blank");
  }

  const pageLabels = useMemo(() => {
    const { perPage } = layout;
    if (!perPage) return [];
    return labels.slice(previewPage * perPage, (previewPage + 1) * perPage);
  }, [labels, layout, previewPage]);

  return (
    <div className="app">
      <h1>Overlabeled</h1>
      <p className="subtitle">
        Unleash the labels
        <img
          className="subtitle-gif"
          src="https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExZGttMmwzd2h5YnhycW1mbm9jMnVwbzFrd25ueWwyeDQ3dmFjbXp6dyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Ch1zCx8tu6DQY/giphy.gif"
          alt=""
        />
      </p>

      <div className="layout">
        <div className="panel">
          <div className="row">
            <div className="field">
              <label>Label width (in)</label>
              <input
                type="number"
                step="0.05"
                min="0.5"
                value={autoFit ? labelWidth.toFixed(2) : manualWidth}
                disabled={autoFit}
                onChange={(e) =>
                  setManualWidth(parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div className="field">
              <label>Label height (in)</label>
              <input
                type="number"
                step="0.05"
                min="0.5"
                value={autoFit ? labelHeight.toFixed(2) : manualHeight}
                disabled={autoFit}
                onChange={(e) =>
                  setManualHeight(parseFloat(e.target.value) || 0)
                }
              />
            </div>
          </div>

          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={autoFit}
                onChange={(e) => setAutoFit(e.target.checked)}
              />{" "}
              Auto-fit labels to one page
            </label>
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
              <label>Weight</label>
              <select
                value={fontWeight}
                onChange={(e) => setFontWeight(e.target.value)}
              >
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={drawBorders}
                onChange={(e) => setDrawBorders(e.target.checked)}
              />{" "}
              Draw cut borders
            </label>
          </div>

          <div className="field">
            <div className="field-header">
              <label>Labels (one per line)</label>
              <button
                type="button"
                className="link-button"
                onClick={() => setText('')}
                disabled={!text}
              >
                Clear
              </button>
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} />
          </div>

          <div className="summary">
            {autoFitFailed ? (
              <strong style={{ color: "crimson" }}>
                Too many labels to fit on a single page at the current
                margins/gap.
              </strong>
            ) : noFit ? (
              <strong style={{ color: "crimson" }}>
                Labels are too large to fit on the page. Reduce size or margins.
              </strong>
            ) : (
              <>
                {layout.cols} × {layout.rows} ={" "}
                <strong>{layout.perPage}</strong> labels per page.{" "}
                {labels.length} label{labels.length === 1 ? "" : "s"} →{" "}
                <strong>{layout.pages}</strong> page
                {layout.pages === 1 ? "" : "s"}.
                {tooSmall && (
                  <div style={{ color: "darkorange", marginTop: 4 }}>
                    Only 1 label per page — reduce label size to fit at least 2.
                  </div>
                )}
              </>
            )}
          </div>

          <button
            onClick={previewPdf}
            disabled={noFit || autoFitFailed || labels.length === 0}
          >
            Preview PDF
          </button>
        </div>

        <div className="panel preview-panel">
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
                onClick={() =>
                  setPreviewPage((p) => Math.min(layout.pages - 1, p + 1))
                }
                disabled={previewPage >= layout.pages - 1}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
  fontWeight,
  pageLabels,
}) {
  const pageWpx = PAGE_W_IN * PREVIEW_DPI;
  const pageHpx = PAGE_H_IN * PREVIEW_DPI;
  const labelWpx = labelW * PREVIEW_DPI;
  const labelHpx = labelH * PREVIEW_DPI;
  const innerWpx = (labelW - 2 * padding) * PREVIEW_DPI;
  const innerHpx = (labelH - 2 * padding) * PREVIEW_DPI;
  const cssFamily = FONT_CSS;

  const slots = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      slots.push({ col, row });
    }
  }

  return (
    <div
      className="preview-page"
      style={{ width: pageWpx, height: pageHpx, minWidth: pageWpx }}
    >
      {slots.map(({ col, row }, i) => {
        const text = pageLabels[i] || "";
        const left = (margin + col * (labelW + gap)) * PREVIEW_DPI;
        const top = (margin + row * (labelH + gap)) * PREVIEW_DPI;
        const size = fitFontSizePx(
          text,
          innerWpx,
          innerHpx,
          cssFamily,
          fontWeight,
        );
        return (
          <div
            key={`${row}-${col}`}
            className="preview-label"
            style={{
              left,
              top,
              width: labelWpx,
              height: labelHpx,
              borderStyle: drawBorders ? "dashed" : "none",
              fontFamily: cssFamily,
              fontWeight,
              fontSize: size ? `${size}px` : 0,
            }}
          >
            {text}
          </div>
        );
      })}
    </div>
  );
}
