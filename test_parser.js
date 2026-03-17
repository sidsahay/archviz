import { parseVerilog } from './src/simulator/parser.js';

const code = `// Example SystemVerilog Testbench
module tb;
    reg clk;
    reg reset;
    wire [7:0] counter;

    counter_mod uut (
        .clk(clk),
        .reset(reset),
        .out(counter)
    );

    initial begin
        $dumpfile("sim.vcd");
        $dumpvars(0, tb);
        clk = 0;
        reset = 1;
        #10 reset = 0;
        #200 $finish;
    end

    always #5 clk = ~clk;
endmodule

module counter_mod(input clk, input reset, output reg [7:0] out);
    always @(posedge clk or posedge reset) begin
        if (reset) out <= 8'h00;
        else out <= out + 1;
    end
endmodule
`;

const ast = parseVerilog(code);
console.log(JSON.stringify(ast, null, 2));
