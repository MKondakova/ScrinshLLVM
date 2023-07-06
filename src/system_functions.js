"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemFunctions = exports.functionsList = void 0;
var llvm_bindings_1 = __importDefault(require("llvm-bindings"));
var types_1 = require("./types");
exports.functionsList = {
    'sqrt': function (builder) { return llvm_bindings_1.default.FunctionType.get(builder.getDoubleTy(), [builder.getDoubleTy()], false); },
    'printf': function (builder, args) { return llvm_bindings_1.default.FunctionType.get(builder.getVoidTy(), args, true); },
    'printInteger': function (builder) { return llvm_bindings_1.default.FunctionType.get(builder.getVoidTy(), [builder.getInt32Ty()], false); },
    'printFractional': function (builder) { return llvm_bindings_1.default.FunctionType.get(builder.getVoidTy(), [builder.getDoubleTy()], false); },
    'printFlag': function (builder) { return llvm_bindings_1.default.FunctionType.get(builder.getVoidTy(), [builder.getInt1Ty()], false); },
    'readInteger': function (builder) { return llvm_bindings_1.default.FunctionType.get(builder.getInt32Ty(), [builder.getInt8PtrTy()], false); },
    'readFractional': function (builder) { return llvm_bindings_1.default.FunctionType.get(builder.getDoubleTy(), [builder.getInt8PtrTy()], false); },
    'readFlag': function (builder) { return llvm_bindings_1.default.FunctionType.get(builder.getInt1Ty(), [builder.getInt8PtrTy()], false); },
    'hypot': function (builder) { return llvm_bindings_1.default.FunctionType.get(builder.getDoubleTy(), [builder.getDoubleTy(), builder.getDoubleTy()], false); },
};
exports.SystemFunctions = {
    'sqrt': { 'arguments': [types_1.VariablesTypes.FRACTIONAL], 'returned': types_1.VariablesTypes.FRACTIONAL, 'isVarArg': false },
    'printf': { 'arguments': [types_1.VariablesTypes.STRING], 'returned': null, 'isVarArg': true },
    'hypot': { 'arguments': [types_1.VariablesTypes.FRACTIONAL, types_1.VariablesTypes.FRACTIONAL], 'returned': types_1.VariablesTypes.FRACTIONAL, 'isVarArg': false },
};
