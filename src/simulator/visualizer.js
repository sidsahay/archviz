export class SVVisualizer {
  constructor(canvasElement, ast = null, timeline = []) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.ast = ast;
    this.timeline = timeline;
    this.currentTime = 0;
    this.devicePixelRatio = window.devicePixelRatio || 1;
    
    // Canvas layout constants
    this.portRadius = 6;
    
    // Interaction state
    this.cameraX = 0;
    this.cameraY = 0;
    this.zoom = 1;
    this.nodes = [];
    this.nodesAst = null;
    
    this.isDraggingCanvas = false;
    this.dragNode = null;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.initInteractions();
  }

  initInteractions() {
    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const worldX = (mouseX / this.zoom) - this.cameraX;
      const worldY = (mouseY / this.zoom) - this.cameraY;

      // Check if clicked inside a node (reverse order to get top-most)
      for (let i = this.nodes.length - 1; i >= 0; i--) {
        const node = this.nodes[i];
        if (worldX >= node.x && worldX <= node.x + node.w &&
            worldY >= node.y && worldY <= node.y + node.h) {
          this.dragNode = node;
          this.dragOffsetX = worldX - node.x;
          this.dragOffsetY = worldY - node.y;
          this.canvas.style.cursor = 'grabbing';
          return;
        }
      }

      this.isDraggingCanvas = true;
      this.lastMouseX = mouseX;
      this.lastMouseY = mouseY;
      this.canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (this.dragNode) {
        const worldX = (mouseX / this.zoom) - this.cameraX;
        const worldY = (mouseY / this.zoom) - this.cameraY;
        this.dragNode.x = worldX - this.dragOffsetX;
        this.dragNode.y = worldY - this.dragOffsetY;
        this.draw();
      } else if (this.isDraggingCanvas) {
        const dx = (mouseX - this.lastMouseX) / this.zoom;
        const dy = (mouseY - this.lastMouseY) / this.zoom;
        this.cameraX += dx;
        this.cameraY += dy;
        this.lastMouseX = mouseX;
        this.lastMouseY = mouseY;
        this.draw();
      } else {
        // Hover pointer checks
        const worldX = (mouseX / this.zoom) - this.cameraX;
        const worldY = (mouseY / this.zoom) - this.cameraY;
        let isHoverNode = false;
        for (let i = this.nodes.length - 1; i >= 0; i--) {
            const node = this.nodes[i];
            if (worldX >= node.x && worldX <= node.x + node.w && worldY >= node.y && worldY <= node.y + node.h) {
                isHoverNode = true;
                break;
            }
        }
        this.canvas.style.cursor = isHoverNode ? 'grab' : 'default';
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDraggingCanvas = false;
      this.dragNode = null;
      this.canvas.style.cursor = 'grab';
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = 1.1;
      const oldZoom = this.zoom;
      
      if (e.deltaY < 0) {
        this.zoom *= zoomFactor;
      } else {
        this.zoom /= zoomFactor;
      }
      
      this.zoom = Math.max(0.1, Math.min(this.zoom, 5));

      // Adjust camera to zoom into mouse point
      this.cameraX -= (mouseX / oldZoom) - (mouseX / this.zoom);
      this.cameraY -= (mouseY / oldZoom) - (mouseY / this.zoom);
      
      this.draw();
    }, { passive: false });
  }

  resize() {
    const parent = this.canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    this.canvas.width = rect.width * this.devicePixelRatio;
    this.canvas.height = rect.height * this.devicePixelRatio;
    this.draw();
  }

  updateData(ast, timeline) {
    this.ast = ast;
    this.timeline = timeline;
    this.currentTime = 0;
    this.draw();
  }

  setCurrentTime(t) {
    this.currentTime = t;
    this.draw();
  }

  getSignalValue(path) {
    if (this.timeline.length === 0) return 'x';
    let frame = this.timeline[0];
    for (let i = 0; i < this.timeline.length; i++) {
        if (this.timeline[i].time <= this.currentTime) {
            frame = this.timeline[i];
        } else {
            break;
        }
    }
    const val = frame.state[path];
    return val !== undefined ? val : 'x';
  }

  formatValue(val, width = 1) {
    if (val === 'x') return 'x';
    if (width === 1) return val.toString();
    return "8'h" + val.toString(16).padStart(2, '0').toUpperCase();
  }

  initNodes() {
    this.nodes = [];
    if (!this.ast || !this.ast.top) return;

    const top = this.ast.top;
    this.ctx.font = '11px JetBrains Mono'; // Ensure ctx has font set for measuring
    
    // Add tb node
    this.nodes.push({
      id: top.name,
      modDef: top,
      inst: { type: top.name, name: top.name, mappings: {} },
      parentName: "",
      x: 40,
      y: 40,
      w: 0, h: 0 // Will be calculated dynamically
    });

    let instY = 40;
    for (let i = 0; i < top.instances.length; i++) {
      const inst = top.instances[i];
      const modDef = this.ast.modules.find(m => m.name === inst.type);
      if (modDef) {
        this.nodes.push({
          id: `${top.name}.${inst.name}`,
          modDef: modDef,
          inst: inst,
          parentName: top.name,
          x: 400, // Shifted to the right initially
          y: instY,
          w: 0, h: 0
        });
        instY += 160; 
      }
    }

    // Precalculate sizes for all modules so they render perfectly fit
    this.nodes.forEach(node => {
        const inputs = node.modDef.ports.filter(p => p.direction === 'input');
        const outputs = node.modDef.ports.filter(p => p.direction === 'output');
        const internalSignals = [
          ...node.modDef.signals.filter(sig => !node.modDef.ports.some(p => p.name === sig.name)),
          ...node.modDef.ports.filter(p => p.type === 'reg' || p.type === 'logic')
        ];

        let maxInW = 0;
        inputs.forEach(p => maxInW = Math.max(maxInW, this.ctx.measureText(p.name).width));
        
        let maxOutW = 0;
        outputs.forEach(p => maxOutW = Math.max(maxOutW, this.ctx.measureText(p.name).width));

        let maxIntW = 0;
        internalSignals.forEach(sig => {
            const txt = `${sig.type} ${sig.name}`;
            maxIntW = Math.max(maxIntW, this.ctx.measureText(txt).width);
        });

        // Min width to comfortably hold title and internal state label
        const titleW = this.ctx.measureText(`${node.inst.type} ${node.inst.name}`).width;
        let w = Math.max(160, titleW + 40);

        // Accommodate ports pushing inwards
        w = Math.max(w, maxInW + maxOutW + 120);
        // Accommodate internal signals
        w = Math.max(w, maxIntW + 80);

        const maxPorts = Math.max(inputs.length, outputs.length);
        const portHeight = Math.max(inputs.length, outputs.length) * 25 + 40;
        const h = Math.max(100, portHeight + (internalSignals.length > 0 ? internalSignals.length * 25 + 40 : 10));

        node.w = w;
        node.h = h;
    });

    // Space instances vertically avoiding overlap
    let nextInstY = 40;
    this.nodes.forEach((node, i) => {
        if (i === 0) return; // leave tb alone
        node.y = nextInstY;
        nextInstY += node.h + 50;
    });

    // Recalibrate tb node height dynamically if needed
    // tb might be big so we only guarantee a minimum, user can drag
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (!this.ast || !this.ast.top) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Inter';
      ctx.fillText('No AST loaded. Click Simulate.', 20, 30);
      return;
    }

    if (this.nodesAst !== this.ast) {
        this.initNodes();
        this.nodesAst = this.ast;
    }

    ctx.save();
    // Apply Device Pixel Ratio
    ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
    
    // Apply camera Pan/Zoom
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(this.cameraX, this.cameraY);

    this.portLocations = {};
    this.signalLocations = {};

    // First pass: Draw Nodes
    this.nodes.forEach(node => {
        this.drawInstanceBox(ctx, node);
    });

    // Second pass: Draw Wires
    const top = this.ast.top;
    top.instances.forEach(inst => {
      Object.keys(inst.mappings).forEach(portName => {
        const sigName = inst.mappings[portName];
        
        const sigLoc = this.signalLocations[`${top.name}.${sigName}`];
        const portLoc = this.portLocations[`${top.name}.${inst.name}.${portName}`];
        
        if (sigLoc && portLoc) {
          ctx.beginPath();
          ctx.moveTo(sigLoc.x, sigLoc.y);
          
          // Cubic Bezier to curve smoothly out from side edges
          const midPointX1 = sigLoc.x + Math.max(20, Math.abs(portLoc.x - sigLoc.x) * 0.4);
          const midPointX2 = portLoc.x - Math.max(20, Math.abs(portLoc.x - sigLoc.x) * 0.4);
          
          ctx.bezierCurveTo(
            midPointX1, sigLoc.y,
            midPointX2, portLoc.y,
            portLoc.x, portLoc.y
          );
          
          ctx.strokeStyle = portLoc.color;
          ctx.lineCap = 'round';
          
          if (sigLoc.val === 1 || sigLoc.val === '1') {
            ctx.shadowColor = portLoc.color;
            ctx.shadowBlur = 6 / this.zoom; // scale blur visually consistent
            ctx.lineWidth = 2.5;
          } else if (sigLoc.color === '#f59e0b' && sigLoc.val !== 0 && sigLoc.val !== '0') {
            ctx.shadowColor = portLoc.color;
            ctx.shadowBlur = 4 / this.zoom;
            ctx.lineWidth = 2.5;
          } else {
            ctx.shadowBlur = 0;
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#475569';
          }
          
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      });
    });

    ctx.restore();
  }

  drawInstanceBox(ctx, node) {
    const { x, y, w, h, modDef, inst, parentName } = node;
    
    const internalSignals = [
      ...modDef.signals.filter(sig => !modDef.ports.some(p => p.name === sig.name)),
      ...modDef.ports.filter(p => p.type === 'reg' || p.type === 'logic')
    ];

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Inter';
    ctx.fillText(`${inst.type} ${inst.name}`, x + 8, y + 18);

    const inputs = modDef.ports.filter(p => p.direction === 'input');
    const outputs = modDef.ports.filter(p => p.direction === 'output');

    // Draw Inputs on the left
    let leftY = y + 40;
    inputs.forEach(port => {
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px JetBrains Mono';
      
      const portCircleX = x;
      ctx.fillText(port.name, x + 12, leftY + 4);

      const fullPath = parentName ? `${parentName}.${inst.name}.${port.name}` : `${inst.name}.${port.name}`;
      const val = this.getSignalValue(fullPath);
      const valStr = this.formatValue(val, port.width);
      const color = this.getLogicColor(val);

      ctx.beginPath();
      ctx.arc(portCircleX, leftY, this.portRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      if (val === 1 || color === '#f59e0b') {
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();

      const locKey = parentName ? `${parentName}.${inst.name}.${port.name}` : `${inst.name}.${port.name}`;
      this.portLocations[locKey] = { x: portCircleX, y: leftY, color, isInput: true };

      if (!inst.mappings || !inst.mappings[port.name]) {
           this.drawBadge(ctx, x - 40, leftY - 8, valStr, color);
      }
      leftY += 25;
    });

    // Draw Outputs on the right
    let rightY = y + 40;
    outputs.forEach(port => {
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px JetBrains Mono';
      
      const portCircleX = x + w;
      const nmW = ctx.measureText(port.name).width;
      ctx.fillText(port.name, x + w - nmW - 12, rightY + 4);

      const fullPath = parentName ? `${parentName}.${inst.name}.${port.name}` : `${inst.name}.${port.name}`;
      const val = this.getSignalValue(fullPath);
      const valStr = this.formatValue(val, port.width);
      const color = this.getLogicColor(val);

      ctx.beginPath();
      ctx.arc(portCircleX, rightY, this.portRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      if (val === 1 || color === '#f59e0b') {
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();

      const locKey = parentName ? `${parentName}.${inst.name}.${port.name}` : `${inst.name}.${port.name}`;
      this.portLocations[locKey] = { x: portCircleX, y: rightY, color, isInput: false };

      this.drawBadge(ctx, x + w + 10, rightY - 8, valStr, color);
      rightY += 25;
    });

    const portBottomY = Math.max(leftY, rightY);

    // Draw Internal Signals/Regs perfectly mapped down the right side as outputs
    if (internalSignals.length > 0) {
      let instSigY = portBottomY + 10;
      ctx.fillStyle = '#475569';
      ctx.font = 'italic 10px Inter';
      ctx.fillText('Internal State', x + 10, instSigY - 5);
      
      internalSignals.forEach(sig => {
        const fullPath = parentName ? `${parentName}.${inst.name}.${sig.name}` : `${inst.name}.${sig.name}`;
        const val = this.getSignalValue(fullPath);
        const valStr = this.formatValue(val, sig.width);
        const color = this.getLogicColor(val);

        ctx.fillStyle = '#64748b';
        ctx.font = '10px JetBrains Mono';
        ctx.fillText(`${sig.type} ${sig.name}`, x + 10, instSigY + 12);
        
        this.drawBadge(ctx, x + w - 40, instSigY, valStr, color);

        const dotX = x + w;
        const dotY = instSigY + 9;
        ctx.beginPath();
        ctx.arc(dotX, dotY, this.portRadius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.stroke();

        if (val === 1 || color === '#f59e0b') {
          ctx.shadowColor = color;
          ctx.shadowBlur = 4;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        this.signalLocations[fullPath] = { x: dotX, y: dotY, color, val };

        instSigY += 25;
      });
    }
  }

  drawBadge(ctx, x, y, text, color) {
    ctx.font = '11px JetBrains Mono';
    const td = ctx.measureText(text);
    const tw = td.width + 8;
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, tw, 18, 4);
    ctx.fill();

    ctx.fillStyle = (color === '#10b981' || color === '#f59e0b' || color === '#ef4444') ? '#000' : '#fff';
    ctx.fillText(text, x + 4, y + 13);
  }

  getLogicColor(val) {
    if (val === 'x' || val === undefined) return '#ef4444'; 
    if (val === 1 || val === '1') return '#10b981'; 
    if (val === 0 || val === '0') return '#3b82f6'; 
    return '#f59e0b'; 
  }
}
