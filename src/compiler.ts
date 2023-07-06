import llvm, {ConstantFP, ConstantInt, StructType, Type} from "llvm-bindings";
import {
    AST,
    ASTTypes,
    ChainType,
    Entity,
    EntityField,
    Link,
    Property,
    Rule,
    Schema,
    VariablesTypes,
    VariableTypeToLLVM
} from "./types";
import {functionsList} from "./system_functions";
import {v4 as uuidv4} from "uuid";

export class Compiler {
    module: llvm.Module;
    builder: llvm.IRBuilder;
    context: llvm.LLVMContext;
    entitiesTypes: Record<string, llvm.StructType>;
    entityIdByName: Record<string, string>;
    entities: Record<string, Entity>;
    chainsInfo: Record<string, ChainType>

    constructor() {
        this.context = new llvm.LLVMContext();
        this.module = new llvm.Module('initial module', this.context);
        this.builder = new llvm.IRBuilder(this.context);
        this.entitiesTypes = {};
        this.entityIdByName = {};
        this.entities = {};
        this.chainsInfo = {};
    }

    getModuleString(): string | null {
        if (llvm.verifyModule(this.module)) {
            console.error('Verifying module failed');
            return null;
        }
        return this.module.print();
    }

    isListConstructor(tree: AST): boolean {
        return tree.type === ASTTypes.COND_EXPR && tree.children[0].type === ASTTypes.LIST_CONSTRUCTION;
    }

    isEntityConstructor(tree: AST): boolean {
        return tree.type === ASTTypes.COND_EXPR && tree.children[0].type === ASTTypes.ENTITY_CONSTRUCTION;
    }

    getListNameAndIndexFromTree(node: AST, right: string, context: Record<string, llvm.AllocaInst>): [string, llvm.Value] | null {
        let listNode = this.goDownASTUntil(node, (n) => n.type === ASTTypes.LIST_EXPR)
        if (!listNode) return null;
        let identNode = listNode.children[0];
        let index = this.getValueFromNode(listNode.children[2], right, context);
        let listName = right.slice(identNode.from, identNode.to);
        return [listName, index];
    }

    goDownASTUntil(node: AST | null, condition: (node: AST) => boolean): AST | null {
        if (!node) return null;
        if (!condition(node)) {
            if (node.children.length > 0) {
                return this.goDownASTUntil(node.children[0], condition);
            } else {
                return null;
            }
        }
        return node;
    }

    getEntityRequestedFields(node: AST, right: string): Array<string> | null {
        let entityNode = this.goDownASTUntil(node, (n) => n.type === ASTTypes.ENTITY)
        if (!entityNode) return null;
        let result = [];
        let i = 0;
        do {
            if (entityNode.children[i].type === ASTTypes.DOT) i++;
            let fieldNameNode = entityNode.children[i];
            let fieldName = right.slice(fieldNameNode.from, fieldNameNode.to);
            result.push(fieldName);
            i++;
        } while (i < entityNode.children.length && entityNode.children[i].type === ASTTypes.DOT);
        return result;
    }

    initEntityFields(node: AST, right: string, entityPointer: llvm.AllocaInst, context: Record<string, llvm.AllocaInst>) {
        let i = 0;
        while (i < node.children.length) {
            let fieldNameNode = node.children[i];
            let fieldName = right.slice(fieldNameNode.from, fieldNameNode.to);
            let initValue = this.getValueFromNode(node.children[i + 1], right, context);
            let [fieldPointer, type] = this.getFieldPointerByEntityAndName(entityPointer, fieldName);
            this.builder.CreateStore(initValue, fieldPointer);
            i += 2
        }
    }

    buildProperty(prop: Property, context: Record<string, llvm.AllocaInst>): void {
        const rightPartStr = prop.value!;
        if (prop.tree === null) {
            return;
        }

        if (this.isListConstructor(prop.tree)) {
            let constructionNode = prop.tree.children[0];
            let listType = constructionNode.children[1].type;
            let listSize = this.getValueFromNode(constructionNode.children[2], rightPartStr, context);
            let arrayType = VariableTypeToLLVM(listType, this.builder)!;
            context[prop.name] = this.builder.CreateAlloca(arrayType, listSize, prop.name);
        } else if (this.isEntityConstructor(prop.tree)) {
            let constructionNode = prop.tree.children[0];
            let entityNameNode = constructionNode.children[0];
            let entityName = rightPartStr.slice(entityNameNode.from, entityNameNode.to);
            let entityType = this.entitiesTypes[this.entityIdByName[entityName]];
            context[prop.name] = this.builder.CreateAlloca(entityType, null, prop.name);
            this.initEntityFields(constructionNode.children[1], rightPartStr, context[prop.name], context);
        } else if (prop.name === '') {
            this.getValueFromNode(prop.tree, rightPartStr, context);
        } else {
            let lValue: llvm.Value;
            let rValue = this.getValueFromNode(prop.tree, rightPartStr, context);
            if (prop.haveIndex) {
                let listInfo = this.getListNameAndIndexFromTree(prop.nameTree!, prop.name, context);
                let [listName, index] = listInfo!;
                lValue = this.getListPointer(listName, index, context);
            } else if (prop.isEntityField) {
                let type = null;
                [lValue, type] = this.getEntityFieldPointerByAST(prop.nameTree!, prop.name, context);
            } else {
                lValue = context[prop.name];
                if (lValue == undefined) {
                    throw ReferenceError(`Variable ${prop.name} not initialised in ${prop.name !== '' ? prop.name + ' = ' : ''} ${prop.value}`)
                }
            }
            this.builder.CreateStore(rValue, lValue);
        }
    }

    getListPointer(listName: string, index: llvm.Value, context: Record<string, llvm.AllocaInst>): llvm.Value {
        let listAlloca = context[listName];
        let gepType = listAlloca.getAllocatedType();
        return this.builder.CreateGEP(gepType, listAlloca, index);
    }

    getEntityFieldPointerByAST(node: AST, right: string, context: Record<string, llvm.AllocaInst>): [llvm.Value, llvm.Type] {
        let entityCallFields = this.getEntityRequestedFields(node, right);
        if (!entityCallFields || entityCallFields.length === 0 || entityCallFields.length > 2) {
            throw TypeError("Обращение к сущности некорректно");
        }
        let entityPointer = context[entityCallFields[0]];
        let fieldName = entityCallFields[1];
        return this.getFieldPointerByEntityAndName(entityPointer, fieldName);
    }

    getFieldPointerByEntityAndName(entityPointer: llvm.AllocaInst, fieldName: string): [llvm.Value, llvm.Type] {
        if (!entityPointer.getAllocatedType().isStructTy()) throw TypeError("Обращение к полю возможно только у сущности");
        let entityName = (entityPointer.getAllocatedType() as llvm.StructType).getName();
        let entityId = this.entityIdByName[entityName];
        let entityType = this.entitiesTypes[entityId]
        let entity = this.entities[entityId];
        let fieldIndex = null;
        let fieldType = null;
        for (let field of entity.fields) {
            if (field.name === fieldName) {
                if (field.index == null) {
                    throw TypeError("Field type unsupported");
                }
                fieldIndex = field.index;
                fieldType = VariableTypeToLLVM(field.type, this.builder);
            }
        }
        if (fieldIndex == null || !fieldType) {
            throw TypeError("Field unsupported");
        }
        let fieldPtr = this.builder.CreateInBoundsGEP(entityType, entityPointer,
            [ConstantInt.get(this.builder.getInt32Ty(), 0, true), ConstantInt.get(this.builder.getInt32Ty(), fieldIndex, true)]);
        return [fieldPtr, fieldType]
    }

    getValueFromNode(node: AST, right: string, context: Record<string, llvm.AllocaInst>): llvm.Value {
        let value: any;
        let lVal, rVal: llvm.Value;
        let i: number;

        switch (node.type) {
            case ASTTypes.IDENT:
                let name = right.slice(node.from, node.to);
                if (!(name in context)) {
                    break;
                } else {
                    lVal = context[name];
                }
                return this.builder.CreateLoad(lVal.getAllocatedType(), lVal);
            case ASTTypes.FALSE:
                return ConstantInt.getFalse(this.context);
            case ASTTypes.INTEGER:
                value = Number.parseInt(right.slice(node.from, node.to));
                return ConstantInt.get(this.builder.getInt32Ty(), value, true)
            case ASTTypes.FRACTIONAL:
                value = Number.parseFloat(right.slice(node.from, node.to));
                return ConstantFP.get(this.builder.getDoubleTy(), value);
            case ASTTypes.TRUE:
                return ConstantInt.getTrue(this.context);
            case ASTTypes.COND_EXPR:
                lVal = this.getValueFromNode(node.children[0], right, context);
                i = 1;
                while (i < node.children.length) {
                    let operation = node.children[i].type; // or
                    i += 1;
                    rVal = this.getValueFromNode(node.children[i], right, context);
                    lVal = this.builder.CreateOr(lVal, rVal);
                    i += 1
                }
                return lVal;
            case ASTTypes.COND_TERM:
                lVal = this.getValueFromNode(node.children[0], right, context);
                i = 1;
                while (i < node.children.length) {
                    let operation = node.children[i].type; // and
                    i += 1;
                    rVal = this.getValueFromNode(node.children[i], right, context);
                    lVal = this.builder.CreateAnd(lVal, rVal);
                    i += 1
                }
                return lVal;
            case ASTTypes.COND_FACT:
                if (node.children.length === 1) {
                    return this.getValueFromNode(node.children[0], right, context);
                }
                if (node.children.length === 2) { // not expr
                    rVal = this.getValueFromNode(node.children[1], right, context);
                    return this.builder.CreateNeg(rVal);
                }
                break;
            case ASTTypes.COND_EXPR_FACT:
                if (node.children.length === 1) {
                    return this.getValueFromNode(node.children[0], right, context);
                }
                if (node.children.length === 3) {
                    let operation = node.children[1].type;
                    lVal = this.getValueFromNode(node.children[0], right, context);
                    rVal = this.getValueFromNode(node.children[2], right, context);
                    switch (operation) {
                        case ASTTypes.EQ:
                            return lVal.getType().getTypeID() === llvm.Type.TypeID.DoubleTyID ? this.builder.CreateFCmpOEQ(lVal, rVal) : this.builder.CreateICmpEQ(lVal, rVal);
                        case ASTTypes.LEQ:
                            return lVal.getType().getTypeID() === llvm.Type.TypeID.DoubleTyID ? this.builder.CreateFCmpOLE(lVal, rVal) : this.builder.CreateICmpSLE(lVal, rVal);
                        case ASTTypes.LESS:
                            return lVal.getType().getTypeID() === llvm.Type.TypeID.DoubleTyID ? this.builder.CreateFCmpOLT(lVal, rVal) : this.builder.CreateICmpSLT(lVal, rVal);
                        case ASTTypes.GRATER:
                            return lVal.getType().getTypeID() === llvm.Type.TypeID.DoubleTyID ? this.builder.CreateFCmpOGT(lVal, rVal) : this.builder.CreateICmpSGT(lVal, rVal);
                        case ASTTypes.GEQ:
                            return lVal.getType().getTypeID() === llvm.Type.TypeID.DoubleTyID ? this.builder.CreateFCmpOGE(lVal, rVal) : this.builder.CreateICmpSGE(lVal, rVal);
                        case ASTTypes.NEQ:
                            return lVal.getType().getTypeID() === llvm.Type.TypeID.DoubleTyID ? this.builder.CreateFCmpONE(lVal, rVal) : this.builder.CreateICmpNE(lVal, rVal);
                    }
                }
                break;
            case ASTTypes.EXPR:
                lVal = this.getValueFromNode(node.children[0], right, context);
                i = 1;
                while (i < node.children.length) {
                    let operation = node.children[i].type;
                    i += 1;
                    rVal = this.getValueFromNode(node.children[i], right, context);
                    switch (operation) {
                        case ASTTypes.ADD:
                            if (rVal.getType().getTypeID() === Type.TypeID.DoubleTyID) {
                                lVal = this.builder.CreateFAdd(lVal, rVal)
                            } else {
                                lVal = this.builder.CreateAdd(lVal, rVal);
                            }
                            break;
                        case ASTTypes.SUB:
                            if (rVal.getType().getTypeID() === Type.TypeID.DoubleTyID) {
                                lVal = this.builder.CreateFSub(lVal, rVal)
                            } else {
                                lVal = this.builder.CreateSub(lVal, rVal);
                            }
                            break;
                    }
                    i += 1
                }
                return lVal;
            case ASTTypes.TERM:
                lVal = this.getValueFromNode(node.children[0], right, context);
                i = 1;
                while (i < node.children.length) {
                    let operation = node.children[i].type;
                    i += 1;
                    rVal = this.getValueFromNode(node.children[i], right, context);
                    if (operation === ASTTypes.MUL) {
                        if (rVal.getType().getTypeID() === Type.TypeID.DoubleTyID) {
                            lVal = this.builder.CreateFMul(lVal, rVal)
                        } else {
                            lVal = this.builder.CreateMul(lVal, rVal);
                        }
                    } else if (operation === ASTTypes.DIV) {
                        if (rVal.getType().getTypeID() === Type.TypeID.DoubleTyID) {
                            lVal = this.builder.CreateFDiv(lVal, rVal);
                        } else {
                            lVal = this.builder.CreateSDiv(lVal, rVal);
                        }
                    }
                    i += 1
                }
                return lVal;
            case ASTTypes.FACT:
                if (node.children.length === 1) {
                    return this.getValueFromNode(node.children[0], right, context);
                }
                if (node.children.length === 2) { // unary minus
                    rVal = this.getValueFromNode(node.children[1], right, context);
                    return this.builder.CreateSub(this.builder.getInt32(0), rVal)
                }
                if (node.children.length === 3) { // (expr)
                    return this.getValueFromNode(node.children[1], right, context);
                }
                break;
            case ASTTypes.LIST_EXPR:
                let index = this.getValueFromNode(node.children[2], right, context);
                let identNode = node.children[0];
                let listName = right.slice(identNode.from, identNode.to);
                let listAlloca = context[listName];
                let gepType = listAlloca.getAllocatedType();
                let elemPointer = this.builder.CreateGEP(gepType, listAlloca, index);
                return this.builder.CreateLoad(gepType, elemPointer);
            case ASTTypes.STRING:
                value = right.slice(node.from! + 1, node.to! - 1);
                return this.builder.CreateGlobalStringPtr(value);
            case ASTTypes.CALL:
                let argsNode = node.children[2];
                let functionNameNode = node.children[0];
                let functionName = right.slice(functionNameNode.from!, functionNameNode.to!)
                let args: llvm.Value[] = [];
                for (let child of argsNode.children) {
                    if (child.type === ASTTypes.COMMA) continue;
                    args.push(this.getValueFromNode(child, right, context));
                }
                let argTypes = args.map(v => v.getType());
                if (!(functionName in functionsList) && !(functionName in this.chainsInfo)) {
                    throw Error(`Function ${functionName} is not defined`);
                }
                let funcType = null;
                if (functionName in functionsList) {
                    funcType = functionsList[functionName](this.builder, argTypes);
                } else {
                    let funcInfo = this.chainsInfo[functionName];
                    funcType = llvm.FunctionType.get(funcInfo.returnType, funcInfo.args, false);
                }
                let func = this.module.getOrInsertFunction(functionName, funcType);
                return this.builder.CreateCall(func, args);
            case ASTTypes.ENTITY:
                let [fieldPtr, fieldType] = this.getEntityFieldPointerByAST(node, right, context);
                return this.builder.CreateLoad(fieldType, fieldPtr);
        }

        if ("from" in node) {
            console.log(right.slice(node.from, node.to));
        }
        return ConstantInt.getFalse(this.context);
    }

    fillChainInfo(compId: string, schema: Schema):  number | undefined  {
        let compInfo = schema.components[compId];
        if (!compInfo.isValid) {
            console.log(`Schema ${schema.actions[compInfo.startAction] != null && schema.actions[compInfo.startAction].name != null ? schema.actions[compInfo.startAction].name : ""}`)
            return;
        }

        let startActionId = compInfo.startAction;
        let startAction = schema.actions[startActionId];
        let paramTypes = [];
        for (let prop of startAction.properties) {
            let llvmType = VariableTypeToLLVM(prop.type, this.builder);
            if (llvmType) paramTypes.push(llvmType);
        }

        let returnType = this.builder.getVoidTy();
        let returnEntityId = undefined;
        let returnEntityName = undefined;
        let returnVariableName = undefined;
        if (startAction.returnedProperties.length > 0) {
            if (startAction.returnedProperties.length > 1) {
                let name = "Temp_ent_" + startAction.name;
                let id = uuidv4();
                let description = "";
                let fields = startAction.returnedProperties.map(p => {
                    return {'id': uuidv4(), 'name': p.name, 'type': p.type, 'pointerTo': null} as EntityField;
                });
                let tempEntity = {name, id, description, fields} as Entity;
                let llvmType = this.buildEntity(tempEntity);
                if (llvmType) {
                    returnType = llvmType;
                    returnEntityId = id;
                    returnEntityName = name;

                    returnVariableName = "_chainReturnVariable";
                }
            } else {
                let llvmType = VariableTypeToLLVM(startAction.returnedProperties[0].type, this.builder);
                if (llvmType) returnType = llvmType;
                returnVariableName = startAction.returnedProperties[0].name;
            }
        }
        this.chainsInfo[startAction.name] = {
            'name': startAction.name,
            returnType,
            'args': paramTypes,
            returnEntityId,
            returnVariableName,
            returnEntityName
        };
        return 1;
    }

    buildCallRule(schema: Schema, rule: Rule, context: Record<string, llvm.AllocaInst>): void {
        let funcName = schema.actions[rule.functionId!].name;
        let argNames = schema.actions[rule.functionId!].properties.map(p => p.name);
        let returnedNames = schema.actions[rule.functionId!].returnedProperties.map(p => p.name);
        let funcInfo = this.chainsInfo[funcName];
        if (!(funcName in functionsList) && !(funcName in this.chainsInfo)) {
            throw Error(`Function ${funcName} is not defined`);
        }
        let funcType = llvm.FunctionType.get(funcInfo.returnType, funcInfo.args, false);
        let func = this.module.getOrInsertFunction(funcName, funcType);
        let args = [];
        for (let name of argNames) {
            let argInfo = rule.args[name];
            args.push(this.getValueFromNode(argInfo.tree, argInfo.expr, context));
        }
        let returnedValuePointer = this.builder.CreateAlloca(funcInfo.returnType, null);
        this.builder.CreateStore(this.builder.CreateCall(func, args), returnedValuePointer);
        for (let name of returnedNames) {
            if (!(name in rule.returned)) continue;
            let [fieldPointer, type] = this.getFieldPointerByEntityAndName(returnedValuePointer, name);
            let ident = rule.returned[name];
            let identPointer = context[ident];
            let fieldValue = this.builder.CreateLoad(type, fieldPointer);
            this.builder.CreateStore(fieldValue, identPointer);
        }
    }


    buildChain(compId: string, schema: Schema): number | undefined {
        let compInfo = schema.components[compId];
        if (!compInfo.isValid) {
            console.log(`Schema ${schema.actions[compInfo.startAction] != null && schema.actions[compInfo.startAction].name != null ? schema.actions[compInfo.startAction].name : ""}`)
            return;
        }

        let startActionId = compInfo.startAction;
        let startAction = schema.actions[startActionId];

        let chainInfo = this.chainsInfo[startAction.name];
        const functionType = llvm.FunctionType.get(chainInfo.returnType, chainInfo.args, false);
        let func: llvm.Function;
        if (this.module.getFunction(startAction.name) !== null) {
            func = this.module.getFunction(startAction.name)!;
        } else {
            func = llvm.Function.Create(functionType, llvm.Function.LinkageTypes.ExternalLinkage, startAction.name, this.module);
        }
        let context: Record<string, llvm.AllocaInst> = {};

        let initBB = llvm.BasicBlock.Create(this.context, 'entry', func);
        this.builder.SetInsertPoint(initBB);

        if (chainInfo.returnEntityId) {
            context[chainInfo.returnVariableName!] = this.builder.CreateAlloca(chainInfo.returnType, null, chainInfo.returnVariableName);
        }

        for (let i = 0; i < startAction.properties.length; i++) {
            let arg = func.getArg(i);
            let prop = startAction.properties[i];
            arg.setName(prop.name)
            let argAlloc = this.builder.CreateAlloca(arg.getType(), null, prop.name);
            context[prop.name] = argAlloc;
            this.builder.CreateStore(arg, argAlloc);
        }

        for (let name in schema.variables[compId]) {
            if (name in context) continue; // переменные из стартового события уже там
            let varInfo = schema.variables[compId][name];
            let varType = VariableTypeToLLVM(varInfo.type, this.builder);
            if (!varType) continue;
            if (varType.getTypeID() === llvm.Type.TypeID.PointerTyID) {
                let strMaxLen = ConstantInt.get(this.builder.getInt32Ty(), 30, true);
                context[name] = this.builder.CreateAlloca(varType, strMaxLen, name);
            } else {
                context[name] = this.builder.CreateAlloca(varType, null, name);
            }
        }

        let firstRule = schema.rules[compInfo.first];
        let ruleStack = [firstRule];
        let visited = new Set([firstRule.ruleId]);
        firstRule.bb = llvm.BasicBlock.Create(this.context, firstRule.name, func);
        this.builder.CreateBr(firstRule.bb);

        do {
            let lastRule = ruleStack.pop() as Rule;
            this.builder.SetInsertPoint(lastRule.bb);
            if (lastRule.isFunction) {
                this.buildCallRule(schema, lastRule, context);
            } else {
                for (let prop of lastRule.properties) {
                    try {
                        this.buildProperty(prop, context);
                    } catch (e: any) {
                        e.message = `In rule ${lastRule.name}: ${e.message}`
                        throw e
                    }
                }
            }
            let nextRules = schema.links.filter((l: Link) => l.ruleId === lastRule.ruleId);
            let defaultLink = nextRules.find(l => l.tree == null);
            nextRules = nextRules.filter(l => l.tree);
            if (defaultLink !== undefined) nextRules.unshift(defaultLink);
            if (nextRules.length === 0) {
                if (startAction.returnedProperties.length === 0) {
                    this.builder.CreateRetVoid();
                } else {
                    let returnInst: llvm.LoadInst;
                    if (chainInfo.returnEntityId) {
                        let entityPointer = context[chainInfo.returnVariableName!];
                        let entity = this.entities[chainInfo.returnEntityId]!;
                        for (let field of entity.fields) {
                            if (field.name.startsWith('__debug_')) continue;
                            let [fieldPointer, type] = this.getFieldPointerByEntityAndName(entityPointer, field.name);
                            let value = context[field.name];
                            let fieldValue = this.builder.CreateLoad(value.getAllocatedType(), value);
                            this.builder.CreateStore(fieldValue, fieldPointer);
                        }
                        returnInst = this.builder.CreateLoad(chainInfo.returnType, entityPointer);
                    } else {
                        let returnName = startAction.returnedProperties[0].name;
                        let value = context[returnName];
                        returnInst = this.builder.CreateLoad(value.getAllocatedType(), value);
                    }
                    this.builder.CreateRet(returnInst);
                }
            } else if (nextRules.length === 1) {
                let link = nextRules[0];
                let ruleTo = schema.rules[link.ruleTo];
                if (!ruleTo.bb) ruleTo.bb = llvm.BasicBlock.Create(this.context, ruleTo.name, func);
                this.builder.CreateBr(ruleTo.bb);
                if (!visited.has(ruleTo.ruleId)) {
                    ruleStack.push(ruleTo);
                    visited.add(ruleTo.ruleId);
                }
            } else {
                let brBlocks = [lastRule.bb];
                while (nextRules.length > 2) {
                    let curLink = nextRules.pop()!;
                    let trueRule = schema.rules[curLink.ruleTo];
                    if (!trueRule.bb) trueRule.bb = llvm.BasicBlock.Create(this.context, trueRule.name, func);
                    brBlocks.push(llvm.BasicBlock.Create(this.context, 'no_'+trueRule.name, func));
                    this.builder.CreateCondBr(this.getValueFromNode(curLink.tree!, curLink.label, context), trueRule.bb, brBlocks[brBlocks.length - 1]);
                    this.builder.SetInsertPoint(brBlocks[brBlocks.length - 1]);
                    if (!visited.has(trueRule.ruleId)) {
                        ruleStack.push(trueRule);
                        visited.add(trueRule.ruleId);
                    }
                }
                this.builder.SetInsertPoint(brBlocks[brBlocks.length - 1]);
                let labelLink = nextRules.pop()!;
                let defaultL = nextRules.pop()!;
                let labelRule = schema.rules[labelLink.ruleTo];
                if (!labelRule.bb) labelRule.bb = llvm.BasicBlock.Create(this.context, labelRule.name, func);
                let defaultRule = schema.rules[defaultL.ruleTo];
                if (!defaultRule.bb) defaultRule.bb = llvm.BasicBlock.Create(this.context, defaultRule.name, func);
                this.builder.CreateCondBr(this.getValueFromNode(labelLink.tree!, labelLink.label, context), labelRule.bb, defaultRule.bb);
                if (!visited.has(labelRule.ruleId)) {
                    ruleStack.push(labelRule);
                    visited.add(labelRule.ruleId);
                }
                if (!visited.has(defaultRule.ruleId)) {
                    ruleStack.push(defaultRule);
                    visited.add(defaultRule.ruleId);
                }
            }
        } while (ruleStack.length > 0)

        if (llvm.verifyFunction(func)) {
            console.log(`\nVerifying function ${startAction.name} failed`);
            return;
        }

        return 1;
    }

    buildEntity(entity: Entity): llvm.Type | undefined {
        let entityId = entity.id;
        let body: Array<llvm.Type> = [];
        let i = 0;
        for (let field of entity.fields) {
            let llvmType = VariableTypeToLLVM(field.type, this.builder);
            if (llvmType) {
                body.push(llvmType);
                field['index'] = i;
                i++;
            }
        }
        if (entity.fields.length > 1 && entity.fields.length < 5) {
            while (entity.fields.length < 5) {
                const name = '__debug_' + i + '_' + entity.name;
                entity.fields.push({ 'index': i, 'type': VariablesTypes.INTEGER, 'name': name, 'id': uuidv4(), 'pointerTo': null });
                body.push(this.builder.getInt32Ty());
                i++;
            }
        }
        if (body.length === 0) return;
        let structType = StructType.create(this.context, entity.name);
        structType.setBody(body);
        this.entitiesTypes[entityId] = structType;
        this.entityIdByName[entity.name] = entityId;
        this.entities[entityId] = entity;
        return structType;
    }

    buildEntities(schema: Schema) {
        for (let entityId in schema.entities) {
            try {
                let entity = schema.entities[entityId];
                this.buildEntity(entity);
            } catch (e: any) {
                e.message = `With entity ${entityId}: ${e.message}`;
                throw e;
            }
        }
    }

    getChainName(schema: Schema, compId: string): string {
        let compInfo = schema.components[compId];
        let startActionId = compInfo.startAction;
        let startAction = schema.actions[startActionId];
        return startAction.name;
    }

    buildSchema(schema: Schema): boolean {
        let success = true;
        this.buildEntities(schema);
        for (let compId in schema.components) {
            try {
                success = this.fillChainInfo(compId, schema) ? success : false;
            } catch (e: any) {
                e.message = `In chain ${this.getChainName(schema, compId)}: ${e.message}`;
                throw e;
            }
        }
        for (let compId in schema.components) {
            try {
                success = this.buildChain(compId, schema) ? success : false;
            } catch (e: any) {
                e.message = `In chain ${this.getChainName(schema, compId)}: ${e.message}`;
                throw e;
            }
        }
        return success;
    }
}