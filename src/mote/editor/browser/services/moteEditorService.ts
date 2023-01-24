
import { Event } from 'mote/base/common/event';
import { IMoteEditor } from 'mote/editor/browser/editorBrowser';
import { createDecorator } from 'mote/platform/instantiation/common/instantiation';

export const IMoteEditorService = createDecorator<IMoteEditorService>('moteEditorService');

export interface IMoteEditorService {

	readonly _serviceBrand: undefined;

	readonly onMoteEditorAdd: Event<IMoteEditor>;
	readonly onMoteEditorRemove: Event<IMoteEditor>;

	addMoteEditor(editor: IMoteEditor): void;
	removeMoteEditor(editor: IMoteEditor): void;

	/**
	 * Returns the current focused mote editor (if the focus is in the editor or in an editor widget) or null.
	 */
	getFocusedMoteEditor(): IMoteEditor | null;


	getActiveMoteEditor(): IMoteEditor | null;
}
