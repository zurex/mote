/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStringDictionary } from 'mote/base/common/collections';
import { ISandboxConfiguration } from 'mote/base/parts/sandbox/common/sandboxTypes';
import { NativeParsedArgs } from 'mote/platform/environment/common/argv';
import { ILoggerResource, LogLevel } from 'mote/platform/log/common/log';
import { IUserDataProfile } from 'mote/platform/userDataProfile/common/userDataProfile';
import { PolicyDefinition, PolicyValue } from 'mote/platform/policy/common/policy';
import { UriDto } from 'mote/base/common/uri';

export interface ISharedProcess {

	/**
	 * Toggles the visibility of the otherwise hidden
	 * shared process window.
	 */
	toggle(): Promise<void>;
}

export interface ISharedProcessConfiguration extends ISandboxConfiguration {
	readonly machineId: string;

	readonly args: NativeParsedArgs;

	readonly logLevel: LogLevel;

	readonly loggers: UriDto<ILoggerResource>[];

	readonly profiles: readonly UriDto<IUserDataProfile>[];

	readonly policiesData?: IStringDictionary<{ definition: PolicyDefinition; value: PolicyValue }>;
}
