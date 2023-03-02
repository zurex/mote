import { Disposable } from 'mote/base/common/lifecycle';
import { URI } from 'mote/base/common/uri';
import { NotebookBlockTextModel } from 'mote/workbench/contrib/notebook/common/model/notebookBlockTextModel';
import { INotebookTextModel } from 'mote/workbench/contrib/notebook/common/notebookCommon';

export class NotebookTextModel extends Disposable implements INotebookTextModel {

	private _blocks: NotebookBlockTextModel[] = [];

	private _versionId = 0;

	/**
	 * This alternative id is only for non-cell-content changes.
	 */
	private _notebookSpecificAlternativeId = 0;

	/**
	 * Unlike, versionId, this can go down (via undo) or go to previous values (via redo)
	 */
	private _alternativeVersionId: string = '1';

	get length() {
		return this.blocks.length;
	}

	get blocks(): readonly NotebookBlockTextModel[] {
		return this._blocks;
	}

	get versionId() {
		return this._versionId;
	}

	get alternativeVersionId(): string {
		return this._alternativeVersionId;
	}

	constructor(
		readonly viewType: string,
		readonly uri: URI,
	) {
		super();
	}
}
