"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSchema = void 0;
function parseSchema(schemaJSON) {
    try {
        return JSON.parse(schemaJSON);
    }
    catch (e) {
        console.log(e.toString());
    }
    return null;
}
exports.parseSchema = parseSchema;
