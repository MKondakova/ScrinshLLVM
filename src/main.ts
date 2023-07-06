import {parseSchema} from "./parser";
import {Compiler} from "./compiler";
import fs from "fs";


function main(): void {
    let args = process.argv.slice(2);

    const schemaPath = args[args.length - 1];
    const schemaData = fs.readFileSync(schemaPath, {encoding: 'utf8'});

    const schema = parseSchema(schemaData);
    if (!schema) {
        console.log("Parsing schema was unsuccessful");
        return;
    }
    let comp = new Compiler();
    let result = comp.buildSchema(schema);
    if (!result) {
        console.log("Building schema was unsuccessful");
        return;
    }
    const outIR = comp.getModuleString();
    if (outIR == null) {
        console.log("Generating IR was unsuccessful");
        return;
    }
    fs.writeFile("examples/out.ll", outIR, (err: any) => {
        if (err) return console.log(err);
        //console.log(`${outIR} > examples/out.ll`);
    });
}

main();
