/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { setFullscreen } from 'mote/base/browser/browser';
import { addDisposableListener, addDisposableThrottledListener, detectFullscreen, EventHelper, EventType } from 'mote/base/browser/dom';
import { DomEmitter } from 'mote/base/browser/event';
import { timeout } from 'mote/base/common/async';
import { Event } from 'mote/base/common/event';
import { Disposable } from 'mote/base/common/lifecycle';
import { isIOS, isMacintosh } from 'mote/base/common/platform';
import { registerWindowDriver } from 'mote/platform/driver/browser/driver';
import { IBrowserWorkbenchEnvironmentService } from 'mote/workbench/services/environment/browser/environmentService';
import { IWorkbenchLayoutService } from 'mote/workbench/services/layout/browser/layoutService';
import { BrowserLifecycleService } from 'mote/workbench/services/lifecycle/browser/lifecycleService';
import { ILifecycleService } from 'mote/workbench/services/lifecycle/common/lifecycle';

export class BrowserWindow extends Disposable {

	constructor(
		@ILifecycleService private readonly lifecycleService: BrowserLifecycleService,
		@IBrowserWorkbenchEnvironmentService private readonly environmentService: IBrowserWorkbenchEnvironmentService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService
	) {
		super();

		this.registerListeners();
		this.create();
	}

	private registerListeners(): void {

		// Lifecycle
		this._register(this.lifecycleService.onWillShutdown(() => this.onWillShutdown()));

		// Layout
		const viewport = isIOS && window.visualViewport ? window.visualViewport /** Visual viewport */ : window /** Layout viewport */;
		this._register(addDisposableListener(viewport, EventType.RESIZE, () => {
			this.layoutService.layout();

			// Sometimes the keyboard appearing scrolls the whole workbench out of view, as a workaround scroll back into view #121206
			if (isIOS) {
				window.scrollTo(0, 0);
			}
		}));

		// Prevent the back/forward gestures in macOS
		this._register(addDisposableListener(this.layoutService.container, EventType.WHEEL, e => e.preventDefault(), { passive: false }));

		// Prevent native context menus in web
		this._register(addDisposableListener(this.layoutService.container, EventType.CONTEXT_MENU, e => EventHelper.stop(e, true)));

		// Prevent default navigation on drop
		this._register(addDisposableListener(this.layoutService.container, EventType.DROP, e => EventHelper.stop(e, true)));

		// Fullscreen (Browser)
		for (const event of [EventType.FULLSCREEN_CHANGE, EventType.WK_FULLSCREEN_CHANGE]) {
			this._register(addDisposableListener(document, event, () => setFullscreen(!!detectFullscreen())));
		}

		// Fullscreen (Native)
		this._register(addDisposableThrottledListener(viewport, EventType.RESIZE, () => {
			setFullscreen(!!detectFullscreen());
		}, undefined, isMacintosh ? 2000 /* adjust for macOS animation */ : 800 /* can be throttled */));
	}

	private onWillShutdown(): void {

		// Try to detect some user interaction with the workbench
		// when shutdown has happened to not show the dialog e.g.
		// when navigation takes a longer time.
		Event.toPromise(Event.any(
			Event.once(new DomEmitter(document.body, EventType.KEY_DOWN, true).event),
			Event.once(new DomEmitter(document.body, EventType.MOUSE_DOWN, true).event)
		)).then(async () => {

			// Delay the dialog in case the user interacted
			// with the page before it transitioned away
			await timeout(3000);

			// This should normally not happen, but if for some reason
			// the workbench was shutdown while the page is still there,
			// inform the user that only a reload can bring back a working
			// state.
			/*
			const res = await this.dialogService.show(
				Severity.Error,
				localize('shutdownError', "An unexpected error occurred that requires a reload of this page."),
				[
					localize('reload', "Reload")
				],
				{
					detail: localize('shutdownErrorDetail', "The workbench was unexpectedly disposed while running.")
				}
			);

			if (res.choice === 0) {
				window.location.reload(); // do not use any services at this point since they are likely not functional at this point
			}
			*/
		});
	}

	private create(): void {

		// Smoke Test Driver
		this.setupDriver();
	}

	private setupDriver(): void {
		if (this.environmentService.enableSmokeTestDriver) {
			registerWindowDriver();
		}
	}
}
