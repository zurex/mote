import * as assert from 'assert';
import { LineTokens } from 'mote/editor/common/tokens/lineTokens';
import { MetadataConsts } from 'mote/editor/common/encodedTokenAttributes';
import { ISegment } from 'mote/editor/common/segmentUtils';

suite('LineTokens', () => {

	interface ILineToken {
		startIndex: number;
		foreground: number;
	}

	function createLineTokens(text: string, tokens: ILineToken[]): LineTokens {
		const binTokens = new Uint32Array(tokens.length << 1);

		for (let i = 0, len = tokens.length; i < len; i++) {
			binTokens[(i << 1)] = (i + 1 < len ? tokens[i + 1].startIndex : text.length);
			binTokens[(i << 1) + 1] = (
				tokens[i].foreground << MetadataConsts.FOREGROUND_OFFSET
			) >>> 0;
		}

		return new LineTokens(binTokens, text);
	}

	function createTestLineTokens(): LineTokens {
		return createLineTokens(
			'Hello world, this is a lovely day',
			[
				{ startIndex: 0, foreground: 1 }, // Hello_
				{ startIndex: 6, foreground: 2 }, // world,_
				{ startIndex: 13, foreground: 3 }, // this_
				{ startIndex: 18, foreground: 4 }, // is_
				{ startIndex: 21, foreground: 5 }, // a_
				{ startIndex: 23, foreground: 6 }, // lovely_
				{ startIndex: 30, foreground: 7 }, // day
			]
		);
	}

	function renderLineTokens(tokens: LineTokens): string {
		let result = '';
		const str = tokens.getLineContent();
		let lastOffset = 0;
		for (let i = 0; i < tokens.getCount(); i++) {
			result += str.substring(lastOffset, tokens.getEndOffset(i));
			result += `(${tokens.getMetadata(i)})`;
			lastOffset = tokens.getEndOffset(i);
		}
		return result;
	}

	test('from segments', () => {
		const segments: ISegment[] = [['Hello '], ['world', [['b']]]];
		const lineTokens = LineTokens.fromSegments(segments);
		const result = renderLineTokens(lineTokens);
		assert.strictEqual(result, 'Hello (0)world(4096)');
		assert.equal(lineTokens.getCount(), segments.length);
		assert.equal(lineTokens.getEndOffset(0), 6);
		assert.equal(lineTokens.getEndOffset(1), 11);
	});

	test('withInserted 1', () => {
		const lineTokens = createTestLineTokens();
		assert.strictEqual(renderLineTokens(lineTokens), 'Hello (32768)world, (65536)this (98304)is (131072)a (163840)lovely (196608)day(229376)');

		const lineTokens2 = lineTokens.withInserted([
			{ offset: 0, text: '1', tokenMetadata: 0, },
			{ offset: 6, text: '2', tokenMetadata: 0, },
			{ offset: 9, text: '3', tokenMetadata: 0, },
		]);

		assert.strictEqual(renderLineTokens(lineTokens2), '1(0)Hello (32768)2(0)wor(65536)3(0)ld, (65536)this (98304)is (131072)a (163840)lovely (196608)day(229376)');
	});
});
