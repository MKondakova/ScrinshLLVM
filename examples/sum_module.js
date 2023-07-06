"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = __importDefault(require("fs"));
var llvm_bindings_1 = __importStar(require("llvm-bindings"));
function sumModule() {
    var context = new llvm_bindings_1.default.LLVMContext();
    var module = new llvm_bindings_1.default.Module('demo', context);
    var builder = new llvm_bindings_1.default.IRBuilder(context);
    var returnType = builder.getInt32Ty();
    var paramTypes = [builder.getInt32Ty(), builder.getInt32Ty()];
    var functionType = llvm_bindings_1.default.FunctionType.get(returnType, paramTypes, false);
    var func = llvm_bindings_1.default.Function.Create(functionType, llvm_bindings_1.default.Function.LinkageTypes.ExternalLinkage, 'sum', module);
    var entryBB = llvm_bindings_1.default.BasicBlock.Create(context, 'entry', func);
    builder.SetInsertPoint(entryBB);
    var a = func.getArg(0);
    var b = func.getArg(1);
    var result = builder.CreateAdd(a, b);
    /*
    vector<Type *> printfArgsTypes({Type::getInt8PtrTy(context)});
    FunctionType *printfType = FunctionType::get(intType, printfArgsTypes, true);
    Constant *printfFunc = module->getOrInsertFunction("printf", printfType);
    * */
    var printFunctionType = llvm_bindings_1.FunctionType.get(builder.getInt32Ty(), [builder.getInt8PtrTy()], true);
    var printFunction = module.getOrInsertFunction("printf", printFunctionType);
    builder.CreateCall(printFunction, [builder.CreateGlobalStringPtr("%d\n", "str"), result], "calltmp");
    var argAlloc = builder.CreateAlloca(a.getType(), null, 'temp');
    builder.CreateStore(result, argAlloc);
    builder.CreateRet(builder.CreateLoad(argAlloc.getAllocatedType(), argAlloc));
    if (llvm_bindings_1.default.verifyFunction(func)) {
        console.error('Verifying function failed');
        return null;
    }
    if (llvm_bindings_1.default.verifyModule(module)) {
        console.error('Verifying module failed');
        return null;
    }
    return module;
}
function main() {
    var outIR = sumModule().print();
    if (outIR == null) {
        console.log("unsuccessful");
        return;
    }
    fs_1.default.writeFile("out.ll", outIR, function (err) {
        if (err)
            return console.log(err);
        console.log("".concat(outIR, " > out.ll"));
    });
}
main();
