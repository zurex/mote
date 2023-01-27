import * as assert from 'assert';
import { FastDomNode } from 'mote/base/browser/fastDomNode';
import { IViewLineContribution } from 'mote/editor/browser/editorBrowser';
import { renderSegments } from 'mote/editor/browser/textRenderer';
import { CharacterMapping, DomPosition, RenderLineInput, renderViewLine } from 'mote/editor/browser/viewParts/lines/viewLineRenderer';
import { EditOperation } from 'mote/editor/common/core/editOperation';
import { StringBuilder } from 'mote/editor/common/core/stringBuilder';
import { Transaction } from 'mote/editor/common/core/transaction';
import { Segment } from 'mote/editor/common/segment';
import { ViewLineRenderingData } from 'mote/editor/common/viewModel';
import BlockStore from 'mote/platform/store/common/blockStore';
import { Pointer } from 'mote/platform/store/common/record';
import RecordCacheStore from 'mote/platform/store/common/recordCacheStore';
import { IStoreService } from 'mote/platform/store/common/store';
import { StoreUtils } from 'mote/platform/store/common/storeUtils';

class TestStoreService implements IStoreService {
	addSubscription(userId: string, pointer: Pointer): void {
	}

}

const storeService = new TestStoreService();

class TestViewBlock implements IViewLineContribution {
	setValue(store: BlockStore, lineData?: ViewLineRenderingData | undefined): void {
		throw new Error('Method not implemented.');
	}
	getDomNode(): FastDomNode<HTMLElement> {
		throw new Error('Method not implemented.');
	}
	render(store: BlockStore, lineData?: ViewLineRenderingData): string {
		const segments = store.getTitleStore().getValue() || [];
		return renderSegments(segments.map(Segment.from)).join('');
	}
}

suite('viewLineRenderer.renderLine', () => {

	function assertParts(lineContent: string, tabSize: number, parts: any[], expected: string, info: CharacterMappingInfo[]): void {
		const sb = new StringBuilder(10000);
		const block = new TestViewBlock();
		const store = createStoreWithText([lineContent]);
		const lineStore = StoreUtils.createStoreForLineNumber(1, store.getContentStore());
		const _actual = renderViewLine(new RenderLineInput(
			lineStore,
			1,
			false,
			true,
			lineContent,
			false,
			true,
			false,
			0,
			[] as any,
			tabSize,
			0,
			0,
			0,
			0,
			-1,
			'none',
			false,
			false,
			null,
		), block, sb);

		const html = sb.build();

		assert.strictEqual(html, expected);
		assertCharacterMapping3(_actual.characterMapping, info);
	}

	test('empty line', () => {
		assertParts('', 4, [], '', []);
	});

	test('alpha line', () => {
		assertParts('a', 4, [], 'a', [[0, [0, 0]], [1, [0, 1]]]);
	});

	type CharacterMappingInfo = [number, [number, number]];

	function assertCharacterMapping3(actual: CharacterMapping, expectedInfo: CharacterMappingInfo[]): void {
		for (let i = 0; i < expectedInfo.length; i++) {
			const [horizontalOffset, [partIndex, charIndex]] = expectedInfo[i];

			const actualDomPosition = actual.getDomPosition(i + 1);
			assert.deepStrictEqual(actualDomPosition, new DomPosition(partIndex, charIndex), `getDomPosition(${i + 1})`);

			let partLength = charIndex + 1;
			for (let j = i + 1; j < expectedInfo.length; j++) {
				const [, [nextPartIndex, nextCharIndex]] = expectedInfo[j];
				if (nextPartIndex === partIndex) {
					partLength = nextCharIndex + 1;
				} else {
					break;
				}
			}

			const actualColumn = actual.getColumn(new DomPosition(partIndex, charIndex), partLength);
			assert.strictEqual(actualColumn, i + 1, `actual.getColumn(${partIndex}, ${charIndex})`);

			const actualHorizontalOffset = actual.getHorizontalOffset(i + 1);
			assert.strictEqual(actualHorizontalOffset, horizontalOffset, `actual.getHorizontalOffset(${i + 1})`);
		}

		assert.strictEqual(actual.length, expectedInfo.length, `length mismatch`);
	}
});

function createStoreWithText(text: string[]) {
	const table = 'page';
	const userId = '1';
	const pageId = '1';
	const store = new BlockStore({ table, id: userId }, pageId, [], RecordCacheStore.Default, storeService);
	const contentStore = store.getContentStore();
	Transaction.createAndCommit((transaction) => {
		text.forEach((value) => {
			// create a new block
			let child: BlockStore = EditOperation.createBlockStore('text', transaction, contentStore);
			child = EditOperation.appendToParent(contentStore, child, transaction).child as BlockStore;

			// update block content
			EditOperation.addSetOperationForStore(child.getTitleStore(), [[value]], transaction);

		});
		return store;
	}, userId);
	return store;
}
