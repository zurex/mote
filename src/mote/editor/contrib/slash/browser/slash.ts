/*---------------------------------------------------------------------------------------------
 * Copyright (c) Mote team. All rights reserved.
 *  Licensed under the GPLv3 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMoteEditor } from 'mote/editor/browser/editorBrowser';
import { EditorAction, EditorCommand, registerEditorAction, registerEditorContribution } from 'mote/editor/browser/editorExtensions';
import { IEditorContribution } from 'mote/editor/common/editorCommon';
import { IKeybindingService } from 'mote/platform/keybinding/common/keybinding';
import { IInstantiationService, ServicesAccessor } from 'mote/platform/instantiation/common/instantiation';

export class SlashController implements IEditorContribution {

	public static readonly ID = 'editor.contrib.slashController';

	static get(editor: IMoteEditor): SlashController | null {
		return editor.getContribution<SlashController>(SlashController.ID);
	}

	constructor(
		public readonly editor: IMoteEditor,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IKeybindingService keybinddingService: IKeybindingService
	) {

	}

	public showSlashCommandsMenu() {

	}

	dispose(): void {

	}

}


export class SlashAction extends EditorAction {
	public run(accessor: ServicesAccessor, editor: IMoteEditor, args: any): void | Promise<void> {
		throw new Error('Method not implemented.');
	}

	constructor() {
		super({
			id: 'editor.action.slash',
			precondition: undefined,
			label: '',
			alias: ''
		});
	}

	public override runCommand(accessor: ServicesAccessor, args: any): void | Promise<void> {
		throw new Error('Method not implemented.');
	}

	public override runEditorCommand(accessor: ServicesAccessor | null, editor: IMoteEditor, args: any): void | Promise<void> {
		throw new Error('Method not implemented.');
	}
}

registerEditorContribution(SlashController.ID, SlashController);
registerEditorAction(SlashAction);

export const SlashCommand = EditorCommand.bindToContribution<SlashController>(SlashController.get);
