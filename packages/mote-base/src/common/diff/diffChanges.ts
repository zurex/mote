import { 
    Diff, 
    DIFF_DELETE,
    DIFF_EQUAL,
    DIFF_INSERT } from "diff-match-patch";
import { decodeText, diffMatchPatch, encodeText } from "./diff";

export enum DiffChangeType {
    Delete = DIFF_DELETE,
    Insert = DIFF_INSERT,
    Equal = DIFF_EQUAL
}

export interface IDiffChange {
    type: DiffChangeType;
    value: string;
}


export function diffText(origin: string, target: string): IDiffChange[] {
    // diff changes
    const originEncoded = encodeText(origin, { count: 0, encoding: {}, decoding: {} });
    const originEncodedText = originEncoded.encodedText;

    const targetEncoded = encodeText(target, originEncoded.cypher);
    const targetEncodedText = targetEncoded.encodedText;

    const diffs = diffMatchPatch.diff_main(originEncodedText, targetEncodedText);
    return diffs.map((diff: Diff) => {
        const [op, encodedText] = diff;
        return { type: op, value: decodeText(encodedText, targetEncoded.cypher) };
    });
}