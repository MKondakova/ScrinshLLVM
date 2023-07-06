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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Compiler = void 0;
var llvm_bindings_1 = __importStar(require("llvm-bindings"));
var types_1 = require("./types");
var system_functions_1 = require("./system_functions");
var uuid_1 = require("uuid");
var Compiler = /** @class */ (function () {
    function Compiler() {
        this.context = new llvm_bindings_1.default.LLVMContext();
        this.module = new llvm_bindings_1.default.Module('initial module', this.context);
        this.builder = new llvm_bindings_1.default.IRBuilder(this.context);
        this.entitiesTypes = {};
        this.entityIdByName = {};
        this.entities = {};
        this.chainsInfo = {};
    }
    Compiler.prototype.getModuleString = function () {
        if (llvm_bindings_1.default.verifyModule(this.module)) {
            console.error('Verifying module failed');
            return null;
        }
        return this.module.print();
    };
    Compiler.prototype.isListConstructor = function (tree) {
        return tree.type === types_1.ASTTypes.COND_EXPR && tree.children[0].type === types_1.ASTTypes.LIST_CONSTRUCTION;
    };
    Compiler.prototype.isEntityConstructor = function (tree) {
        return tree.type === types_1.ASTTypes.COND_EXPR && tree.children[0].type === types_1.ASTTypes.ENTITY_CONSTRUCTION;
    };
    Compiler.prototype.getListNameAndIndexFromTree = function (node, right, context) {
        var listNode = this.goDownASTUntil(node, function (n) { return n.type === types_1.ASTTypes.LIST_EXPR; });
        if (!listNode)
            return null;
        var identNode = listNode.children[0];
        var index = this.getValueFromNode(listNode.children[2], right, context);
        var listName = right.slice(identNode.from, identNode.to);
        return [listName, index];
    };
    Compiler.prototype.goDownASTUntil = function (node, condition) {
        if (!node)
            return null;
        if (!condition(node)) {
            if (node.children.length > 0) {
                return this.goDownASTUntil(node.children[0], condition);
            }
            else {
                return null;
            }
        }
        return node;
    };
    Compiler.prototype.getEntityRequestedFields = function (node, right) {
        var entityNode = this.goDownASTUntil(node, function (n) { return n.type === types_1.ASTTypes.ENTITY; });
        if (!entityNode)
            return null;
        var result = [];
        var i = 0;
        do {
            if (entityNode.children[i].type === types_1.ASTTypes.DOT)
                i++;
            var fieldNameNode = entityNode.children[i];
            var fieldName = right.slice(fieldNameNode.from, fieldNameNode.to);
            result.push(fieldName);
            i++;
        } while (i < entityNode.children.length && entityNode.children[i].type === types_1.ASTTypes.DOT);
        return result;
    };
    Compiler.prototype.initEntityFields = function (node, right, entityPointer, context) {
        var i = 0;
        while (i < node.children.length) {
            var fieldNameNode = node.children[i];
            var fieldName = right.slice(fieldNameNode.from, fieldNameNode.to);
            var initValue = this.getValueFromNode(node.children[i + 1], right, context);
            var _a = this.getFieldPointerByEntityAndName(entityPointer, fieldName), fieldPointer = _a[0], type = _a[1];
            this.builder.CreateStore(initValue, fieldPointer);
            i += 2;
        }
    };
    Compiler.prototype.buildProperty = function (prop, context) {
        var _a;
        var rightPartStr = prop.value;
        if (prop.tree === null) {
            return;
        }
        if (this.isListConstructor(prop.tree)) {
            var constructionNode = prop.tree.children[0];
            var listType = constructionNode.children[1].type;
            var listSize = this.getValueFromNode(constructionNode.children[2], rightPartStr, context);
            var arrayType = (0, types_1.VariableTypeToLLVM)(listType, this.builder);
            context[prop.name] = this.builder.CreateAlloca(arrayType, listSize, prop.name);
        }
        else if (this.isEntityConstructor(prop.tree)) {
            var constructionNode = prop.tree.children[0];
            var entityNameNode = constructionNode.children[0];
            var entityName = rightPartStr.slice(entityNameNode.from, entityNameNode.to);
            var entityType = this.entitiesTypes[this.entityIdByName[entityName]];
            context[prop.name] = this.builder.CreateAlloca(entityType, null, prop.name);
            this.initEntityFields(constructionNode.children[1], rightPartStr, context[prop.name], context);
        }
        else if (prop.name === '') {
            this.getValueFromNode(prop.tree, rightPartStr, context);
        }
        else {
            var lValue = void 0;
            var rValue = this.getValueFromNode(prop.tree, rightPartStr, context);
            if (prop.haveIndex) {
                var listInfo = this.getListNameAndIndexFromTree(prop.nameTree, prop.name, context);
                var _b = listInfo, listName = _b[0], index = _b[1];
                lValue = this.getListPointer(listName, index, context);
            }
            else if (prop.isEntityField) {
                var type = null;
                _a = this.getEntityFieldPointerByAST(prop.nameTree, prop.name, context), lValue = _a[0], type = _a[1];
            }
            else {
                lValue = context[prop.name];
                if (lValue == undefined) {
                    throw ReferenceError("Variable ".concat(prop.name, " not initialised in ").concat(prop.name !== '' ? prop.name + ' = ' : '', " ").concat(prop.value));
                }
            }
            this.builder.CreateStore(rValue, lValue);
        }
    };
    Compiler.prototype.getListPointer = function (listName, index, context) {
        var listAlloca = context[listName];
        var gepType = listAlloca.getAllocatedType();
        return this.builder.CreateGEP(gepType, listAlloca, index);
    };
    Compiler.prototype.getEntityFieldPointerByAST = function (node, right, context) {
        var entityCallFields = this.getEntityRequestedFields(node, right);
        if (!entityCallFields || entityCallFields.length === 0 || entityCallFields.length > 2) {
            throw TypeError("Обращение к сущности некорректно");
        }
        var entityPointer = context[entityCallFields[0]];
        var fieldName = entityCallFields[1];
        return this.getFieldPointerByEntityAndName(entityPointer, fieldName);
    };
    Compiler.prototype.getFieldPointerByEntityAndName = function (entityPointer, fieldName) {
        if (!entityPointer.getAllocatedType().isStructTy())
            throw TypeError("Обращение к полю возможно только у сущности");
        var entityName = entityPointer.getAllocatedType().getName();
        var entityId = this.entityIdByName[entityName];
        var entityType = this.entitiesTypes[entityId];
        var entity = this.entities[entityId];
        var fieldIndex = null;
        var fieldType = null;
        for (var _i = 0, _a = entity.fields; _i < _a.length; _i++) {
            var field = _a[_i];
            if (field.name === fieldName) {
                if (field.index == null) {
                    throw TypeError("Field type unsupported");
                }
                fieldIndex = field.index;
                fieldType = (0, types_1.VariableTypeToLLVM)(field.type, this.builder);
            }
        }
        if (fieldIndex == null || !fieldType) {
            throw TypeError("Field unsupported");
        }
        var fieldPtr = this.builder.CreateInBoundsGEP(entityType, entityPointer, [llvm_bindings_1.ConstantInt.get(this.builder.getInt32Ty(), 0, true), llvm_bindings_1.ConstantInt.get(this.builder.getInt32Ty(), fieldIndex, true)]);
        return [fieldPtr, fieldType];
    };
    Compiler.prototype.getValueFromNode = function (node, right, context) {
        var value;
        var lVal, rVal;
        var i;
        switch (node.type) {
            case types_1.ASTTypes.IDENT:
                var name_1 = right.slice(node.from, node.to);
                if (!(name_1 in context)) {
                    break;
                }
                else {
                    lVal = context[name_1];
                }
                return this.builder.CreateLoad(lVal.getAllocatedType(), lVal);
            case types_1.ASTTypes.FALSE:
                return llvm_bindings_1.ConstantInt.getFalse(this.context);
            case types_1.ASTTypes.INTEGER:
                value = Number.parseInt(right.slice(node.from, node.to));
                return llvm_bindings_1.ConstantInt.get(this.builder.getInt32Ty(), value, true);
            case types_1.ASTTypes.FRACTIONAL:
                value = Number.parseFloat(right.slice(node.from, node.to));
                return llvm_bindings_1.ConstantFP.get(this.builder.getDoubleTy(), value);
            case types_1.ASTTypes.TRUE:
                return llvm_bindings_1.ConstantInt.getTrue(this.context);
            case types_1.ASTTypes.COND_EXPR:
                lVal = this.getValueFromNode(node.children[0], right, context);
                i = 1;
                while (i < node.children.length) {
                    var operation = node.children[i].type; // or
                    i += 1;
                    rVal = this.getValueFromNode(node.children[i], right, context);
                    lVal = this.builder.CreateOr(lVal, rVal);
                    i += 1;
                }
                return lVal;
            case types_1.ASTTypes.COND_TERM:
                lVal = this.getValueFromNode(node.children[0], right, context);
                i = 1;
                while (i < node.children.length) {
                    var operation = node.children[i].type; // and
                    i += 1;
                    rVal = this.getValueFromNode(node.children[i], right, context);
                    lVal = this.builder.CreateAnd(lVal, rVal);
                    i += 1;
                }
                return lVal;
            case types_1.ASTTypes.COND_FACT:
                if (node.children.length === 1) {
                    return this.getValueFromNode(node.children[0], right, context);
                }
                if (node.children.length === 2) { // not expr
                    rVal = this.getValueFromNode(node.children[1], right, context);
                    return this.builder.CreateNeg(rVal);
                }
                break;
            case types_1.ASTTypes.COND_EXPR_FACT:
                if (node.children.length === 1) {
                    return this.getValueFromNode(node.children[0], right, context);
                }
                if (node.children.length === 3) {
                    var operation = node.children[1].type;
                    lVal = this.getValueFromNode(node.children[0], right, context);
                    rVal = this.getValueFromNode(node.children[2], right, context);
                    switch (operation) {
                        case types_1.ASTTypes.EQ:
                            return lVal.getType().getTypeID() === llvm_bindings_1.default.Type.TypeID.DoubleTyID ? this.builder.CreateFCmpOEQ(lVal, rVal) : this.builder.CreateICmpEQ(lVal, rVal);
                        case types_1.ASTTypes.LEQ:
                            return lVal.getType().getTypeID() === llvm_bindings_1.default.Type.TypeID.DoubleTyID ? this.builder.CreateFCmpOLE(lVal, rVal) : this.builder.CreateICmpSLE(lVal, rVal);
                        case types_1.ASTTypes.LESS:
                            return lVal.getType().getTypeID() === llvm_bindings_1.default.Type.TypeID.DoubleTyID ? this.builder.CreateFCmpOLT(lVal, rVal) : this.builder.CreateICmpSLT(lVal, rVal);
                        case types_1.ASTTypes.GRATER:
                            return lVal.getType().getTypeID() === llvm_bindings_1.default.Type.TypeID.DoubleTyID ? this.builder.CreateFCmpOGT(lVal, rVal) : this.builder.CreateICmpSGT(lVal, rVal);
                        case types_1.ASTTypes.GEQ:
                            return lVal.getType().getTypeID() === llvm_bindings_1.default.Type.TypeID.DoubleTyID ? this.builder.CreateFCmpOGE(lVal, rVal) : this.builder.CreateICmpSGE(lVal, rVal);
                        case types_1.ASTTypes.NEQ:
                            return lVal.getType().getTypeID() === llvm_bindings_1.default.Type.TypeID.DoubleTyID ? this.builder.CreateFCmpONE(lVal, rVal) : this.builder.CreateICmpNE(lVal, rVal);
                    }
                }
                break;
            case types_1.ASTTypes.EXPR:
                lVal = this.getValueFromNode(node.children[0], right, context);
                i = 1;
                while (i < node.children.length) {
                    var operation = node.children[i].type;
                    i += 1;
                    rVal = this.getValueFromNode(node.children[i], right, context);
                    switch (operation) {
                        case types_1.ASTTypes.ADD:
                            if (rVal.getType().getTypeID() === llvm_bindings_1.Type.TypeID.DoubleTyID) {
                                lVal = this.builder.CreateFAdd(lVal, rVal);
                            }
                            else {
                                lVal = this.builder.CreateAdd(lVal, rVal);
                            }
                            break;
                        case types_1.ASTTypes.SUB:
                            if (rVal.getType().getTypeID() === llvm_bindings_1.Type.TypeID.DoubleTyID) {
                                lVal = this.builder.CreateFSub(lVal, rVal);
                            }
                            else {
                                lVal = this.builder.CreateSub(lVal, rVal);
                            }
                            break;
                    }
                    i += 1;
                }
                return lVal;
            case types_1.ASTTypes.TERM:
                lVal = this.getValueFromNode(node.children[0], right, context);
                i = 1;
                while (i < node.children.length) {
                    var operation = node.children[i].type;
                    i += 1;
                    rVal = this.getValueFromNode(node.children[i], right, context);
                    if (operation === types_1.ASTTypes.MUL) {
                        if (rVal.getType().getTypeID() === llvm_bindings_1.Type.TypeID.DoubleTyID) {
                            lVal = this.builder.CreateFMul(lVal, rVal);
                        }
                        else {
                            lVal = this.builder.CreateMul(lVal, rVal);
                        }
                    }
                    else if (operation === types_1.ASTTypes.DIV) {
                        if (rVal.getType().getTypeID() === llvm_bindings_1.Type.TypeID.DoubleTyID) {
                            lVal = this.builder.CreateFDiv(lVal, rVal);
                        }
                        else {
                            lVal = this.builder.CreateSDiv(lVal, rVal);
                        }
                    }
                    i += 1;
                }
                return lVal;
            case types_1.ASTTypes.FACT:
                if (node.children.length === 1) {
                    return this.getValueFromNode(node.children[0], right, context);
                }
                if (node.children.length === 2) { // unary minus
                    rVal = this.getValueFromNode(node.children[1], right, context);
                    return this.builder.CreateSub(this.builder.getInt32(0), rVal);
                }
                if (node.children.length === 3) { // (expr)
                    return this.getValueFromNode(node.children[1], right, context);
                }
                break;
            case types_1.ASTTypes.LIST_EXPR:
                var index = this.getValueFromNode(node.children[2], right, context);
                var identNode = node.children[0];
                var listName = right.slice(identNode.from, identNode.to);
                var listAlloca = context[listName];
                var gepType = listAlloca.getAllocatedType();
                var elemPointer = this.builder.CreateGEP(gepType, listAlloca, index);
                return this.builder.CreateLoad(gepType, elemPointer);
            case types_1.ASTTypes.STRING:
                value = right.slice(node.from + 1, node.to - 1);
                return this.builder.CreateGlobalStringPtr(value);
            case types_1.ASTTypes.CALL:
                var argsNode = node.children[2];
                var functionNameNode = node.children[0];
                var functionName = right.slice(functionNameNode.from, functionNameNode.to);
                var args = [];
                for (var _i = 0, _a = argsNode.children; _i < _a.length; _i++) {
                    var child = _a[_i];
                    if (child.type === types_1.ASTTypes.COMMA)
                        continue;
                    args.push(this.getValueFromNode(child, right, context));
                }
                var argTypes = args.map(function (v) { return v.getType(); });
                if (!(functionName in system_functions_1.functionsList) && !(functionName in this.chainsInfo)) {
                    throw Error("Function ".concat(functionName, " is not defined"));
                }
                var funcType = null;
                if (functionName in system_functions_1.functionsList) {
                    funcType = system_functions_1.functionsList[functionName](this.builder, argTypes);
                }
                else {
                    var funcInfo = this.chainsInfo[functionName];
                    funcType = llvm_bindings_1.default.FunctionType.get(funcInfo.returnType, funcInfo.args, false);
                }
                var func = this.module.getOrInsertFunction(functionName, funcType);
                return this.builder.CreateCall(func, args);
            case types_1.ASTTypes.ENTITY:
                var _b = this.getEntityFieldPointerByAST(node, right, context), fieldPtr = _b[0], fieldType = _b[1];
                return this.builder.CreateLoad(fieldType, fieldPtr);
        }
        if ("from" in node) {
            console.log(right.slice(node.from, node.to));
        }
        else {
            console.log(node, right);
        }
        return llvm_bindings_1.ConstantInt.getFalse(this.context);
    };
    Compiler.prototype.fillChainInfo = function (compId, schema) {
        var compInfo = schema.components[compId];
        if (!compInfo.isValid) {
            console.log("Schema ".concat(schema.actions[compInfo.startAction] != null && schema.actions[compInfo.startAction].name != null ? schema.actions[compInfo.startAction].name : ""));
            return;
        }
        var startActionId = compInfo.startAction;
        var startAction = schema.actions[startActionId];
        var paramTypes = [];
        for (var _i = 0, _a = startAction.properties; _i < _a.length; _i++) {
            var prop = _a[_i];
            var llvmType = (0, types_1.VariableTypeToLLVM)(prop.type, this.builder);
            if (llvmType)
                paramTypes.push(llvmType);
        }
        var returnType = this.builder.getVoidTy();
        var returnEntityId = undefined;
        var returnEntityName = undefined;
        var returnVariableName = undefined;
        if (startAction.returnedProperties.length > 0) {
            if (startAction.returnedProperties.length > 1) {
                var name_2 = "Temp_ent_" + startAction.name;
                var id = (0, uuid_1.v4)();
                var description = "";
                var fields = startAction.returnedProperties.map(function (p) {
                    return { 'id': (0, uuid_1.v4)(), 'name': p.name, 'type': p.type, 'pointerTo': null };
                });
                var tempEntity = { name: name_2, id: id, description: description, fields: fields };
                var llvmType = this.buildEntity(tempEntity);
                if (llvmType) {
                    returnType = llvmType;
                    returnEntityId = id;
                    returnEntityName = name_2;
                    returnVariableName = "_chainReturnVariable";
                }
            }
            else {
                var llvmType = (0, types_1.VariableTypeToLLVM)(startAction.returnedProperties[0].type, this.builder);
                if (llvmType)
                    returnType = llvmType;
                returnVariableName = startAction.returnedProperties[0].name;
            }
        }
        this.chainsInfo[startAction.name] = {
            'name': startAction.name,
            returnType: returnType,
            'args': paramTypes,
            returnEntityId: returnEntityId,
            returnVariableName: returnVariableName,
            returnEntityName: returnEntityName
        };
        return 1;
    };
    Compiler.prototype.buildCallRule = function (schema, rule, context) {
        var funcName = schema.actions[rule.functionId].name;
        var argNames = schema.actions[rule.functionId].properties.map(function (p) { return p.name; });
        var returnedNames = schema.actions[rule.functionId].returnedProperties.map(function (p) { return p.name; });
        var funcInfo = this.chainsInfo[funcName];
        if (!(funcName in system_functions_1.functionsList) && !(funcName in this.chainsInfo)) {
            throw Error("Function ".concat(funcName, " is not defined"));
        }
        var funcType = llvm_bindings_1.default.FunctionType.get(funcInfo.returnType, funcInfo.args, false);
        var func = this.module.getOrInsertFunction(funcName, funcType);
        var args = [];
        for (var _i = 0, argNames_1 = argNames; _i < argNames_1.length; _i++) {
            var name_3 = argNames_1[_i];
            var argInfo = rule.args[name_3];
            args.push(this.getValueFromNode(argInfo.tree, argInfo.expr, context));
        }
        var returnedValuePointer = this.builder.CreateAlloca(funcInfo.returnType, null);
        this.builder.CreateStore(this.builder.CreateCall(func, args), returnedValuePointer);
        for (var _a = 0, returnedNames_1 = returnedNames; _a < returnedNames_1.length; _a++) {
            var name_4 = returnedNames_1[_a];
            if (!(name_4 in rule.returned))
                continue;
            var _b = this.getFieldPointerByEntityAndName(returnedValuePointer, name_4), fieldPointer = _b[0], type = _b[1];
            var ident = rule.returned[name_4];
            var identPointer = context[ident];
            var fieldValue = this.builder.CreateLoad(type, fieldPointer);
            this.builder.CreateStore(fieldValue, identPointer);
        }
    };
    Compiler.prototype.buildChain = function (compId, schema) {
        var compInfo = schema.components[compId];
        if (!compInfo.isValid) {
            console.log("Schema ".concat(schema.actions[compInfo.startAction] != null && schema.actions[compInfo.startAction].name != null ? schema.actions[compInfo.startAction].name : ""));
            return;
        }
        var startActionId = compInfo.startAction;
        var startAction = schema.actions[startActionId];
        var chainInfo = this.chainsInfo[startAction.name];
        var functionType = llvm_bindings_1.default.FunctionType.get(chainInfo.returnType, chainInfo.args, false);
        var func;
        if (this.module.getFunction(startAction.name) !== null) {
            func = this.module.getFunction(startAction.name);
        }
        else {
            func = llvm_bindings_1.default.Function.Create(functionType, llvm_bindings_1.default.Function.LinkageTypes.ExternalLinkage, startAction.name, this.module);
        }
        var context = {};
        var initBB = llvm_bindings_1.default.BasicBlock.Create(this.context, 'entry', func);
        this.builder.SetInsertPoint(initBB);
        if (chainInfo.returnEntityId) {
            context[chainInfo.returnVariableName] = this.builder.CreateAlloca(chainInfo.returnType, null, chainInfo.returnVariableName);
        }
        for (var i = 0; i < startAction.properties.length; i++) {
            var arg = func.getArg(i);
            var prop = startAction.properties[i];
            arg.setName(prop.name);
            var argAlloc = this.builder.CreateAlloca(arg.getType(), null, prop.name);
            context[prop.name] = argAlloc;
            this.builder.CreateStore(arg, argAlloc);
        }
        for (var name_5 in schema.variables[compId]) {
            if (name_5 in context)
                continue; // переменные из стартового события уже там
            var varInfo = schema.variables[compId][name_5];
            var varType = (0, types_1.VariableTypeToLLVM)(varInfo.type, this.builder);
            if (!varType)
                continue;
            if (varType.getTypeID() === llvm_bindings_1.default.Type.TypeID.PointerTyID) {
                var strMaxLen = llvm_bindings_1.ConstantInt.get(this.builder.getInt32Ty(), 30, true);
                context[name_5] = this.builder.CreateAlloca(varType, strMaxLen, name_5);
            }
            else {
                context[name_5] = this.builder.CreateAlloca(varType, null, name_5);
            }
        }
        var firstRule = schema.rules[compInfo.first];
        var ruleStack = [firstRule];
        var visited = new Set([firstRule.ruleId]);
        firstRule.bb = llvm_bindings_1.default.BasicBlock.Create(this.context, firstRule.name, func);
        this.builder.CreateBr(firstRule.bb);
        var _loop_1 = function () {
            var lastRule = ruleStack.pop();
            this_1.builder.SetInsertPoint(lastRule.bb);
            if (lastRule.isFunction) {
                this_1.buildCallRule(schema, lastRule, context);
            }
            else {
                for (var _i = 0, _a = lastRule.properties; _i < _a.length; _i++) {
                    var prop = _a[_i];
                    try {
                        this_1.buildProperty(prop, context);
                    }
                    catch (e) {
                        e.message = "In rule ".concat(lastRule.name, ": ").concat(e.message);
                        throw e;
                    }
                }
            }
            var nextRules = schema.links.filter(function (l) { return l.ruleId === lastRule.ruleId; });
            var defaultLink = nextRules.find(function (l) { return l.tree == null; });
            nextRules = nextRules.filter(function (l) { return l.tree; });
            if (defaultLink !== undefined)
                nextRules.unshift(defaultLink);
            if (nextRules.length === 0) {
                if (startAction.returnedProperties.length === 0) {
                    this_1.builder.CreateRetVoid();
                }
                else {
                    var returnInst = void 0;
                    if (chainInfo.returnEntityId) {
                        var entityPointer = context[chainInfo.returnVariableName];
                        var entity = this_1.entities[chainInfo.returnEntityId];
                        for (var _b = 0, _c = entity.fields; _b < _c.length; _b++) {
                            var field = _c[_b];
                            if (field.name.startsWith('__debug_'))
                                continue;
                            var _d = this_1.getFieldPointerByEntityAndName(entityPointer, field.name), fieldPointer = _d[0], type = _d[1];
                            var value = context[field.name];
                            var fieldValue = this_1.builder.CreateLoad(value.getAllocatedType(), value);
                            this_1.builder.CreateStore(fieldValue, fieldPointer);
                        }
                        returnInst = this_1.builder.CreateLoad(chainInfo.returnType, entityPointer);
                    }
                    else {
                        var returnName = startAction.returnedProperties[0].name;
                        var value = context[returnName];
                        returnInst = this_1.builder.CreateLoad(value.getAllocatedType(), value);
                    }
                    this_1.builder.CreateRet(returnInst);
                }
            }
            else if (nextRules.length === 1) {
                var link = nextRules[0];
                var ruleTo = schema.rules[link.ruleTo];
                if (!ruleTo.bb)
                    ruleTo.bb = llvm_bindings_1.default.BasicBlock.Create(this_1.context, ruleTo.name, func);
                this_1.builder.CreateBr(ruleTo.bb);
                if (!visited.has(ruleTo.ruleId)) {
                    ruleStack.push(ruleTo);
                    visited.add(ruleTo.ruleId);
                }
            }
            else {
                var brBlocks = [lastRule.bb];
                while (nextRules.length > 2) {
                    var curLink = nextRules.pop();
                    var trueRule = schema.rules[curLink.ruleTo];
                    if (!trueRule.bb)
                        trueRule.bb = llvm_bindings_1.default.BasicBlock.Create(this_1.context, trueRule.name, func);
                    brBlocks.push(llvm_bindings_1.default.BasicBlock.Create(this_1.context, 'no_' + trueRule.name, func));
                    this_1.builder.CreateCondBr(this_1.getValueFromNode(curLink.tree, curLink.label, context), trueRule.bb, brBlocks[brBlocks.length - 1]);
                    this_1.builder.SetInsertPoint(brBlocks[brBlocks.length - 1]);
                    if (!visited.has(trueRule.ruleId)) {
                        ruleStack.push(trueRule);
                        visited.add(trueRule.ruleId);
                    }
                }
                this_1.builder.SetInsertPoint(brBlocks[brBlocks.length - 1]);
                var labelLink = nextRules.pop();
                var defaultL = nextRules.pop();
                var labelRule = schema.rules[labelLink.ruleTo];
                if (!labelRule.bb)
                    labelRule.bb = llvm_bindings_1.default.BasicBlock.Create(this_1.context, labelRule.name, func);
                var defaultRule = schema.rules[defaultL.ruleTo];
                if (!defaultRule.bb)
                    defaultRule.bb = llvm_bindings_1.default.BasicBlock.Create(this_1.context, defaultRule.name, func);
                this_1.builder.CreateCondBr(this_1.getValueFromNode(labelLink.tree, labelLink.label, context), labelRule.bb, defaultRule.bb);
                if (!visited.has(labelRule.ruleId)) {
                    ruleStack.push(labelRule);
                    visited.add(labelRule.ruleId);
                }
                if (!visited.has(defaultRule.ruleId)) {
                    ruleStack.push(defaultRule);
                    visited.add(defaultRule.ruleId);
                }
            }
        };
        var this_1 = this;
        do {
            _loop_1();
        } while (ruleStack.length > 0);
        if (llvm_bindings_1.default.verifyFunction(func)) {
            console.log("\nVerifying function ".concat(startAction.name, " failed"));
            return;
        }
        return 1;
    };
    Compiler.prototype.buildEntity = function (entity) {
        var entityId = entity.id;
        var body = [];
        var i = 0;
        for (var _i = 0, _a = entity.fields; _i < _a.length; _i++) {
            var field = _a[_i];
            var llvmType = (0, types_1.VariableTypeToLLVM)(field.type, this.builder);
            if (llvmType) {
                body.push(llvmType);
                field['index'] = i;
                i++;
            }
        }
        if (entity.fields.length > 1 && entity.fields.length < 5) {
            while (entity.fields.length < 5) {
                var name_6 = '__debug_' + i + '_' + entity.name;
                entity.fields.push({ 'index': i, 'type': types_1.VariablesTypes.INTEGER, 'name': name_6, 'id': (0, uuid_1.v4)(), 'pointerTo': null });
                body.push(this.builder.getInt32Ty());
                i++;
            }
        }
        if (body.length === 0)
            return;
        var structType = llvm_bindings_1.StructType.create(this.context, entity.name);
        structType.setBody(body);
        this.entitiesTypes[entityId] = structType;
        this.entityIdByName[entity.name] = entityId;
        this.entities[entityId] = entity;
        return structType;
    };
    Compiler.prototype.buildEntities = function (schema) {
        for (var entityId in schema.entities) {
            try {
                var entity = schema.entities[entityId];
                this.buildEntity(entity);
            }
            catch (e) {
                e.message = "With entity ".concat(entityId, ": ").concat(e.message);
                throw e;
            }
        }
    };
    Compiler.prototype.getChainName = function (schema, compId) {
        var compInfo = schema.components[compId];
        var startActionId = compInfo.startAction;
        var startAction = schema.actions[startActionId];
        return startAction.name;
    };
    Compiler.prototype.buildSchema = function (schema) {
        var success = true;
        this.buildEntities(schema);
        for (var compId in schema.components) {
            try {
                success = this.fillChainInfo(compId, schema) ? success : false;
            }
            catch (e) {
                e.message = "In chain ".concat(this.getChainName(schema, compId), ": ").concat(e.message);
                throw e;
            }
        }
        for (var compId in schema.components) {
            try {
                success = this.buildChain(compId, schema) ? success : false;
            }
            catch (e) {
                e.message = "In chain ".concat(this.getChainName(schema, compId), ": ").concat(e.message);
                throw e;
            }
        }
        return success;
    };
    return Compiler;
}());
exports.Compiler = Compiler;
