/* eslint-disable */
(function () {
  'use strict';

  function $(sel) { return document.querySelector(sel); }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function toRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const bigint = parseInt(h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  function safeJsonParse(text, fallback) {
    try { return JSON.parse(text); } catch { return fallback; }
  }
  function downloadBlob(name, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
  }
  function showToastLocal(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast show';
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 200); }, 2000);
  }
  function toast(message, type) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(message, type || 'info'); return; } catch {}
    }
    showToastLocal(message);
  }

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    const canvasEl = document.getElementById('noteCanvas');
    const canvasWrap = canvasEl?.parentElement;
    const statusTool = document.getElementById('statusTool');
    const statusZoom = document.getElementById('statusZoom');

    const toolButtons = Array.from(document.querySelectorAll('.note-toolbar .tool'));
    const colorInput = document.getElementById('penColor');
    const sizeSelect = document.getElementById('penSize');

    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');

    const bgSelect = document.getElementById('bgSelect');
    const insertImageBtn = document.getElementById('insertImageBtn');
    const imageFile = document.getElementById('imageFile');

    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const zoomResetBtn = document.getElementById('zoomResetBtn');

    const exportPngBtn = document.getElementById('exportPngBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const importJsonBtn = document.getElementById('importJsonBtn');
    const jsonFileInput = document.getElementById('jsonFile');

    const noteNameInput = document.getElementById('noteName');
    const noteListSelect = document.getElementById('noteList');
    const newNoteBtn = document.getElementById('newNoteBtn');
    const saveNoteBtn = document.getElementById('saveNoteBtn');
    const deleteNoteBtn = document.getElementById('deleteNoteBtn');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');

    if (!canvasEl || !canvasWrap) return;

    const canvas = new fabric.Canvas('noteCanvas', {
      isDrawingMode: true,
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true
    });

    let currentTool = 'pen';
    let isSpacePanning = false;
    let lastNonPanTool = 'pen';
    let isDragging = false;
    let lastPosX = 0;
    let lastPosY = 0;
    let zoomLevel = 1;
    const ZOOM_MIN = 0.2;
    const ZOOM_MAX = 4;
    const ZOOM_STEP = 0.1;

    let drawingObject = null;
    let drawingStart = null;
    let placeholderText = null;

    const HISTORY_LIMIT = 50;
    const historyStack = [];
    const redoStack = [];

    function updateStatusTool() {
      const nameMap = {
        select: '선택', pan: '이동', pen: '펜', highlighter: '형광펜', line: '직선', rect: '사각형', ellipse: '원', text: '텍스트', eraser: '지우개'
      };
      statusTool && (statusTool.textContent = `도구: ${nameMap[currentTool] || currentTool}`);
    }
    function updateStatusZoom() {
      const percent = `${Math.round(zoomLevel * 100)}%`;
      if (statusZoom) statusZoom.textContent = `줌: ${percent}`;
      if (zoomResetBtn) zoomResetBtn.textContent = percent;
    }

    function resizeCanvas() {
      const w = canvasWrap.clientWidth;
      const h = canvasWrap.clientHeight;
      canvas.setWidth(w);
      canvas.setHeight(h);
      canvas.calcOffset();
      redrawBackground();
      centerPlaceholder();
      canvas.requestRenderAll();
    }

    function centerPlaceholder() {
      if (!placeholderText) return;
      placeholderText.set({ left: canvas.getWidth() / 2, top: canvas.getHeight() / 2 });
      placeholderText.setCoords();
    }

    function ensurePlaceholder() {
      if (canvas.getObjects().some(o => !(o.data && o.data.isBackgroundHelper))) return;
      placeholderText = new fabric.Text('필기 노트', {
        left: canvas.getWidth() / 2,
        top: canvas.getHeight() / 2,
        fontSize: 96,
        fill: '#cccccc',
        selectable: false,
        evented: false,
        originX: 'center',
        originY: 'center'
      });
      canvas.add(placeholderText);
      canvas.sendToBack(placeholderText);
    }

    function removePlaceholderIfNeeded() {
      if (!placeholderText) return;
      const hasUserObject = canvas.getObjects().some(o => !(o.data && o.data.isBackgroundHelper) && o !== placeholderText);
      if (hasUserObject) {
        canvas.remove(placeholderText);
        placeholderText = null;
      }
    }

    function saveHistory() {
      try {
        const json = JSON.stringify(canvas);
        historyStack.push(json);
        if (historyStack.length > HISTORY_LIMIT) historyStack.shift();
        redoStack.length = 0;
      } catch {}
    }
    function undo() {
      if (historyStack.length <= 1) return;
      const curr = historyStack.pop();
      redoStack.push(curr);
      const prev = historyStack[historyStack.length - 1];
      loadFromJSON(prev, true);
    }
    function redo() {
      if (!redoStack.length) return;
      const next = redoStack.pop();
      historyStack.push(next);
      loadFromJSON(next, true);
    }
    function loadFromJSON(json, skipPush) {
      try {
        const parsed = typeof json === 'string' ? JSON.parse(json) : json;
        canvas.loadFromJSON(parsed, () => {
          canvas.renderAll();
          redrawBackground();
          if (!skipPush) saveHistory();
          centerPlaceholder();
        });
      } catch {}
    }

    function clearCanvasToBlank() {
      canvas.clear();
      canvas.setBackgroundColor('#ffffff', canvas.renderAll.bind(canvas));
      redrawBackground();
      ensurePlaceholder();
      saveHistory();
    }

    function setTool(newTool) {
      currentTool = newTool;
      toolButtons.forEach(b => {
        const isActive = b.getAttribute('data-tool') === newTool;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-pressed', String(isActive));
      });
      canvas.isDrawingMode = false;
      canvas.selection = newTool === 'select';
      unbindCanvasPointerHandlers();
      if (newTool !== 'pan') {
        lastNonPanTool = newTool;
      }
      // 선택 도구 외에는 기존 객체를 선택/이동하지 못하도록 차단
      if (newTool === 'select') {
        canvas.skipTargetFind = false;
        setAllObjectsSelectable(true);
      } else {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        canvas.skipTargetFind = true;
        setAllObjectsSelectable(false);
      }
      if (newTool === 'pen' || newTool === 'highlighter' || newTool === 'eraser') {
        applyBrush();
        canvas.isDrawingMode = true;
        canvas.selection = false;
      } else if (newTool === 'pan') {
        bindPanHandlers();
        canvas.selection = false;
      } else if (newTool === 'line' || newTool === 'rect' || newTool === 'ellipse' || newTool === 'text') {
        bindShapeHandlers();
        canvas.selection = false;
      }
      updateStatusTool();
    }

    function setAllObjectsSelectable(enabled) {
      canvas.getObjects().forEach((obj) => {
        if (obj.data && obj.data.isBackgroundHelper) return;
        if (obj === placeholderText) return;
        obj.selectable = enabled;
        obj.evented = enabled;
      });
    }

    function applyBrush() {
      const size = parseInt(sizeSelect.value || '4', 10);
      const color = colorInput.value || '#000000';
      if (currentTool === 'pen') {
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = color;
        canvas.freeDrawingBrush.width = size;
        canvas.freeDrawingBrush.globalCompositeOperation = 'source-over';
        canvas.freeDrawingBrush.opacity = 1;
      } else if (currentTool === 'highlighter') {
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = toRgba(color, 0.25);
        canvas.freeDrawingBrush.width = size * 2;
        canvas.freeDrawingBrush.globalCompositeOperation = 'source-over';
        canvas.freeDrawingBrush.opacity = 1;
      } else if (currentTool === 'eraser') {
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.width = size * 2;
        canvas.freeDrawingBrush.color = '#ffffff';
        canvas.freeDrawingBrush.globalCompositeOperation = 'source-over';
        canvas.freeDrawingBrush.opacity = 1;
      }
    }

    function unbindCanvasPointerHandlers() {
      canvas.off('mouse:down');
      canvas.off('mouse:move');
      canvas.off('mouse:up');
    }

    function bindPanHandlers() {
      canvas.on('mouse:down', (opt) => {
        const e = opt.e; isDragging = true; canvas.setCursor('grabbing');
        lastPosX = e.clientX; lastPosY = e.clientY;
      });
      canvas.on('mouse:move', (opt) => {
        if (!isDragging) return;
        const e = opt.e;
        const vpt = canvas.viewportTransform || fabric.iMatrix.concat();
        vpt[4] += e.clientX - lastPosX;
        vpt[5] += e.clientY - lastPosY;
        canvas.setViewportTransform(vpt);
        lastPosX = e.clientX; lastPosY = e.clientY;
      });
      canvas.on('mouse:up', () => { isDragging = false; canvas.setCursor('default'); });
    }

    function bindShapeHandlers() {
      drawingObject = null; drawingStart = null;
      canvas.on('mouse:down', (opt) => {
        if (currentTool === 'text') {
          const p = canvas.getPointer(opt.e);
          const it = new fabric.IText('텍스트', {
            left: p.x, top: p.y, fontSize: 20, fill: colorInput.value || '#000000'
          });
          canvas.add(it);
          canvas.setActiveObject(it);
          it.enterEditing();
          removePlaceholderIfNeeded();
          saveHistory();
          return;
        }
        const start = canvas.getPointer(opt.e);
        drawingStart = start;
        if (currentTool === 'line') {
          drawingObject = new fabric.Line([start.x, start.y, start.x, start.y], {
            stroke: colorInput.value || '#000000', strokeWidth: parseInt(sizeSelect.value || '4', 10), selectable: true
          });
        } else if (currentTool === 'rect') {
          drawingObject = new fabric.Rect({
            left: start.x, top: start.y, width: 1, height: 1,
            fill: 'transparent', stroke: colorInput.value || '#000000', strokeWidth: parseInt(sizeSelect.value || '4', 10), selectable: true
          });
        } else if (currentTool === 'ellipse') {
          drawingObject = new fabric.Ellipse({
            left: start.x, top: start.y, rx: 1, ry: 1,
            fill: 'transparent', stroke: colorInput.value || '#000000', strokeWidth: parseInt(sizeSelect.value || '4', 10), selectable: true,
            originX: 'left', originY: 'top'
          });
        }
        if (drawingObject) {
          canvas.add(drawingObject);
        }
      });
      canvas.on('mouse:move', (opt) => {
        if (!drawingObject || !drawingStart) return;
        const pointer = canvas.getPointer(opt.e);
        if (currentTool === 'line') {
          drawingObject.set({ x2: pointer.x, y2: pointer.y });
        } else if (currentTool === 'rect') {
          const w = pointer.x - drawingStart.x;
          const h = pointer.y - drawingStart.y;
          drawingObject.set({ left: Math.min(pointer.x, drawingStart.x), top: Math.min(pointer.y, drawingStart.y), width: Math.abs(w), height: Math.abs(h) });
        } else if (currentTool === 'ellipse') {
          const rx = Math.abs(pointer.x - drawingStart.x) / 2;
          const ry = Math.abs(pointer.y - drawingStart.y) / 2;
          drawingObject.set({
            left: Math.min(pointer.x, drawingStart.x),
            top: Math.min(pointer.y, drawingStart.y),
            rx, ry
          });
        }
        drawingObject.setCoords();
        canvas.requestRenderAll();
      });
      canvas.on('mouse:up', () => {
        if (drawingObject) {
          drawingObject.setCoords();
          drawingObject = null; drawingStart = null;
          removePlaceholderIfNeeded();
          saveHistory();
        }
      });
    }

    canvas.on('path:created', (opt) => {
      const path = opt.path;
      if (currentTool === 'eraser') {
        eraseIntersecting(path);
        canvas.remove(path);
        canvas.requestRenderAll();
        saveHistory();
        return;
      }
      removePlaceholderIfNeeded();
      saveHistory();
    });

    function rectsIntersect(r1, r2) {
      return !(
        r2.left > r1.left + r1.width ||
        r2.left + r2.width < r1.left ||
        r2.top > r1.top + r1.height ||
        r2.top + r2.height < r1.top
      );
    }
    function eraseIntersecting(eraserPath) {
      const eraserBox = eraserPath.getBoundingRect(true, true);
      const toRemove = [];
      canvas.getObjects().forEach((obj) => {
        if (obj === eraserPath) return;
        if (obj.data && obj.data.isBackgroundHelper) return;
        if (obj === placeholderText) return;
        const box = obj.getBoundingRect(true, true);
        if (rectsIntersect(eraserBox, box)) toRemove.push(obj);
      });
      toRemove.forEach((o) => canvas.remove(o));
    }

    function setZoom(newZoom, centerPoint) {
      zoomLevel = clamp(newZoom, ZOOM_MIN, ZOOM_MAX);
      const center = centerPoint || new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
      canvas.zoomToPoint(center, zoomLevel);
      updateStatusZoom();
    }

    function zoomIn() { setZoom(zoomLevel + ZOOM_STEP); }
    function zoomOut() { setZoom(zoomLevel - ZOOM_STEP); }
    function zoomReset() { setZoom(1); canvas.setViewportTransform([1,0,0,1,0,0]); }

    function redrawBackground() {
      const prev = canvas.getObjects().filter(o => o.data && o.data.isBackgroundHelper);
      prev.forEach(o => canvas.remove(o));
      const type = bgSelect?.value || 'none';
      if (type === 'none') { canvas.requestRenderAll(); return; }
      const w = canvas.getWidth();
      const h = canvas.getHeight();
      const gap = 40;
      if (type === 'ruled' || type === 'grid') {
        for (let y = 0; y <= h; y += gap) {
          const line = new fabric.Line([0, y, w, y], { stroke: '#e9e4dd', selectable: false, evented: false, excludeFromExport: false });
          line.data = { isBackgroundHelper: true };
          canvas.add(line);
          canvas.sendToBack(line);
        }
        if (type === 'grid') {
          for (let x = 0; x <= w; x += gap) {
            const line = new fabric.Line([x, 0, x, h], { stroke: '#efe8e0', selectable: false, evented: false, excludeFromExport: false });
            line.data = { isBackgroundHelper: true };
            canvas.add(line);
            canvas.sendToBack(line);
          }
        }
      }
      if (placeholderText) canvas.bringToFront(placeholderText);
      canvas.requestRenderAll();
    }

    function refreshNoteList() {
      const store = safeJsonParse(localStorage.getItem('gsg_note_store_v1') || '{}', {});
      const names = Object.keys(store).sort();
      noteListSelect.innerHTML = '';
      const defaultOpt = document.createElement('option');
      defaultOpt.value = ''; defaultOpt.textContent = '저장된 노트 선택';
      noteListSelect.appendChild(defaultOpt);
      names.forEach((name) => {
        const o = document.createElement('option');
        o.value = name; o.textContent = name; noteListSelect.appendChild(o);
      });
    }
    function saveCurrentNote() {
      const name = (noteNameInput.value || '').trim();
      if (!name) { toast('노트 이름을 입력하세요.', 'error'); return; }
      const store = safeJsonParse(localStorage.getItem('gsg_note_store_v1') || '{}', {});
      store[name] = { json: JSON.stringify(canvas), updatedAt: Date.now() };
      localStorage.setItem('gsg_note_store_v1', JSON.stringify(store));
      refreshNoteList();
      Array.from(noteListSelect.options).forEach(o => { if (o.value === name) o.selected = true; });
      toast('저장 완료', 'success');
    }
    function deleteCurrentNote() {
      const name = (noteNameInput.value || noteListSelect.value || '').trim();
      if (!name) { toast('삭제할 노트를 선택하세요.', 'error'); return; }
      const store = safeJsonParse(localStorage.getItem('gsg_note_store_v1') || '{}', {});
      if (!store[name]) { toast('해당 이름의 노트가 없습니다.', 'error'); return; }
      delete store[name];
      localStorage.setItem('gsg_note_store_v1', JSON.stringify(store));
      refreshNoteList();
      toast('삭제 완료', 'success');
    }
    function loadNoteByName(name) {
      const store = safeJsonParse(localStorage.getItem('gsg_note_store_v1') || '{}', {});
      const entry = store[name];
      if (!entry) { toast('노트를 찾을 수 없습니다.', 'error'); return; }
      loadFromJSON(entry.json);
      noteNameInput.value = name;
      toast('불러오기 완료', 'success');
    }

    function exportPng() {
      const name = (noteNameInput.value || 'note').trim();
      const dataURL = canvas.toDataURL({ format: 'png' });
      const a = document.createElement('a');
      a.href = dataURL; a.download = `${name}.png`; document.body.appendChild(a); a.click(); a.remove();
    }
    function exportJson() {
      const name = (noteNameInput.value || 'note').trim();
      const json = JSON.stringify(canvas, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      downloadBlob(`${name}.json`, blob);
    }
    function importJson(file) {
      const reader = new FileReader();
      reader.onload = () => {
        const txt = String(reader.result || '');
        loadFromJSON(txt);
        toast('JSON 로드 완료', 'success');
      };
      reader.readAsText(file);
    }

    function insertImageFromFile(file) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataURL = String(reader.result || '');
        fabric.Image.fromURL(dataURL, (img) => {
          const maxW = canvas.getWidth() * 0.9;
          const maxH = canvas.getHeight() * 0.9;
          const scale = Math.min(1, maxW / img.width, maxH / img.height);
          img.set({ left: canvas.getWidth() * 0.05, top: canvas.getHeight() * 0.05, scaleX: scale, scaleY: scale });
          canvas.add(img);
          canvas.setActiveObject(img);
          removePlaceholderIfNeeded();
          saveHistory();
        }, { crossOrigin: 'anonymous' });
      };
      reader.readAsDataURL(file);
    }

    function deleteSelection() {
      const active = canvas.getActiveObjects();
      if (!active || !active.length) return;
      active.forEach(obj => canvas.remove(obj));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      saveHistory();
    }

    toolButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = btn.getAttribute('data-tool');
        if (!t) return;
        setTool(t);
      });
    });
    colorInput.addEventListener('change', () => { if (canvas.isDrawingMode) applyBrush(); });
    sizeSelect.addEventListener('change', () => { if (canvas.isDrawingMode) applyBrush(); });

    undoBtn.addEventListener('click', () => undo());
    redoBtn.addEventListener('click', () => redo());

    bgSelect.addEventListener('change', () => { redrawBackground(); saveHistory(); });
    insertImageBtn.addEventListener('click', () => imageFile.click());
    imageFile.addEventListener('change', () => { const f = imageFile.files?.[0]; if (f) insertImageFromFile(f); imageFile.value = ''; });

    zoomInBtn.addEventListener('click', zoomIn);
    zoomOutBtn.addEventListener('click', zoomOut);
    zoomResetBtn.addEventListener('click', zoomReset);

    exportPngBtn.addEventListener('click', exportPng);
    exportJsonBtn.addEventListener('click', exportJson);
    importJsonBtn.addEventListener('click', () => jsonFileInput.click());
    jsonFileInput.addEventListener('change', () => { const f = jsonFileInput.files?.[0]; if (f) importJson(f); jsonFileInput.value=''; });

    newNoteBtn.addEventListener('click', () => { noteNameInput.value=''; clearCanvasToBlank(); toast('새 노트', 'info'); });
    saveNoteBtn.addEventListener('click', saveCurrentNote);
    deleteNoteBtn.addEventListener('click', deleteCurrentNote);
    noteListSelect.addEventListener('change', () => { const name = noteListSelect.value; if (name) loadNoteByName(name); });
    deleteSelectedBtn.addEventListener('click', deleteSelection);

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    ensurePlaceholder();
    saveHistory();
    setTool('pen');
    updateStatusTool();
    updateStatusZoom();
    refreshNoteList();

    canvas.on('mouse:wheel', function(opt) {
      const evt = opt.e;
      const delta = Math.sign(evt.deltaY);
      if (!evt.ctrlKey && !evt.metaKey) return;
      opt.e.preventDefault(); opt.e.stopPropagation();
      const center = new fabric.Point(evt.offsetX, evt.offsetY);
      if (delta > 0) setZoom(zoomLevel - ZOOM_STEP, center); else setZoom(zoomLevel + ZOOM_STEP, center);
    });

    canvas.on('object:modified', () => { removePlaceholderIfNeeded(); saveHistory(); });
    canvas.on('object:added', (e) => {
      const o = e.target; if (o && !(o.data && o.data.isBackgroundHelper)) removePlaceholderIfNeeded();
    });

    window.addEventListener('keydown', (e) => {
      const tag = (e.target && (e.target.tagName || '')).toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (canvas.getActiveObject() && canvas.getActiveObject().isEditing) return;
      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && key === 'z') { e.preventDefault(); undo(); return; }
      if ((ctrl && key === 'y') || (ctrl && e.shiftKey && key === 'z')) { e.preventDefault(); redo(); return; }
      if (key === 'delete' || key === 'backspace') { e.preventDefault(); deleteSelection(); return; }
      if (key === 'v') { setTool('select'); return; }
      if (key === 'b') { setTool('pen'); return; }
      if (key === 'h') { setTool('highlighter'); return; }
      if (key === 'l') { setTool('line'); return; }
      if (key === 'r') { setTool('rect'); return; }
      if (key === 'o') { setTool('ellipse'); return; }
      if (key === 't') { setTool('text'); return; }
      if (key === 'e') { setTool('eraser'); return; }
      if (key === ' ') {
        if (e.repeat) return;
        isSpacePanning = true;
        setTool('pan');
        return;
      }
      if (key === '+' || key === '=') { e.preventDefault(); zoomIn(); return; }
      if (key === '-') { e.preventDefault(); zoomOut(); return; }
      if (key === '0') { e.preventDefault(); zoomReset(); return; }
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === ' ' && isSpacePanning) {
        isSpacePanning = false;
        setTool(lastNonPanTool || 'pen');
      }
    });

    // postMessage 리스너 추가 (iframe 통신용)
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'resetNote' && event.data.action === 'clearCanvas') {
        clearCanvasToBlank();
        noteNameInput.value = '';
        toast('노트가 초기화되었습니다', 'info');
      }
    });
  }
})();


