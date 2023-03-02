import { Disposable } from 'mote/base/common/lifecycle';
import { URI } from 'mote/base/common/uri';
import { IReadonlyTextBuffer } from 'mote/editor/common/model';
import { BlockKind, IBlock, NotebookBlockMetadata } from 'mote/workbench/contrib/notebook/common/notebookCommon';

export class NotebookBlockTextModel extends Disposable implements IBlock {

	handle: number;
	metadata: NotebookBlockMetadata;
	blockKind: BlockKind;
	textBuffer: IReadonlyTextBuffer;

	constructor(
		readonly uri: URI
	) {
		super();
	}
}
