import { ISideBySideEditorInput } from 'mote/workbench/common/editor';
import { EditorInput } from 'mote/workbench/common/editorInput';

/**
 * Side by side editor inputs that have a primary and secondary side.
 */
export class SideBySideEditorInput extends EditorInput implements ISideBySideEditorInput {

	static readonly ID: string = 'workbench.editorinputs.sidebysideEditorInput';

	override get typeId(): string {
		return SideBySideEditorInput.ID;
	}

	constructor(
		readonly secondary: EditorInput,
		readonly primary: EditorInput,
	) {
		super();
	}
}
