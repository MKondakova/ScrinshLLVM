"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var uuid_1 = require("uuid");
var fs_1 = __importDefault(require("fs"));
function generateRule(x, y) {
    return {
        'name': "rule".concat((0, uuid_1.v4)().slice(0, 5)),
        'id': (0, uuid_1.v4)(),
        'canvasX': x,
        'canvasY': y,
        'properties': [],
        'actions': [],
        'responseAction': null,
        'shortDescription': "",
        'longDescription': ""
    };
}
function generateLink(from, to, needCondition) {
    var label = "";
    if (needCondition) {
        var a = Math.floor(Math.random() * 10) + 1;
        var b = Math.floor(Math.random() * 10) + 1;
        label = "".concat(a, " > ").concat(b);
    }
    return {
        'id': (0, uuid_1.v4)(),
        from: from,
        to: to,
        'async': false,
        label: label
    };
}
function generateChain(rulesNumber, linksNumber, n1, n2, schemeId) {
    if (n1 + n2 > 1 || n1 + n2 <= 0) {
        console.log("n1 и n2 - это вероятности. Если выпало х < n1, появляется новое правило, если x < n1 + n2, строится связь к уже созданному правилу, иначе алгоритм переходит к следующему правилу");
    }
    var rules = [generateRule(0, 0)];
    var links = [];
    var ruleIndex = 0;
    while (rules.length < rulesNumber && links.length < linksNumber && ruleIndex < rules.length) {
        var rule = rules[ruleIndex];
        var linkAdded = false;
        var newRulesCount = 0;
        var lottery = Math.random();
        var lastPos = rules[rules.length - 1].canvasX;
        while (lottery < n1 + n2) {
            if (lottery < n1) {
                var newRule = generateRule(lastPos + 2, newRulesCount * 2);
                rules.push(newRule);
                newRulesCount += 1;
                links.push(generateLink(rule.id, newRule.id, linkAdded));
            }
            else {
                var randomIndex = Math.floor(Math.random() * rules.length);
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
    return { rules: rules, links: links, 'entities': [], schemeId: schemeId };
}
var result = JSON.stringify(generateChain(1000, 900, 0.4, 0.2, 'f9e85508bc0740a384cef087702415d3'));
fs_1.default.writeFile("out.json", result, function (err) {
    if (err)
        return console.log(err);
    //console.log(`${outIR} > examples/out.ll`);
});
