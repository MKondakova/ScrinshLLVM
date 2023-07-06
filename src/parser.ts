import {Schema} from "./types";

export function parseSchema(schemaJSON: string): Schema | null {
    try {
        return JSON.parse(schemaJSON) as Schema;
    } catch (e: any) {
        console.log(e.toString())
    }
    return null;
}

