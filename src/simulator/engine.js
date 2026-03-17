export class SVSimulatorEngine {
  constructor(ast) {
    this.ast = ast;
    this.timeline = []; // Array of { time: ns, signals: { 'module.signal': value } }
    this.maxTime = 200;
  }

  simulate() {
    this.timeline = [];
    if (!this.ast || !this.ast.top) return [];
    
    // Dynamically initialize state based on TB signals and ports
    let currentState = {};
    const top = this.ast.top;
    
    // Initialize TB signals (defaults)
    top.signals.forEach(sig => {
        currentState[`${top.name}.${sig.name}`] = 0;
    });

    // Initialize module instances
    top.instances.forEach(inst => {
      const modDef = this.ast.modules.find(m => m.name === inst.type);
      if (modDef) {
        modDef.ports.forEach(p => currentState[`${top.name}.${inst.name}.${p.name}`] = 0);
        modDef.signals.forEach(s => currentState[`${top.name}.${inst.name}.${s.name}`] = 0);
      }
    });

    // Hardcode initial Testbench state injections for demo purposes
    // (A full simulator would evaluate 'initial' blocks properly here)
    currentState['tb.clk'] = 0;
    currentState['tb.reset'] = 1;
    currentState['tb.a'] = 5;
    currentState['tb.b'] = 2;
    
    this.recordState(0, currentState);

    let nextState = { ...currentState };

    for (let t = 1; t <= this.maxTime; t++) {
      let changed = false;

      // TB Stimulus (Hardcoded time steps for now, but dynamic logic payload)
      if (t === 10) { nextState['tb.reset'] = 0; changed = true; }
      if (t === 30) { nextState['tb.a'] = 10; nextState['tb.b'] = 3; changed = true; }
      if (t === 60) { nextState['tb.a'] = 15; nextState['tb.b'] = 5; changed = true; }

      // Clock driver
      if (t % 5 === 0) {
        nextState['tb.clk'] = nextState['tb.clk'] === 0 ? 1 : 0;
        changed = true;
      }

      if (changed) {
        // Evaluate Continuous Assignments & Always Blocks for all instances
        top.instances.forEach(inst => {
            const modDef = this.ast.modules.find(m => m.name === inst.type);
            if (!modDef) return;

            // Resolve inputs from TB bindings
            Object.keys(inst.mappings).forEach(portName => {
                const tbSig = inst.mappings[portName];
                const tbPath = `${top.name}.${tbSig}`;
                const portPath = `${top.name}.${inst.name}.${portName}`;
                nextState[portPath] = nextState[tbPath];
            });

            // Execute Blocks 
            // Triggered on posedge clk 
            if (nextState['tb.clk'] === 1 && currentState['tb.clk'] === 0) {
              if (modDef.blocks) {
                modDef.blocks.forEach(block => {
                   if (block.type === 'always' || block.type === 'assign') {
                       // Evaluate statements
                       block.statements?.forEach(stmt => {
                           if (stmt.expression && stmt.expression.type === 'binary') {
                               const leftPath = `${top.name}.${inst.name}.${stmt.expression.left}`;
                               const rightPath = `${top.name}.${inst.name}.${stmt.expression.right}`;
                               
                               const leftVal = nextState[leftPath] !== undefined ? nextState[leftPath] : parseInt(stmt.expression.left) || 0;
                               const rightVal = nextState[rightPath] !== undefined ? nextState[rightPath] : parseInt(stmt.expression.right) || 0;
                               
                               let result = 0;
                               switch (stmt.expression.op) {
                                   case '+': result = leftVal + rightVal; break;
                                   case '-': result = leftVal - rightVal; break;
                                   case '*': result = leftVal * rightVal; break;
                                   case '&': result = leftVal & rightVal; break;
                                   case '|': result = leftVal | rightVal; break;
                                   default: result = leftVal;
                               }
                               
                               // Keep simple bounds check
                               result = result & 0xFFFF; // 16-bit max cap
                               
                               const targetPath = `${top.name}.${inst.name}.${stmt.target}`;
                               nextState[targetPath] = result;
                           }
                       });

                       // Continuous assigns (no statements array, just expression)
                       if (block.type === 'assign' && block.expression && block.expression.type === 'binary') {
                           const leftPath = `${top.name}.${inst.name}.${block.expression.left}`;
                           const rightPath = `${top.name}.${inst.name}.${block.expression.right}`;
                           
                           const leftVal = nextState[leftPath] !== undefined ? nextState[leftPath] : parseInt(block.expression.left) || 0;
                           const rightVal = nextState[rightPath] !== undefined ? nextState[rightPath] : parseInt(block.expression.right) || 0;
                           
                           let result = 0;
                           switch (block.expression.op) {
                               case '+': result = leftVal + rightVal; break;
                               case '-': result = leftVal - rightVal; break;
                               case '*': result = leftVal * rightVal; break;
                               case '&': result = leftVal & rightVal; break;
                               case '|': result = leftVal | rightVal; break;
                               default: result = leftVal;
                           }
                           
                           result = result & 0xFFFF;
                           const targetPath = `${top.name}.${inst.name}.${block.target}`;
                           nextState[targetPath] = result;
                       }
                   }
                });
              }
            }

            // Propagate outputs back to TB
            modDef.ports.filter(p => p.direction === 'output').forEach(port => {
                const tbSig = inst.mappings[port.name];
                if (tbSig) {
                    const tbPath = `${top.name}.${tbSig}`;
                    const portPath = `${top.name}.${inst.name}.${port.name}`;
                    nextState[tbPath] = nextState[portPath];
                }
            });
        });

        this.recordState(t, nextState);
        currentState = { ...nextState }; // Commit state
      }
    }

    return this.timeline;
  }

  recordState(time, state) {
    this.timeline.push({
      time: time,
      state: { ...state }
    });
  }
}
