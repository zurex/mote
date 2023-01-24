import { Emitter, Event } from 'mote/base/common/event';
import { Disposable } from 'mote/base/common/lifecycle';
import { IMoteEditor } from 'mote/editor/browser/editorBrowser';
import { IMoteEditorService } from 'mote/editor/browser/services/moteEditorService';

export abstract class AbstractMoteEditorService extends Disposable implements IMoteEditorService {

	declare readonly _serviceBrand: undefined;

	private readonly _onMoteEditorAdd: Emitter<IMoteEditor> = this._register(new Emitter<IMoteEditor>());
	public readonly onMoteEditorAdd: Event<IMoteEditor> = this._onMoteEditorAdd.event;

	private readonly _onMoteEditorRemove: Emitter<IMoteEditor> = this._register(new Emitter<IMoteEditor>());
	public readonly onMoteEditorRemove: Event<IMoteEditor> = this._onMoteEditorRemove.event;

	private readonly moteEditors: { [editorId: string]: IMoteEditor };

	constructor() {
		super();

		this.moteEditors = Object.create(null);
	}

	public addMoteEditor(editor: IMoteEditor): void {
		this.moteEditors[editor.getId()] = editor;
		this._onMoteEditorAdd.fire(editor);
	}

	public removeMoteEditor(editor: IMoteEditor): void {
		if (delete this.moteEditors[editor.getId()]) {
			this._onMoteEditorRemove.fire(editor);
		}
	}

	public listMoteEditors(): IMoteEditor[] {
		return Object.keys(this.moteEditors).map(id => this.moteEditors[id]);
	}


	public getFocusedMoteEditor(): IMoteEditor | null {
		let editorWithWidgetFocus: IMoteEditor | null = null;

		const editors = this.listMoteEditors();
		for (const editor of editors) {

			if (editor.hasTextFocus()) {
				// bingo!
				return editor;
			}

			if (editor.hasWidgetFocus()) {
				editorWithWidgetFocus = editor;
			}
		}

		return editorWithWidgetFocus;
	}

	public abstract getActiveMoteEditor(): IMoteEditor | null;
}
