import llvm from "llvm-bindings";
import {VariablesTypes} from "./types";

export let functionsList: { [name: string]: (builder: llvm.IRBuilder, args: llvm.Type[] | undefined) => llvm.FunctionType} = {
    'sqrt': (builder) => llvm.FunctionType.get(builder.getDoubleTy(), [builder.getDoubleTy()], false),
    'printf': (builder, args) => llvm.FunctionType.get(builder.getVoidTy(), args!, true),
    'printInteger': (builder) => llvm.FunctionType.get(builder.getVoidTy(), [builder.getInt32Ty()], false),
    'printFractional': (builder) => llvm.FunctionType.get(builder.getVoidTy(), [builder.getDoubleTy()], false),
    'printFlag': (builder) => llvm.FunctionType.get(builder.getVoidTy(), [builder.getInt1Ty()], false),
    'readInteger': (builder) => llvm.FunctionType.get(builder.getInt32Ty(), [builder.getInt8PtrTy()], false),
    'readFractional': (builder) => llvm.FunctionType.get(builder.getDoubleTy(), [builder.getInt8PtrTy()], false),
    'readFlag': (builder) => llvm.FunctionType.get(builder.getInt1Ty(), [builder.getInt8PtrTy()], false),
    'hypot': (builder) => llvm.FunctionType.get(builder.getDoubleTy(), [builder.getDoubleTy(), builder.getDoubleTy()], false),
}

export let SystemFunctions: { [name: string]: { 'arguments': Array<VariablesTypes>, 'returned': VariablesTypes | null, 'isVarArg': boolean } } = {
    'sqrt': { 'arguments': [VariablesTypes.FRACTIONAL], 'returned': VariablesTypes.FRACTIONAL, 'isVarArg': false },
    'printf': { 'arguments': [VariablesTypes.STRING], 'returned': null, 'isVarArg': true },
    'hypot': { 'arguments': [VariablesTypes.FRACTIONAL, VariablesTypes.FRACTIONAL], 'returned': VariablesTypes.FRACTIONAL, 'isVarArg': false },
}