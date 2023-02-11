import { IDisposable } from 'mote/base/common/lifecycle';
import { URI } from 'mote/base/common/uri';
import * as model from 'mote/editor/common/model';
import { TextBuffer } from 'mote/editor/common/model/textBuffer';
import { AbstractTextModel } from 'mote/editor/common/model/textModel';
import BlockStore from 'mote/platform/store/common/blockStore';

export class StoreBasedTextModel extends AbstractTextModel implements model.ITextModel {

	constructor(
		private pageStore: BlockStore
	) {
		const associatedResource = URI.from({ scheme: 'mote', path: 'model/' + pageStore.id });
		super({}, associatedResource);
		this.initialize();
	}

	createTextBuffer(): [model.ITextBuffer, IDisposable] {
		return [new TextBuffer(this.pageStore), { dispose: () => { } }];
	}
}
