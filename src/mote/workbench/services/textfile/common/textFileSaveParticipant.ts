/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'mote/nls';
import { raceCancellation } from 'mote/base/common/async';
import { CancellationTokenSource, CancellationToken } from 'mote/base/common/cancellation';
import { ILogService } from 'mote/platform/log/common/log';
import { IProgressService, ProgressLocation } from 'mote/platform/progress/common/progress';
import { ITextFileSaveParticipant, ITextFileEditorModel } from 'mote/workbench/services/textfile/common/textfiles';
import { SaveReason } from 'mote/workbench/common/editor';
import { IDisposable, Disposable, toDisposable } from 'mote/base/common/lifecycle';
import { insert } from 'mote/base/common/arrays';

export class TextFileSaveParticipant extends Disposable {

	private readonly saveParticipants: ITextFileSaveParticipant[] = [];

	constructor(
		@IProgressService private readonly progressService: IProgressService,
		@ILogService private readonly logService: ILogService
	) {
		super();
	}

	addSaveParticipant(participant: ITextFileSaveParticipant): IDisposable {
		const remove = insert(this.saveParticipants, participant);

		return toDisposable(() => remove());
	}

	participate(model: ITextFileEditorModel, context: { reason: SaveReason }, token: CancellationToken): Promise<void> {
		const cts = new CancellationTokenSource(token);

		return this.progressService.withProgress({
			title: localize('saveParticipants', "Saving '{0}'", model.name),
			location: ProgressLocation.Notification,
			cancellable: true,
			delay: model.isDirty() ? 3000 : 5000
		}, async progress => {

			// undoStop before participation
			model.textEditorModel?.pushStackElement();

			for (const saveParticipant of this.saveParticipants) {
				if (cts.token.isCancellationRequested || !model.textEditorModel /* disposed */) {
					break;
				}

				try {
					const promise = saveParticipant.participate(model, context, progress, cts.token);
					await raceCancellation(promise, cts.token);
				} catch (err) {
					this.logService.error(err);
				}
			}

			// undoStop after participation
			model.textEditorModel?.pushStackElement();
		}, () => {
			// user cancel
			cts.dispose(true);
		});
	}

	override dispose(): void {
		this.saveParticipants.splice(0, this.saveParticipants.length);
	}
}
