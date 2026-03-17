// A lightweight SystemVerilog parser
export function parseVerilog(code) {
  const ast = { modules: [] };
  
  // Remove block comments /* */ and line comments //
  let cleanCode = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  // Extract Modules
  // Support both module name(ports); and module name;
  const moduleRegex = /module\s+(\w+)\s*(?:#\([\s\S]*?\))?\s*(?:\(([\s\S]*?)\))?\s*;([\s\S]*?)endmodule/g;
  let match;

  while ((match = moduleRegex.exec(cleanCode)) !== null) {
    const name = match[1];
    const portsStr = match[2] || '';
    const bodyStr = match[3] || '';

    const moduleObj = {
      name,
      ports: parsePorts(portsStr, bodyStr),
      instances: parseInstances(bodyStr),
      signals: parseSignals(bodyStr)
    };
    ast.modules.push(moduleObj);
  }

  // Identify top module (usually testbench without inputs)
  ast.top = ast.modules.find(m => m.name === 'tb' || m.ports.length === 0) || ast.modules[0];

  return ast;
}

function parsePorts(portsStr, bodyStr) {
  const ports = [];
  
  // Match ANSI style ports: input [7:0] a, output reg b
  const portItemRegex = /(input|output|inout)\s+(reg|wire)?\s*(\[[^\]]+\])?\s*(\w+)/g;
  let pMatch;
  while ((pMatch = portItemRegex.exec(portsStr)) !== null) {
    ports.push({
      direction: pMatch[1],
      type: pMatch[2] || 'wire',
      width: parseWidth(pMatch[3]),
      name: pMatch[4]
    });
  }

  // Handle Non-ANSI style declared in body
  const bodyPortRegex = /(input|output|inout)\s+(reg|wire)?\s*(\[[^\]]+\])?\s*(\w+)\s*;/g;
  while ((pMatch = bodyPortRegex.exec(bodyStr)) !== null) {
    // If not already in ports, add it (handle non-ansi mapping simply)
    if (!ports.find(p => p.name === pMatch[4])) {
      ports.push({
        direction: pMatch[1],
        type: pMatch[2] || 'wire',
        width: parseWidth(pMatch[3]),
        name: pMatch[4]
      });
    }
  }

  return ports;
}

function parseSignals(bodyStr) {
  const signals = [];
  const sigRegex = /(reg|wire|logic)\s+(\[[^\]]+\])?\s*(\w+)\s*(=\s*[^;]+)?;/g;
  let sMatch;
  while ((sMatch = sigRegex.exec(bodyStr)) !== null) {
    signals.push({
      type: sMatch[1],
      width: parseWidth(sMatch[2]),
      name: sMatch[3]
    });
  }
  return signals;
}

function parseInstances(bodyStr) {
  const instances = [];
  // Basic instance matching: module_name instance_name ( .port(sig), ... );
  const instRegex = /(\w+)\s+(\w+)\s*\(([\s\S]*?)\);/g;
  let iMatch;
  while ((iMatch = instRegex.exec(bodyStr)) !== null) {
    const modType = iMatch[1];
    if (['reg', 'wire', 'logic', 'assign', 'always', 'initial'].includes(modType)) continue;

    const name = iMatch[2];
    const mappingStr = iMatch[3];

    // Simple manual split for mappings
    const mappings = {};
    const mapRegex = /\.\s*(\w+)\s*\(\s*(\w+)\s*\)/g;
    let mMatch;
    while((mMatch = mapRegex.exec(mappingStr)) !== null) {
      mappings[mMatch[1]] = mMatch[2];
    }

    instances.push({ type: modType, name, mappings });
  }
  return instances;
}

function parseWidth(widthStr) {
  if (!widthStr) return 1;
  const match = widthStr.match(/\[(\d+):(\d+)\]/);
  if (match) {
    return Math.abs(parseInt(match[1]) - parseInt(match[2])) + 1;
  }
  return 1;
}
