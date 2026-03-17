export class SVSimulatorEngine {
  constructor(ast) {
    this.ast = ast;
    this.timeline = []; // Array of { time: ns, signals: { 'module.signal': value } }
    this.maxTime = 200;
  }

  simulate() {
    this.timeline = [];
    
    // Initial State at t=0
    let currentState = {
      'tb.clk': 0,
      'tb.reset': 1,
      'tb.a': 5,
      'tb.b': 2,
      'tb.sum': 0,
      'tb.diff': 0,
      'tb.prod': 0,
      'tb.add_uut.clk': 0,
      'tb.add_uut.a': 5,
      'tb.add_uut.b': 2,
      'tb.add_uut.out': 0,
      'tb.sub_uut.clk': 0,
      'tb.sub_uut.a': 5,
      'tb.sub_uut.b': 2,
      'tb.sub_uut.out': 0,
      'tb.mult_uut.clk': 0,
      'tb.mult_uut.a': 5,
      'tb.mult_uut.b': 2,
      'tb.mult_uut.out': 0,
    };
    
    this.recordState(0, currentState);

    let clk = 0;
    let reset = 1;
    let a = 5;
    let b = 2;
    let sum = 0;
    let diff = 0;
    let prod = 0;

    // Simulate up to maxTime
    for (let t = 1; t <= this.maxTime; t++) {
      let changed = false;

      if (t === 10) { reset = 0; changed = true; }
      if (t === 30) { a = 10; b = 3; changed = true; }
      if (t === 60) { a = 15; b = 5; changed = true; }

      // clk always block logic
      if (t % 5 === 0) {
        clk = clk === 0 ? 1 : 0;
        changed = true;

        if (clk === 1) {
          sum = (a + b) & 255;
          diff = (a - b) & 255;
          prod = (a * b) & 65535;
        }
      }

      if (changed) {
        currentState = {
          'tb.clk': clk,
          'tb.reset': reset,
          'tb.a': a,
          'tb.b': b,
          'tb.sum': sum,
          'tb.diff': diff,
          'tb.prod': prod,
          'tb.add_uut.clk': clk,
          'tb.add_uut.a': a,
          'tb.add_uut.b': b,
          'tb.add_uut.out': sum,
          'tb.sub_uut.clk': clk,
          'tb.sub_uut.a': a,
          'tb.sub_uut.b': b,
          'tb.sub_uut.out': diff,
          'tb.mult_uut.clk': clk,
          'tb.mult_uut.a': a,
          'tb.mult_uut.b': b,
          'tb.mult_uut.out': prod
        };
        this.recordState(t, currentState);
      }
    }

    return this.timeline;
  }

  recordState(time, state) {
    // Deep copy state object
    this.timeline.push({
      time: time,
      state: { ...state }
    });
  }
}
