import {parseSchema} from "./parser";
import {Compiler} from "./compiler";
import fs from "fs";
import {ChainType, Entity, LLVMTypeToString, VariableTypeToString} from "./types";

const {exec} = require('child_process');

/***
 * @param schemaData
 * @param path
 * @param objectPath
 * @param cPath
 * @param objectCPath
 * @param exePath
 * @param bp
 * @param schemaId
 * @param debug
 */
export async function deployScheme(schemaData: string, path: string, objectPath: string | null, cPath: string | null,
                                    objectCPath: string | null, exePath: string | null, bp: string, schemaId: string, debug: boolean = false): Promise<void> {
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
    } else if (debug) {
        console.log("Building schema was successful");
    }
    const outIR = comp.getModuleString();
    if (outIR == null) {
        console.log("Generating IR was unsuccessful");
        return;
    } else if (debug) {
        console.log("Generating IR was successful");
    }
    fs.writeFile(path, outIR, (err: any) => {
        if (err)
            return console.log(err);
        //console.log(`${outIR} > ${path}`);
    });

    await exec(`clang ${path} -c -Wno-override-module -o0 -o ${objectPath} && clang ${bp}io.c -c -o ${bp}io.o -o0`,
        (err: { toString: () => any; }, stdout: any, stderr: any) => {
            if (err) return console.log("err", err.toString());
            if (stdout.length > 0) console.log("out", stdout);
            if (stderr.length > 0) console.log("err", stderr);
        });

    let headerPath = bp + schemaId + '.h';
    let headerText = generateHeaderForSchema(comp.entities, comp.chainsInfo, schemaId);
    if (headerText) {
        fs.writeFile(headerPath, headerText, (err: any) => {
            if (err)
                return console.log(err);
            //console.log(`${outIR} > ${path}`);
        });
    }

    for (let chain in comp.chainsInfo) {
        let program = generateProgramForChain(comp.chainsInfo[chain], comp.entities, schemaId + '.h');
        if (!program) continue;
        let chain_code_path = exePath + '_' + comp.chainsInfo[chain].name;
        await fs.writeFile(chain_code_path + '.c', program, (err: any) => {
            if (err) return console.log(err);
        });
        await exec(`clang ${chain_code_path + '.c'} -o0 -g -c -Wno-override-module -o ${chain_code_path + '.o'} && gcc ${chain_code_path + '.o'} ${objectPath} ${bp}io.o -g -lm -o ${chain_code_path}`,
            (err: { toString: () => any; }, stdout: any, stderr: any) => {
                if (err) return console.log("err", err.toString());
                if (stdout.length > 0) console.log("out", stdout);
                if (stderr.length > 0) console.log("err", stderr);
            });
    }

    await exec(`gcc -c ${cPath} -g -o ${objectCPath} && gcc ${objectCPath} ${objectPath} ${bp}io.o -lm -g -o ${exePath}`,
        (err: { toString: () => any; }, stdout: any, stderr: any) => {
            if (err) return console.log("err", err.toString());
            if (stdout.length > 0) console.log("out", stdout);
            if (stderr.length > 0) console.log("err", stderr);
        });

}

function generateHeaderForSchema(entities: Record<string, Entity>, chains: Record<string, ChainType>, schemaId: string): string {
    schemaId = schemaId.slice(0, 8);
    let result = `#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <math.h>\n#include "io.h"\n\n`;
    for (let id in entities) {
        let entity = entities[id];
        let fields = "";
        for (let f of entity.fields) {
            let typeStr = VariableTypeToString(f.type);
            if (!typeStr) throw TypeError(`Incorrect field type of ${f.name} in entity ${entity.name}`);
            fields += `${typeStr} ${f.name}; `
        }
        let entDeclaration = `typedef struct ${entity.name} { ${fields} } ${entity.name};\n`;
        result += entDeclaration;
    }
    result += '\n\n';
    for (let id in chains) {
        let chainInfo = chains[id];
        let argsLine = "";
        for (let argT of chainInfo.args) {
            let typeStr = LLVMTypeToString(argT);
            if (!typeStr) throw TypeError(`Incorrect argument type ${argT} in chain ${chainInfo.name}`);
            argsLine += typeStr + ', '
        }
        argsLine = argsLine.slice(0, -2);
        let returnTypeStr = chainInfo.returnEntityId ? chainInfo.returnEntityName! : LLVMTypeToString(chainInfo.returnType);
        let funcDeclaration = `${returnTypeStr} ${chainInfo.name}(${argsLine});\n`;
        result += funcDeclaration;
    }
    result += '\n\n';
    return result;
}

function getPrintCall(type: string, varName: string, printedNameStart: number = 0): string {
    if (type === 'int' || type === 'char') {
        return `\tprintf("${varName.slice(printedNameStart)}: %d\\n", ${varName});\n`;
    } else if (type === 'double') {
        return `\tprintf("${varName.slice(printedNameStart)}: %lf\\n", ${varName});\n`;
    } else if (type === 'char*') {
        return `\tprintf("${varName.slice(printedNameStart)}: %s\\n", ${varName});\n`;
    }
    return "";
}

function printVariable(name: string, type: string, entityId: string | undefined, entities: Record<string, Entity>, printedNameStart: number = 0): string {
    if (entityId == null) {
        return getPrintCall(type!, name, printedNameStart);
    }
    let result = "";
    for (let f of entities[entityId].fields) {
        if (f.name.startsWith("__debug_")) continue;
        let fTypeStr = VariableTypeToString(f.type);
        if (!fTypeStr) return "";
        result += printVariable(`${name}.${f.name}`, fTypeStr, undefined, entities, name.length + 1)
    }
    return result;
}

function generateProgramForChain(chainInfo: ChainType, entities: Record<string, Entity>, headerName: string): string | null {
    let result = `#include \"${headerName}\"\n\n\nint main(int argc, char* argv[]) {\n`;

    let readArgs = "";
    for (let i = 0; i < chainInfo.args.length; i++) {
        let argT = chainInfo.args[i];
        let typeStr = LLVMTypeToString(argT);
        if (!typeStr) return null;
        if (typeStr === 'int') {
            readArgs += `readInteger(argv[${i + 1}]), `
        } else if (typeStr === 'double') {
            readArgs += `readFractional(argv[${i + 1}]), `
        } else if (typeStr === 'char') {
            readArgs += `readFlag(argv[${i + 1}]), `
        } else if (typeStr === 'char*') {
            readArgs += `argv[${i + 1}], `
        }
    }
    readArgs = readArgs.slice(0, -2);
    let returnTypeStr = chainInfo.returnEntityId ? chainInfo.returnEntityName! : LLVMTypeToString(chainInfo.returnType);
    let needPrintResult = returnTypeStr !== null && returnTypeStr !== 'void';
    if (needPrintResult) {
        result += `\t${returnTypeStr} result = ${chainInfo.name}(${readArgs});\n`
        result += printVariable('result', returnTypeStr!, chainInfo.returnEntityId, entities);
    } else {
        result += `\t${chainInfo.name}(${readArgs});\n`
    }
    result += "\treturn 0;\n}\n";
    return result
}