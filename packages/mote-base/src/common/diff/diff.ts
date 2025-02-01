import {
    diff_match_patch,
    Diff,
    DIFF_DELETE,
    DIFF_EQUAL,
    DIFF_INSERT
} from 'diff-match-patch';

export const diffMatchPatch = new diff_match_patch();

interface DiffCypher {
    count: number;
    encoding: Record<string, string>;
    decoding: Record<string, string>;
}

export function decodeText(text: string, cypher: DiffCypher): string {
    return text.split('').map((char) => cypher.decoding[char]).join('');
}

export function encodeText(text: string, cypher: DiffCypher) {
    const encodedText = text.split('').map((char) => {
        let encoding = cypher.encoding[char];
        if (!encoding) {
            encoding = String.fromCharCode(cypher.count);
            cypher.count++;
            cypher.encoding[char] = encoding;
            cypher.decoding[encoding] = char;
        }
        return encoding;
    });
    if (cypher.count > 65535) {
        throw new Error('Cypher limit reached');
    }
    return {
        cypher,
        encodedText: encodedText.join('')
    }
}