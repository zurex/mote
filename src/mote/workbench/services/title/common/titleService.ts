import { Event } from 'mote/base/common/event';
import { createDecorator } from 'mote/platform/instantiation/common/instantiation';

export const ITitleService = createDecorator<ITitleService>('titleService');

export interface ITitleProperties {
	isPure?: boolean;
	isAdmin?: boolean;
	prefix?: string;
}

export interface ITitleService {

	readonly _serviceBrand: undefined;

	/**
	 * An event when the menubar visibility changes.
	 */
	readonly onMenubarVisibilityChange: Event<boolean>;

	/**
	 *  Title menu is visible
	 */
	readonly isCommandCenterVisible: boolean;

	/**
	 * An event when the title menu is enabled/disabled
	 */
	readonly onDidChangeCommandCenterVisibility: Event<void>;

	/**
	 * Update some environmental title properties.
	 */
	updateProperties(properties: ITitleProperties): void;
}
