import * as assert from 'assert';
import { Segment } from 'mote/editor/common/core/segment';
import { ISegment } from 'mote/editor/common/segmentUtils';

suite('Editor Core - Segment', () => {

	test('segment merge', () => {
		const segments: ISegment[] = [['1'], ['2']];
		const result = Segment.merge(segments, { startIndex: 0, endIndex: 2, lineNumber: 0 }, ['c']);
		assert.equal(result.length, 1, 'Merge segments with same annotations will combine it');
		assert.deepEqual(result, [['12', [['c']]]]);
	});
});
