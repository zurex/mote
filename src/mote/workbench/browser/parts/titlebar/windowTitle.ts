import { localize } from 'mote/nls';
import { RunOnceScheduler } from 'mote/base/common/async';
import { Emitter } from 'mote/base/common/event';
import { Disposable, DisposableStore } from 'mote/base/common/lifecycle';
import { isWindows } from 'mote/base/common/platform';
import { ITitleProperties } from 'mote/workbench/services/title/common/titleService';

const enum WindowSettingNames {
	titleSeparator = 'window.titleSeparator',
	title = 'window.title',
}

export class WindowTitle extends Disposable {

	private static readonly NLS_USER_IS_ADMIN = isWindows ? localize('userIsAdmin', "[Administrator]") : localize('userIsSudo', "[Superuser]");
	private static readonly NLS_EXTENSION_HOST = localize('devExtensionWindowTitlePrefix', "[Extension Development Host]");
	private static readonly TITLE_DIRTY = '\u25cf ';

	private readonly properties: ITitleProperties = { isPure: true, isAdmin: false, prefix: undefined };
	private readonly activeEditorListeners = this._register(new DisposableStore());
	private readonly titleUpdater = this._register(new RunOnceScheduler(() => this.doUpdateTitle(), 0));

	private readonly onDidChangeEmitter = new Emitter<void>();
	readonly onDidChange = this.onDidChangeEmitter.event;

	private title: string | undefined;

	private doUpdateTitle(): void {

	}
}
