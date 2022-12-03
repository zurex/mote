/*---------------------------------------------------------------------------------------------
 * Copyright (c) Mote team. All rights reserved.
 *  Licensed under the GPLv3 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMoteEditor } from 'mote/editor/browser/editorBrowser';
import { EditorAction, EditorCommand, registerEditorAction, registerEditorContribution } from 'mote/editor/browser/editorExtensions';
import { IEditorContribution } from 'mote/editor/common/editorCommon';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';

class SlashController implements IEditorContribution {

	public static readonly ID = 'editor.contrib.slashController';

	static get(editor: IMoteEditor): SlashController | null {
		return editor.getContribution<SlashController>(SlashController.ID);
	}

	dispose(): void {
		throw new Error('Method not implemented.');
	}

}


export class SlashAction extends EditorAction {

	constructor() {
		super({
			id: 'editor.action.slash',
			precondition: undefined,
		});
	}

	public override runCommand(accessor: ServicesAccessor, args: any): void | Promise<void> {
		throw new Error('Method not implemented.');
	}

	public runEditorCommand(accessor: ServicesAccessor | null, editor: IMoteEditor, args: any): void | Promise<void> {
		throw new Error('Method not implemented.');
	}
}

registerEditorContribution(SlashController.ID, SlashController);
registerEditorAction(SlashAction);

export const SlashCommand = EditorCommand.bindToContribution<SlashController>(SlashController.get);
