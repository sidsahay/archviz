import Split from 'split.js';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

import { parseVerilog } from './simulator/parser.js';
import { SVSimulatorEngine } from './simulator/engine.js';
import { SVVisualizer } from './simulator/visualizer.js';
import { SVScrubber } from './simulator/scrubber.js';

// Configure Monaco Workers for Vite
self.MonacoEnvironment = {
  getWorker(_, label) {
    return new editorWorker();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Layout
  Split(['#pane-editor', '#pane-visualizer'], {
    sizes: [40, 60],
    minSize: [300, 400],
    gutterSize: 6,
    cursor: 'col-resize'
  });

  Split(['#pane-canvas', '#pane-timeline'], {
    direction: 'vertical',
    sizes: [70, 30],
    minSize: [200, 100],
    gutterSize: 6,
    cursor: 'row-resize'
  });

  // Editor setup...
  const editorContainer = document.getElementById('editor-container');
  const editor = monaco.editor.create(editorContainer, {
    value: `// Example SystemVerilog Testbench
module tb;
    reg clk;
    reg reset;
    reg [7:0] a;
    reg [7:0] b;
    wire [7:0] sum;
    wire [7:0] diff;
    wire [15:0] prod;

    adder_mod add_uut (
        .clk(clk),
        .a(a),
        .b(b),
        .out(sum)
    );

    sub_mod sub_uut (
        .clk(clk),
        .a(a),
        .b(b),
        .out(diff)
    );

    mult_mod mult_uut (
        .clk(clk),
        .a(a),
        .b(b),
        .out(prod)
    );

    initial begin
        $dumpfile("sim.vcd");
        $dumpvars(0, tb);
        clk = 0;
        reset = 1;
        a = 8'h05;
        b = 8'h02;
        
        #10 reset = 0;
        #20 a = 8'h0A; b = 8'h03; // sum=D, diff=7, prod=1E
        #30 a = 8'h0F; b = 8'h05; // sum=14, diff=A, prod=4B
        #200 $finish;
    end

    always #5 clk = ~clk;
endmodule

module adder_mod(input clk, input [7:0] a, input [7:0] b, output reg [7:0] out);
    always @(posedge clk) begin
        out <= a + b;
    end
endmodule

module sub_mod(input clk, input [7:0] a, input [7:0] b, output reg [7:0] out);
    always @(posedge clk) begin
        out <= a - b;
    end
endmodule

module mult_mod(input clk, input [7:0] a, input [7:0] b, output reg [15:0] out);
    always @(posedge clk) begin
        out <= a * b;
    end
endmodule
`,
    language: 'verilog',
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    lineHeight: 24,
    padding: { top: 16 }
  });

  // UI Components
  const canvas = document.getElementById('visualizer-canvas');
  const visualizer = new SVVisualizer(canvas);
  
  const scrubberInput = document.getElementById('time-scrubber');
  const timeDisplay = document.getElementById('current-time-display');
  const signalsView = document.getElementById('signals-view');
  
  const scrubber = new SVScrubber(scrubberInput, timeDisplay, signalsView);

  // Connection
  scrubber.onTimeChange = (t) => {
    visualizer.setCurrentTime(t);
  };

  // Simulate Button Event
  const simulateBtn = document.getElementById('btn-simulate');
  simulateBtn.addEventListener('click', () => {
    try {
      const code = editor.getValue();
      console.log("Parsing Verilog...");
      const ast = parseVerilog(code);
      console.log("AST:", ast);
      
      const engine = new SVSimulatorEngine(ast);
      const timeline = engine.simulate(200);
      
      console.log("Timeline generated. Max t =", timeline.length > 0 ? timeline[timeline.length - 1].time : 0);
      
      scrubber.loadTimeline(timeline);
      visualizer.updateData(ast, timeline);
      
      // Auto-scrub to t=0
      scrubber.input.value = 0;
      scrubber.updateDisplay(0);
      visualizer.setCurrentTime(0);
      
    } catch(err) {
      console.error("Simulation error:", err);
      alert("Error parsing or simulating code: " + err.message);
    }
  });

  // Example resize handle to fix canvas resolution
  const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      // Small delay prevents flickering
      setTimeout(() => visualizer.resize(), 10);
    }
  });
  resizeObserver.observe(canvas.parentElement);
});
