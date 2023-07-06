"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var parser_1 = require("./parser");
var compiler_1 = require("./compiler");
var fs_1 = __importDefault(require("fs"));
function main() {
    var args = process.argv.slice(2);
    var schemaPath = args[args.length - 1];
    var schemaData = fs_1.default.readFileSync(schemaPath, { encoding: 'utf8' });
    var schema = (0, parser_1.parseSchema)(schemaData);
    if (!schema) {
        console.log("Parsing schema was unsuccessful");
        return;
    }
    var comp = new compiler_1.Compiler();
    var result = comp.buildSchema(schema);
    if (!result) {
        console.log("Building schema was unsuccessful");
        return;
    }
    var outIR = comp.getModuleString();
    if (outIR == null) {
        console.log("Generating IR was unsuccessful");
        return;
    }
    fs_1.default.writeFile("examples/out.ll", outIR, function (err) {
        if (err)
            return console.log(err);
        //console.log(`${outIR} > examples/out.ll`);
    });
}
main();
