/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { stripIcons } from 'mote/base/common/iconLabels';
import { IEditor } from 'mote/editor/common/editorCommon';
import { ICommandService } from 'mote/platform/commands/common/commands';
import { IDialogService } from 'mote/platform/dialogs/common/dialogs';
import { IInstantiationService } from 'mote/platform/instantiation/common/instantiation';
import { IKeybindingService } from 'mote/platform/keybinding/common/keybinding';
import { AbstractCommandsQuickAccessProvider, ICommandQuickPick, ICommandsQuickAccessOptions } from 'mote/platform/quickinput/browser/commandsQuickAccess';

export abstract class AbstractEditorCommandsQuickAccessProvider extends AbstractCommandsQuickAccessProvider {

	constructor(
		options: ICommandsQuickAccessOptions,
		instantiationService: IInstantiationService,
		keybindingService: IKeybindingService,
		commandService: ICommandService,
		//telemetryService: ITelemetryService,
		dialogService: IDialogService
	) {
		super(options, instantiationService, keybindingService, commandService, /*telemetryService, */ dialogService);
	}

	/**
	 * Subclasses to provide the current active editor control.
	 */
	protected abstract activeTextEditorControl: IEditor | undefined;

	protected getMoteEditorCommandPicks(): ICommandQuickPick[] {
		const activeTextEditorControl = this.activeTextEditorControl;
		if (!activeTextEditorControl) {
			return [];
		}

		const editorCommandPicks: ICommandQuickPick[] = [];
		for (const editorAction of activeTextEditorControl.getSupportedActions()) {
			editorCommandPicks.push({
				commandId: editorAction.id,
				commandAlias: editorAction.alias,
				label: stripIcons(editorAction.label) || editorAction.id,
			});
		}

		return editorCommandPicks;
	}
}
