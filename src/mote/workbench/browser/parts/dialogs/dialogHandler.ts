/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'mote/nls';
import { IDialogOptions, IConfirmation, IConfirmationResult, DialogType, IShowResult, IInputResult, ICheckbox, IInput, IDialogHandler, ICustomDialogOptions } from 'mote/platform/dialogs/common/dialogs';
import { ILayoutService } from 'mote/platform/layout/browser/layoutService';
import { ILogService } from 'mote/platform/log/common/log';
import Severity from 'mote/base/common/severity';
import { Dialog, IDialogResult } from 'mote/base/browser/ui/dialog/dialog';
import { IThemeService } from 'mote/platform/theme/common/themeService';
import { DisposableStore } from 'mote/base/common/lifecycle';
import { StandardKeyboardEvent } from 'mote/base/browser/keyboardEvent';
import { IProductService } from 'mote/platform/product/common/productService';
import { fromNow } from 'mote/base/common/date';
import { IInstantiationService } from 'mote/platform/instantiation/common/instantiation';
import { Color, RGBA } from 'mote/base/common/color';

export class BrowserDialogHandler implements IDialogHandler {

	constructor(
		@ILogService private readonly logService: ILogService,
		@ILayoutService private readonly layoutService: ILayoutService,
		@IThemeService themeService: IThemeService,
		//@IKeybindingService private readonly keybindingService: IKeybindingService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IProductService private readonly productService: IProductService,
		//@IClipboardService private readonly clipboardService: IClipboardService
	) {

	}

	async confirm(confirmation: IConfirmation): Promise<IConfirmationResult> {
		this.logService.trace('DialogService#confirm', confirmation.message);

		const buttons: string[] = [];
		if (confirmation.primaryButton) {
			buttons.push(confirmation.primaryButton);
		} else {
			buttons.push(localize({ key: 'yesButton', comment: ['&& denotes a mnemonic'] }, "&&Yes"));
		}

		if (confirmation.secondaryButton) {
			buttons.push(confirmation.secondaryButton);
		} else if (typeof confirmation.secondaryButton === 'undefined') {
			buttons.push(localize('cancelButton', "Cancel"));
		}

		const result = await this.doShow(confirmation.type, confirmation.message, buttons, confirmation.detail, 1, confirmation.checkbox);

		return { confirmed: result.button === 0, checkboxChecked: result.checkboxChecked };
	}

	private getDialogType(severity: Severity): DialogType {
		return (severity === Severity.Info) ? 'question' : (severity === Severity.Error) ? 'error' : (severity === Severity.Warning) ? 'warning' : 'none';
	}

	async show(severity: Severity, message: string, buttons?: string[], options?: IDialogOptions): Promise<IShowResult> {
		this.logService.trace('DialogService#show', message);

		const result = await this.doShow(this.getDialogType(severity), message, buttons, options?.detail, options?.cancelId, options?.checkbox, undefined, typeof options?.custom === 'object' ? options.custom : undefined);

		return {
			choice: result.button,
			checkboxChecked: result.checkboxChecked
		};
	}

	private async doShow(type: 'none' | 'info' | 'error' | 'question' | 'warning' | 'pending' | undefined, message: string, buttons?: string[], detail?: string, cancelId?: number, checkbox?: ICheckbox, inputs?: IInput[], customOptions?: ICustomDialogOptions): Promise<IDialogResult> {
		const dialogDisposables = new DisposableStore();

		const renderBody = customOptions ? (parent: HTMLElement) => {
			parent.classList.add(...(customOptions.classes || []));
			/*
			customOptions.markdownDetails?.forEach(markdownDetail => {
				const result = this.markdownRenderer.render(markdownDetail.markdown);
				parent.appendChild(result.element);
				result.element.classList.add(...(markdownDetail.classes || []));
				dialogDisposables.add(result);
			});
			*/
		} : undefined;

		const dialog = new Dialog(
			this.layoutService.container,
			message,
			buttons,
			{
				detail,
				cancelId,
				type,
				keyEventProcessor: (event: StandardKeyboardEvent) => {
					/*
					const resolved = this.keybindingService.softDispatch(event, this.layoutService.container);
					if (resolved?.commandId) {
						if (BrowserDialogHandler.ALLOWABLE_COMMANDS.indexOf(resolved.commandId) === -1) {
							EventHelper.stop(event, true);
						}
					}
					*/
				},
				renderBody,
				icon: customOptions?.icon,
				disableCloseAction: customOptions?.disableCloseAction,
				buttonDetails: customOptions?.buttonDetails,
				checkboxLabel: checkbox?.label,
				checkboxChecked: checkbox?.checked,
				inputs
			});

		dialogDisposables.add(dialog);
		//dialogDisposables.add(attachDialogStyler(dialog, this.themeService));
		dialog.style({
			dialogBackground: new Color(new RGBA(37, 37, 38))
		});

		const result = await dialog.show();
		dialogDisposables.dispose();

		return result;
	}

	async input(severity: Severity, message: string, buttons: string[], inputs: IInput[], options?: IDialogOptions): Promise<IInputResult> {
		this.logService.trace('DialogService#input', message);

		const result = await this.doShow(this.getDialogType(severity), message, buttons, options?.detail, options?.cancelId, options?.checkbox, inputs);

		return {
			choice: result.button,
			checkboxChecked: result.checkboxChecked,
			values: result.values
		};
	}

	async about(): Promise<void> {
		const detailString = (useAgo: boolean): string => {
			return localize('aboutDetail',
				"Version: {0}\nCommit: {1}\nDate: {2}\nBrowser: {3}",
				this.productService.version || 'Unknown',
				this.productService.commit || 'Unknown',
				this.productService.date ? `${this.productService.date}${useAgo ? ' (' + fromNow(new Date(this.productService.date), true) + ')' : ''}` : 'Unknown',
				navigator.userAgent
			);
		};

		const detail = detailString(true);
		const detailToCopy = detailString(false);


		const { choice } = await this.show(Severity.Info, this.productService.nameLong, [localize('copy', "Copy"), localize('ok', "OK")], { detail, cancelId: 1 });

		if (choice === 0) {
			console.log(detailToCopy);
			//this.writeText(detailToCopy);
		}
	}
}
