"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASTTypes = exports.VariablesTypes = exports.LLVMTypeToString = exports.VariableTypeToString = exports.VariableTypeToLLVM = void 0;
var llvm_bindings_1 = __importDefault(require("llvm-bindings"));
function VariableTypeToLLVM(i, builder) {
    switch (i) {
        case VariablesTypes.BOOLEAN:
        case ASTTypes.BOOLEAN_TYPE:
            return builder.getInt1Ty(); //todo deal with bool
        case VariablesTypes.INTEGER:
        case ASTTypes.INTEGER_TYPE:
            return builder.getInt32Ty();
        case VariablesTypes.FRACTIONAL:
        case ASTTypes.FRACTIONAL_TYPE:
            return builder.getDoubleTy();
        case VariablesTypes.STRING:
            return builder.getInt8PtrTy();
    }
    return null;
}
exports.VariableTypeToLLVM = VariableTypeToLLVM;
function VariableTypeToString(i) {
    switch (i) {
        case VariablesTypes.BOOLEAN:
        case ASTTypes.BOOLEAN_TYPE:
        case VariablesTypes.INTEGER:
        case ASTTypes.INTEGER_TYPE:
            return 'int';
        case VariablesTypes.FRACTIONAL:
        case ASTTypes.FRACTIONAL_TYPE:
            return 'double';
        case VariablesTypes.STRING:
            return 'char*';
    }
    return null;
}
exports.VariableTypeToString = VariableTypeToString;
function LLVMTypeToString(t) {
    switch (t.getTypeID()) {
        case llvm_bindings_1.default.Type.TypeID.DoubleTyID:
            return 'double';
        case llvm_bindings_1.default.Type.TypeID.VoidTyID:
            return 'void';
        case llvm_bindings_1.default.Type.TypeID.PointerTyID:
            var elemType = LLVMTypeToString(t.getPointerElementType());
            return elemType ? elemType + '*' : null;
        case llvm_bindings_1.default.Type.TypeID.IntegerTyID:
            if (t.isIntegerTy(1)) {
                return 'bool';
            }
            else if (t.isIntegerTy(32)) {
                return 'int';
            }
            else if (t.isIntegerTy(8)) {
                return 'char';
            }
            break;
    }
    return null;
}
exports.LLVMTypeToString = LLVMTypeToString;
var VariablesTypes;
(function (VariablesTypes) {
    VariablesTypes["BOOLEAN"] = "bool";
    VariablesTypes["STRING"] = "str";
    VariablesTypes["INTEGER"] = "integer";
    VariablesTypes["FRACTIONAL"] = "fractional";
    VariablesTypes["STRUCT_LINK"] = "jsonobject";
})(VariablesTypes = exports.VariablesTypes || (exports.VariablesTypes = {}));
var ASTTypes;
(function (ASTTypes) {
    ASTTypes["IDENT"] = "identifier";
    ASTTypes["INTEGER"] = "decimal number";
    ASTTypes["FRACTIONAL"] = "float number";
    ASTTypes["TRUE"] = "boolean true";
    ASTTypes["FALSE"] = "boolean false";
    ASTTypes["STRING"] = "quoted string";
    ASTTypes["COND_EXPR"] = "COND_EXPR";
    ASTTypes["COND_TERM"] = "COND_TERM";
    ASTTypes["COND_FACT"] = "COND_FACT";
    ASTTypes["COND_EXPR_FACT"] = "COND_EXPR_FACT";
    ASTTypes["EXPR"] = "EXPR";
    ASTTypes["TERM"] = "TERM";
    ASTTypes["FACT"] = "FACT";
    ASTTypes["ADD"] = "+";
    ASTTypes["SUB"] = "-";
    ASTTypes["MUL"] = "*";
    ASTTypes["DIV"] = "/";
    ASTTypes["AND"] = "and";
    ASTTypes["OR"] = "or";
    ASTTypes["LESS"] = "<";
    ASTTypes["GRATER"] = ">";
    ASTTypes["EQ"] = "=";
    ASTTypes["GEQ"] = ">=";
    ASTTypes["LEQ"] = "<=";
    ASTTypes["NEQ"] = "!=";
    ASTTypes["LIST_CONSTRUCTION"] = "LIST_CONSTRUCTION";
    ASTTypes["LIST_EXPR"] = "LIST_EXPR";
    ASTTypes["INTEGER_TYPE"] = "integer number type";
    ASTTypes["FRACTIONAL_TYPE"] = "fractional numer type";
    ASTTypes["BOOLEAN_TYPE"] = "boolean";
    ASTTypes["CALL"] = "METHOD";
    ASTTypes["ARGUMENTS"] = "ARGUMENTS";
    ASTTypes["COMMA"] = ",";
    ASTTypes["ENTITY_CONSTRUCTION"] = "ENTITY_CONSTRUCTION";
    ASTTypes["ENTITY"] = "ENTITY";
    ASTTypes["DOT"] = ".";
})(ASTTypes = exports.ASTTypes || (exports.ASTTypes = {}));
