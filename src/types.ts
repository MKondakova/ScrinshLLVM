import llvm from "llvm-bindings";


export function VariableTypeToLLVM(i: VariablesTypes | ASTTypes, builder: llvm.IRBuilder): llvm.Type | null {
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

export function VariableTypeToString(i: VariablesTypes | ASTTypes): string | null {
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

export function LLVMTypeToString(t: llvm.Type): string | null {
    switch (t.getTypeID()) {
        case llvm.Type.TypeID.DoubleTyID:
            return 'double';
        case llvm.Type.TypeID.VoidTyID:
            return 'void';
        case llvm.Type.TypeID.PointerTyID:
            let elemType = LLVMTypeToString(t.getPointerElementType());
            return elemType ? elemType + '*' : null;
        case llvm.Type.TypeID.IntegerTyID:
            if (t.isIntegerTy(1)) {
                return 'bool';
            } else if (t.isIntegerTy(32)) {
                return 'int';
            } else if (t.isIntegerTy(8)) {
                return 'char';
            }
            break;
    }
    return null;
}


export interface ChainType {
    returnType: llvm.Type;
    returnEntityId?: string;
    returnEntityName?: string;
    returnVariableName?: string;
    args: Array<llvm.Type>;
    name: string;
}


export interface Schema {
    rules: Record<string, Rule>;
    components: Record<string, ComponentInfo>;
    componentFromAction: Record<string, string>;
    variables: Record<string, Record<string, { 'type': VariablesTypes }>>;
    links: Array<Link>;
    actions: Record<string, Action>;
    entities: Record<string, Entity>;
    name: string;
}

export interface Entity {
    id: string;
    name: string;
    description: string;
    fields: Array<EntityField>;
}

export interface EntityField {
    id: string;
    name: string;
    type: VariablesTypes;
    pointerTo: string | null;
    index?: number;
}

export interface Rule {
    bb: llvm.BasicBlock;
    name: string,
    ruleId: string,
    properties: Array<Property>;
    isFirst: boolean;
    compId: number;
    action: string | null;
    isFunction: boolean;
    args: Record<string, { 'expr': string, 'tree' : AST }>
    returned: Record<string, string>;
    functionId: string | null;
}

export interface Property {
    value?: string;
    uuid: string;
    name: string; //left side
    haveIndex: boolean;
    isEntityField: boolean;
    nameTree?: AST;
    tree: AST;
    type?: string;
    response: boolean;
}

export interface Link {
    ruleId: string;
    ruleTo: string;
    tree: AST | null;
    label: string;
}

export interface AST {
    type: ASTTypes;
    children: Array<AST>;
    from?: number;
    to?: number;
}

export interface Action {
    name: string;
    properties: Array<ActionProperty>;
    returnedProperties: Array<ActionProperty>;
}

export interface ActionProperty {
    name: string;
    type: VariablesTypes;
    optional: boolean; //пока не влияет ни на что
}

export interface ComponentInfo {
    startAction: string;
    isValid: boolean;
    first: string;
}

export enum VariablesTypes {
    BOOLEAN = 'bool', STRING = 'str', INTEGER = 'integer', FRACTIONAL = 'fractional', STRUCT_LINK = 'jsonobject'
}

export enum ASTTypes {
    IDENT = 'identifier',
    INTEGER = 'decimal number',
    FRACTIONAL = 'float number',
    TRUE = 'boolean true',
    FALSE = 'boolean false',
    STRING = 'quoted string',
    COND_EXPR = 'COND_EXPR',
    COND_TERM = 'COND_TERM',
    COND_FACT = 'COND_FACT',
    COND_EXPR_FACT = 'COND_EXPR_FACT',
    EXPR = 'EXPR',
    TERM = 'TERM',
    FACT = 'FACT',
    ADD = '+',
    SUB = '-',
    MUL = '*',
    DIV = '/',
    AND = 'and',
    OR = 'or',
    LESS = '<',
    GRATER = '>',
    EQ = '=',
    GEQ = '>=',
    LEQ = '<=',
    NEQ = '!=',
    LIST_CONSTRUCTION = 'LIST_CONSTRUCTION',
    LIST_EXPR = 'LIST_EXPR',
    INTEGER_TYPE = 'integer number type',
    FRACTIONAL_TYPE = 'fractional numer type',
    BOOLEAN_TYPE = 'boolean',
    CALL = 'METHOD',
    ARGUMENTS = 'ARGUMENTS',
    COMMA = ',',
    ENTITY_CONSTRUCTION = 'ENTITY_CONSTRUCTION',
    ENTITY = 'ENTITY',
    DOT = '.',

}
