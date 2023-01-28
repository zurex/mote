import { IMoteEditor } from 'mote/editor/browser/editorBrowser';
import { AbstractMoteEditorService } from 'mote/editor/browser/services/abstractMoteEditorService';
import { IMoteEditorService } from 'mote/editor/browser/services/moteEditorService';
import { IEditorService } from 'mote/workbench/services/editor/common/editorService';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';

export class MoteEditorService extends AbstractMoteEditorService {

	constructor(
		@IEditorService private readonly editorService: IEditorService,
	) {
		super();
	}
	public getActiveMoteEditor(): IMoteEditor | null {
		const activeEditorControl = this.editorService.activeEditorControl;
		return activeEditorControl as IMoteEditor;
	}
}

registerSingleton(IMoteEditorService, MoteEditorService);
