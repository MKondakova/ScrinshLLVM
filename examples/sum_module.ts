import fs from "fs";
import llvm, {FunctionType} from "llvm-bindings";

function sumModule(): llvm.Module | null {
    const context = new llvm.LLVMContext();
    const module = new llvm.Module('demo', context);
    const builder = new llvm.IRBuilder(context);

    const returnType = builder.getInt32Ty();
    const paramTypes: llvm.Type[] = [builder.getInt32Ty(), builder.getInt32Ty()];
    const functionType = llvm.FunctionType.get(returnType, paramTypes, false);
    const func = llvm.Function.Create(functionType, llvm.Function.LinkageTypes.ExternalLinkage, 'sum', module);

    const entryBB = llvm.BasicBlock.Create(context, 'entry', func);
    builder.SetInsertPoint(entryBB);
    const a = func.getArg(0);
    const b = func.getArg(1);
    const result = builder.CreateAdd(a, b);

    let printFunctionType = FunctionType.get(builder.getInt32Ty(), [builder.getInt8PtrTy()], true);
    let printFunction = module.getOrInsertFunction("printf", printFunctionType);
    builder.CreateCall(printFunction, [builder.CreateGlobalStringPtr("%d\n", "str"), result], "calltmp")
    let argAlloc = builder.CreateAlloca(a.getType(), null, 'temp');
    builder.CreateStore(result, argAlloc);
    builder.CreateRet(builder.CreateLoad(argAlloc.getAllocatedType(), argAlloc));
    if (llvm.verifyFunction(func)) {
        console.error('Verifying function failed');
        return null;
    }

    if (llvm.verifyModule(module)) {
        console.error('Verifying module failed');
        return null;
    }
    return module;
}

function main(){
    const outIR = sumModule()!.print();
    if (outIR == null) {
        console.log("unsuccessful");
        return;
    }
    fs.writeFile("out.ll", outIR, (err: any) => {
        if (err) return console.log(err);
        console.log(`${outIR} > out.ll`);
    });
}

main();