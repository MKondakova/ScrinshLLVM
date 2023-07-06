import {v4 as uuidv4} from "uuid";
import fs from "fs";

interface Chain {
    rules: Array<Rule>;
    links: Array<Link>;
    entities: Array<any>;
    schemeId: string;
}

interface Link {
    id: string;
    from: string;
    to: string;
    label: string;
    async: boolean;
}

interface Rule {
    name: string;
    id: string;
    canvasX: number;
    canvasY: number;
    properties: Array<Property>;
    actions: Array<Action>;
    responseAction: Action | null;
    longDescription: string;
    shortDescription: string;
}

interface Property {
    uuid: string;
    name: string;
    val: string;
    response: boolean;
    transform: boolean;
    type: null;
}

interface Action {
    id: string;
    name: string;
    system: false;
    need_auth: boolean;
    props: Array<ActionProperty>;
}

interface ActionProperty {
    name: string;
    type: string;
    optional: boolean;
    defValue: null;
    entityType: null;
}

function generateRule(x: number, y: number): Rule {
    return {
        'name': `rule${uuidv4().slice(0, 5)}`,
        'id': uuidv4(),
        'canvasX': x,
        'canvasY': y,
        'properties': [],
        'actions': [],
        'responseAction': null,
        'shortDescription': "",
        'longDescription': ""
    } as Rule
}

function generateLink(from: string, to: string, needCondition: boolean): Link {
    let label = "";
    if (needCondition) {
        let a = Math.floor(Math.random() * 10) + 1;
        let b = Math.floor(Math.random() * 10) + 1;
        label = `${a} > ${b}`;
    }
    return {
        'id': uuidv4(),
        from, to,
        'async': false,
        label
    } as Link;
}


function generateChain(rulesNumber: number, linksNumber: number, n1: number, n2: number, schemeId: string): Chain {
    if (n1 + n2 > 1 || n1 + n2 <= 0) {
        console.log("n1 и n2 - это вероятности. Если выпало х < n1, появляется новое правило, если x < n1 + n2, строится связь к уже созданному правилу, иначе алгоритм переходит к следующему правилу");
    }
    let rules = [generateRule(0, 0)];
    let links = [];
    let ruleIndex = 0;
    while (rules.length < rulesNumber && links.length < linksNumber && ruleIndex < rules.length) {
        let rule = rules[ruleIndex];
        let linkAdded = false;
        let newRulesCount = 0;
        let lottery = Math.random();
        let lastPos = rules[rules.length - 1].canvasX;
        while (lottery < n1 + n2) {
            if (lottery < n1) {
                let newRule = generateRule(lastPos + 2, newRulesCount * 2);
                rules.push(newRule);
                newRulesCount += 1;
                links.push(generateLink(rule.id, newRule.id, linkAdded));
            } else {
                let randomIndex = Math.floor(Math.random() * rules.length);
                while (ruleIndex === randomIndex) {
                    randomIndex = Math.floor(Math.random() * rules.length);
                }
                links.push(generateLink(rule.id, rules[ruleIndex].id, linkAdded));
            }
            linkAdded = true;
            lottery = Math.random();
        }
        if (!linkAdded && rules.length < rulesNumber * 0.8)
            continue;
        ruleIndex += 1;
        console.log('rules: ', rules.length, 'links: ', links.length);
    }
    return {rules, links, 'entities': [], schemeId};
}

let result = JSON.stringify(generateChain(1000, 900, 0.4, 0.2, 'f9e85508bc0740a384cef087702415d3'));
fs.writeFile("out.json", result, (err: any) => {
    if (err) return console.log(err);
    //console.log(`${outIR} > examples/out.ll`);
});