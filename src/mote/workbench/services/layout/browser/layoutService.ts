import { ILayoutService } from 'mote/platform/layout/browser/layoutService';
import { Part } from 'mote/workbench/browser/part';
import { refineServiceDecorator } from 'mote/platform/instantiation/common/instantiation';

export const enum Parts {
	TITLEBAR_PART = 'workbench.parts.titlebar',
	//BANNER_PART = 'workbench.parts.banner',
	ACTIVITYBAR_PART = 'workbench.parts.activitybar',
	SIDEBAR_PART = 'workbench.parts.sidebar',
	//PANEL_PART = 'workbench.parts.panel',
	//AUXILIARYBAR_PART = 'workbench.parts.auxiliarybar',
	EDITOR_PART = 'workbench.parts.editor',
	STATUSBAR_PART = 'workbench.parts.statusbar'
}

export const enum Position {
	LEFT,
	RIGHT,
	BOTTOM
}

export const IWorkbenchLayoutService = refineServiceDecorator<ILayoutService, IWorkbenchLayoutService>(ILayoutService);


export interface IWorkbenchLayoutService extends ILayoutService {

	/**
	 * Run a layout of the workbench.
	 */
	layout(): void;

	/**
	 * Asks the part service if all parts have been fully restored. For editor part
	 * this means that the contents of visible editors have loaded.
	 */
	isRestored(): boolean;

	/**
	 * A promise for to await the `isRestored()` condition to be `true`.
	 */
	readonly whenRestored: Promise<void>;

	/**
	 * Returns if the part is visible.
	 */
	isVisible(part: Parts): boolean;

	/**
	 * Set part hidden or not
	 */
	setPartHidden(hidden: boolean, part: Exclude<Parts, Parts.STATUSBAR_PART | Parts.TITLEBAR_PART>): void;

	/**
	 * Register a part to participate in the layout.
	 */
	registerPart(part: Part): void;

	/**
	 * Gets the current side bar position. Note that the sidebar can be hidden too.
	 */
	getSideBarPosition(): Position;
}
