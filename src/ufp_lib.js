"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployScheme = void 0;
var parser_1 = require("./parser");
var compiler_1 = require("./compiler");
var fs_1 = __importDefault(require("fs"));
var types_1 = require("./types");
var exec = require('child_process').exec;
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
function deployScheme(schemaData, path, objectPath, cPath, objectCPath, exePath, bp, schemaId, debug) {
    if (debug === void 0) { debug = false; }
    return __awaiter(this, void 0, void 0, function () {
        var schema, comp, result, outIR, headerPath, headerText, _a, _b, _i, chain, program, chain_code_path;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    schema = (0, parser_1.parseSchema)(schemaData);
                    if (!schema) {
                        console.log("Parsing schema was unsuccessful");
                        return [2 /*return*/];
                    }
                    comp = new compiler_1.Compiler();
                    result = comp.buildSchema(schema);
                    if (!result) {
                        console.log("Building schema was unsuccessful");
                        return [2 /*return*/];
                    }
                    else if (debug) {
                        console.log("Building schema was successful");
                    }
                    outIR = comp.getModuleString();
                    if (outIR == null) {
                        console.log("Generating IR was unsuccessful");
                        return [2 /*return*/];
                    }
                    else if (debug) {
                        console.log("Generating IR was successful");
                    }
                    fs_1.default.writeFile(path, outIR, function (err) {
                        if (err)
                            return console.log(err);
                        //console.log(`${outIR} > ${path}`);
                    });
                    return [4 /*yield*/, exec("clang ".concat(path, " -c -Wno-override-module -o0 -o ").concat(objectPath, " && clang ").concat(bp, "io.c -c -o ").concat(bp, "io.o -o0"), function (err, stdout, stderr) {
                            if (err)
                                return console.log("err", err.toString());
                            if (stdout.length > 0)
                                console.log("out", stdout);
                            if (stderr.length > 0)
                                console.log("err", stderr);
                        })];
                case 1:
                    _c.sent();
                    headerPath = bp + schemaId + '.h';
                    headerText = generateHeaderForSchema(comp.entities, comp.chainsInfo, schemaId);
                    if (headerText) {
                        fs_1.default.writeFile(headerPath, headerText, function (err) {
                            if (err)
                                return console.log(err);
                            //console.log(`${outIR} > ${path}`);
                        });
                    }
                    _a = [];
                    for (_b in comp.chainsInfo)
                        _a.push(_b);
                    _i = 0;
                    _c.label = 2;
                case 2:
                    if (!(_i < _a.length)) return [3 /*break*/, 6];
                    chain = _a[_i];
                    program = generateProgramForChain(comp.chainsInfo[chain], comp.entities, schemaId + '.h');
                    if (!program)
                        return [3 /*break*/, 5];
                    chain_code_path = exePath + '_' + comp.chainsInfo[chain].name;
                    return [4 /*yield*/, fs_1.default.writeFile(chain_code_path + '.c', program, function (err) {
                            if (err)
                                return console.log(err);
                        })];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, exec("clang ".concat(chain_code_path + '.c', " -o0 -g -c -Wno-override-module -o ").concat(chain_code_path + '.o', " && gcc ").concat(chain_code_path + '.o', " ").concat(objectPath, " ").concat(bp, "io.o -g -lm -o ").concat(chain_code_path), function (err, stdout, stderr) {
                            if (err)
                                return console.log("err", err.toString());
                            if (stdout.length > 0)
                                console.log("out", stdout);
                            if (stderr.length > 0)
                                console.log("err", stderr);
                        })];
                case 4:
                    _c.sent();
                    _c.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 2];
                case 6: return [4 /*yield*/, exec("cd ../../ufp_to_LLVM_IR && tsc && cd ../UfpEditor/server && gcc -c ".concat(cPath, " -g -o ").concat(objectCPath, " && gcc ").concat(objectCPath, " ").concat(objectPath, " ").concat(bp, "io.o -lm -g -o ").concat(exePath), function (err, stdout, stderr) {
                        if (err)
                            return console.log("err", err.toString());
                        if (stdout.length > 0)
                            console.log("out", stdout);
                        if (stderr.length > 0)
                            console.log("err", stderr);
                    })];
                case 7:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
exports.deployScheme = deployScheme;
function generateHeaderForSchema(entities, chains, schemaId) {
    schemaId = schemaId.slice(0, 8);
    var result = "#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <math.h>\n#include \"io.h\"\n\n";
    for (var id in entities) {
        var entity = entities[id];
        var fields = "";
        for (var _i = 0, _a = entity.fields; _i < _a.length; _i++) {
            var f = _a[_i];
            var typeStr = (0, types_1.VariableTypeToString)(f.type);
            if (!typeStr)
                throw TypeError("Incorrect field type of ".concat(f.name, " in entity ").concat(entity.name));
            fields += "".concat(typeStr, " ").concat(f.name, "; ");
        }
        var entDeclaration = "typedef struct ".concat(entity.name, " { ").concat(fields, " } ").concat(entity.name, ";\n");
        result += entDeclaration;
    }
    result += '\n\n';
    for (var id in chains) {
        var chainInfo = chains[id];
        var argsLine = "";
        for (var _b = 0, _c = chainInfo.args; _b < _c.length; _b++) {
            var argT = _c[_b];
            var typeStr = (0, types_1.LLVMTypeToString)(argT);
            if (!typeStr)
                throw TypeError("Incorrect argument type ".concat(argT, " in chain ").concat(chainInfo.name));
            argsLine += typeStr + ', ';
        }
        argsLine = argsLine.slice(0, -2);
        var returnTypeStr = chainInfo.returnEntityId ? chainInfo.returnEntityName : (0, types_1.LLVMTypeToString)(chainInfo.returnType);
        var funcDeclaration = "".concat(returnTypeStr, " ").concat(chainInfo.name, "(").concat(argsLine, ");\n");
        result += funcDeclaration;
    }
    result += '\n\n';
    return result;
}
function getPrintCall(type, varName, printedNameStart) {
    if (printedNameStart === void 0) { printedNameStart = 0; }
    if (type === 'int' || type === 'char') {
        return "\tprintf(\"".concat(varName.slice(printedNameStart), ": %d\\n\", ").concat(varName, ");\n");
    }
    else if (type === 'double') {
        return "\tprintf(\"".concat(varName.slice(printedNameStart), ": %lf\\n\", ").concat(varName, ");\n");
    }
    else if (type === 'char*') {
        return "\tprintf(\"".concat(varName.slice(printedNameStart), ": %s\\n\", ").concat(varName, ");\n");
    }
    return "";
}
function printVariable(name, type, entityId, entities, printedNameStart) {
    if (printedNameStart === void 0) { printedNameStart = 0; }
    if (entityId == null) {
        return getPrintCall(type, name, printedNameStart);
    }
    var result = "";
    for (var _i = 0, _a = entities[entityId].fields; _i < _a.length; _i++) {
        var f = _a[_i];
        if (f.name.startsWith("__debug_"))
            continue;
        var fTypeStr = (0, types_1.VariableTypeToString)(f.type);
        if (!fTypeStr)
            return "";
        result += printVariable("".concat(name, ".").concat(f.name), fTypeStr, undefined, entities, name.length + 1);
    }
    return result;
}
function generateProgramForChain(chainInfo, entities, headerName) {
    var result = "#include \"".concat(headerName, "\"\n\n\nint main(int argc, char* argv[]) {\n");
    var readArgs = "";
    for (var i = 0; i < chainInfo.args.length; i++) {
        var argT = chainInfo.args[i];
        var typeStr = (0, types_1.LLVMTypeToString)(argT);
        if (!typeStr)
            return null;
        if (typeStr === 'int') {
            readArgs += "readInteger(argv[".concat(i + 1, "]), ");
        }
        else if (typeStr === 'double') {
            readArgs += "readFractional(argv[".concat(i + 1, "]), ");
        }
        else if (typeStr === 'char') {
            readArgs += "readFlag(argv[".concat(i + 1, "]), ");
        }
        else if (typeStr === 'char*') {
            readArgs += "argv[".concat(i + 1, "], ");
        }
    }
    readArgs = readArgs.slice(0, -2);
    var returnTypeStr = chainInfo.returnEntityId ? chainInfo.returnEntityName : (0, types_1.LLVMTypeToString)(chainInfo.returnType);
    var needPrintResult = returnTypeStr !== null && returnTypeStr !== 'void';
    if (needPrintResult) {
        result += "\t".concat(returnTypeStr, " result = ").concat(chainInfo.name, "(").concat(readArgs, ");\n");
        result += printVariable('result', returnTypeStr, chainInfo.returnEntityId, entities);
    }
    else {
        result += "\t".concat(chainInfo.name, "(").concat(readArgs, ");\n");
    }
    result += "\treturn 0;\n}\n";
    return result;
}
