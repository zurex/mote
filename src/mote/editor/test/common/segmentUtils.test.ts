import * as assert from 'assert';
import * as segmentUtils from 'mote/editor/common/segmentUtils';
import { ISegment } from 'mote/editor/common/segmentUtils';

suite('Editor Common - SegmentUtils', () => {
	test('merge segments', () => {
		const before: ISegment[] = [['123']];
		let record: ISegment[] = [['abc']];

		// case: merge without annotations
		let result = segmentUtils.merge(before, record, 3);
		assert.equal('123abc', segmentUtils.collectValueFromSegment(result));
		assert.equal(1, result.length, 'Merge with same annotation should not change the segments length');

		// case: merge with different annotations
		record = [['abc', [['c']]]];
		result = segmentUtils.merge(before, record, 3);
		assert.equal('123abc', segmentUtils.collectValueFromSegment(result));
		assert.equal(2, result.length, 'Merge with different annotation should change the segments length');
	});
});
