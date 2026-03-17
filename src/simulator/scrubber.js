export class SVScrubber {
  constructor(inputElement, displayElement, signalsViewElement) {
    this.input = inputElement;
    this.display = displayElement;
    this.signalsView = signalsViewElement;
    this.timeline = [];
    
    this.onTimeChange = null;

    this.input.addEventListener('input', (e) => {
      const t = parseInt(e.target.value);
      this.updateDisplay(t);
      if (this.onTimeChange) this.onTimeChange(t);
    });
  }

  loadTimeline(timeline) {
    this.timeline = timeline;
    if (timeline.length === 0) {
      this.input.max = 0;
      this.input.value = 0;
      this.updateDisplay(0);
      return;
    }

    const maxT = timeline[timeline.length - 1].time;
    this.input.max = maxT;
    this.input.value = 0;
    this.updateDisplay(0);
  }

  updateDisplay(t) {
    this.display.innerText = `${t}ns`;
    
    // Find state at t
    if (this.timeline.length === 0) return;
    
    let frame = this.timeline[0];
    for (let i = 0; i < this.timeline.length; i++) {
        if (this.timeline[i].time <= t) {
            frame = this.timeline[i];
        } else {
            break;
        }
    }

    // Render signals view
    let html = '<div style="margin-bottom: 10px; color: var(--accent);">Time: ' + t + 'ns</div>';
    
    const state = frame.state;
    for (const [key, val] of Object.entries(state)) {
      const color = this.getColor(val);
      const valStr = this.formatVal(val);
      html += `<div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--border-color);">
        <span>${key}</span>
        <span style="color: ${color}; font-weight: bold;">${valStr}</span>
      </div>`;
    }
    
    this.signalsView.innerHTML = html;
  }

  formatVal(val) {
    if (val === 'x') return 'x';
    if (val === 0 || val === 1) return val.toString();
    return "8'h" + val.toString(16).padStart(2, '0').toUpperCase();
  }

  getColor(val) {
    if (val === 'x') return '#ef4444';
    if (val === 1) return '#10b981';
    if (val === 0) return '#3b82f6';
    return '#f59e0b';
  }
}
