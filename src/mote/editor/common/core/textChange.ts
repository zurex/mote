import * as buffer from 'mote/base/common/buffer';
import { decodeUTF16LE } from 'mote/editor/common/core/stringBuilder';
import {
	Diff,
	DIFF_EQUAL,
	DIFF_INSERT,
	DiffMatchPatch
} from 'mote/editor/common/diffMatchPatch';
import { TextSelection } from './selectionUtils';

const diffMatchPatch = new DiffMatchPatch();

interface DiffCypher {
	count: number;
	encoding: { [key: string]: string };
	decoding: { [key: string]: string };
}

function decodeText(encodedString: string, cypher: DiffCypher) {
	return encodedString.split('').map(char => cypher.decoding[char]).join('');
}

function encodeText(text: string, cypher: DiffCypher) {
	const encodingValues = Array.from(text).map(char => {
		let encoding = cypher.encoding[char];
		if (encoding) {
			return encoding;
		}
		encoding = String.fromCharCode(cypher.count);
		cypher.count++;
		cypher.encoding[char] = encoding;
		cypher.decoding[encoding] = char;
		return encoding;
	});
	if (cypher.count > 65535) {
		throw new Error('Reached diff chat limit');
	}
	return {
		cypher: cypher,
		encodedString: encodingValues.join('')
	};
}

/**
 * Diff text and return diff result
 * @param oldValue
 * @param newValue
 * @returns Diff result
 */
function diffValue(oldValue: string, newValue: string): Diff[] {
	const oldValueEncoded = encodeText(oldValue, {
		count: 0,
		encoding: {},
		decoding: {}
	});
	const oldEncodedString = oldValueEncoded.encodedString;
	const newValuedEncoded = encodeText(newValue, oldValueEncoded.cypher);
	const diffResult: Diff[] = diffMatchPatch.diffMain(oldEncodedString, newValuedEncoded.encodedString);
	return diffResult.map(diff => {
		const op = diff[0];
		const encodedStr = diff[1];
		//const [op, encodedStr] = diff;
		return [op, decodeText(encodedStr, newValuedEncoded.cypher)] as Diff;
	}).filter(diff => {
		const [_, decodedStr] = diff;
		return '' !== decodedStr;
	});
}

export function textChange(selection: TextSelection, oldValue: string, newValue: string) {
	const diffResult = diffValue(oldValue, newValue);

	let bias = 0;
	for (let index = 0; index < diffResult.length; index++) {
		const diff = diffResult[index];
		const diffIndex = bias + diff[1].length;
		if (diffIndex > selection.startIndex) {
			if (DIFF_EQUAL === diff[0]) {
				const prevDiff = diffResult[index - 1];
				const nextDiff = diffResult[index + 1];
				let beforePrevDiff = diffResult[index - 2];
				let afterNextDiff = diffResult[index + 2];

				if (nextDiff && DIFF_INSERT === nextDiff[0]) {
					if (!afterNextDiff) {
						afterNextDiff = [DIFF_EQUAL, ''];
						diffResult.push(afterNextDiff);
					}
					while (diffIndex > selection.startIndex && diff[1].endsWith(nextDiff[1])) {
						diff[1] = diff[1].slice(0, diff[1].length - nextDiff[1].length);
						afterNextDiff[1] = nextDiff[1] + afterNextDiff[1];
					}
				}
				// Merge with prevDiff
				else if (prevDiff && DIFF_INSERT === prevDiff[0]) {
					if (!beforePrevDiff) {
						beforePrevDiff = [DIFF_EQUAL, ''];
						diffResult.push(beforePrevDiff);
					}
					while (diffIndex > selection.startIndex && diff[1].endsWith(prevDiff[1])) {
						diff[1] = diff[1].slice(prevDiff[1].length);
						beforePrevDiff[1] = beforePrevDiff[1] + prevDiff[1];
						bias -= prevDiff[1].length;
					}
				}
			}
			break;
		}
		bias += diff[1].length;
	}

	return diffResult;
}

function escapeNewLine(str: string): string {
	return (
		str
			.replace(/\n/g, '\\n')
			.replace(/\r/g, '\\r')
	);
}

export class TextChange {

	public get oldLength(): number {
		return this.oldText.length;
	}

	public get oldEnd(): number {
		return this.oldPosition + this.oldText.length;
	}

	public get newLength(): number {
		return this.newText.length;
	}

	public get newEnd(): number {
		return this.newPosition + this.newText.length;
	}

	constructor(
		public readonly oldPosition: number,
		public readonly oldText: string,
		public readonly newPosition: number,
		public readonly newText: string
	) { }

	public toString(): string {
		if (this.oldText.length === 0) {
			return `(insert@${this.oldPosition} "${escapeNewLine(this.newText)}")`;
		}
		if (this.newText.length === 0) {
			return `(delete@${this.oldPosition} "${escapeNewLine(this.oldText)}")`;
		}
		return `(replace@${this.oldPosition} "${escapeNewLine(this.oldText)}" with "${escapeNewLine(this.newText)}")`;
	}

	private static _writeStringSize(str: string): number {
		return (
			4 + 2 * str.length
		);
	}

	private static _writeString(b: Uint8Array, str: string, offset: number): number {
		const len = str.length;
		buffer.writeUInt32BE(b, len, offset); offset += 4;
		for (let i = 0; i < len; i++) {
			buffer.writeUInt16LE(b, str.charCodeAt(i), offset); offset += 2;
		}
		return offset;
	}

	private static _readString(b: Uint8Array, offset: number): string {
		const len = buffer.readUInt32BE(b, offset); offset += 4;
		return decodeUTF16LE(b, offset, len);
	}

	public writeSize(): number {
		return (
			+ 4 // oldPosition
			+ 4 // newPosition
			+ TextChange._writeStringSize(this.oldText)
			+ TextChange._writeStringSize(this.newText)
		);
	}

	public write(b: Uint8Array, offset: number): number {
		buffer.writeUInt32BE(b, this.oldPosition, offset); offset += 4;
		buffer.writeUInt32BE(b, this.newPosition, offset); offset += 4;
		offset = TextChange._writeString(b, this.oldText, offset);
		offset = TextChange._writeString(b, this.newText, offset);
		return offset;
	}

	public static read(b: Uint8Array, offset: number, dest: TextChange[]): number {
		const oldPosition = buffer.readUInt32BE(b, offset); offset += 4;
		const newPosition = buffer.readUInt32BE(b, offset); offset += 4;
		const oldText = TextChange._readString(b, offset); offset += TextChange._writeStringSize(oldText);
		const newText = TextChange._readString(b, offset); offset += TextChange._writeStringSize(newText);
		dest.push(new TextChange(oldPosition, oldText, newPosition, newText));
		return offset;
	}
}
