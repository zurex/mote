import { IResourceEditorInput } from 'mote/platform/editor/common/editor';
import { IEditorPane } from 'mote/workbench/common/editor';
import { EditorInput } from 'mote/workbench/common/editorInput';
import { IEditorService } from 'mote/workbench/services/editor/common/editorService';

export class EditorService implements IEditorService {

	declare readonly _serviceBrand: undefined;

	openEditor(editor: EditorInput): Promise<IEditorPane | undefined> {
		throw new Error('Method not implemented.');
	}
	openEditorWithResource(editor: IResourceEditorInput): Promise<IEditorPane | undefined> {
		throw new Error('Method not implemented.');
	}
	closeEditor(editor?: EditorInput | undefined): Promise<boolean> {
		throw new Error('Method not implemented.');
	}

}
