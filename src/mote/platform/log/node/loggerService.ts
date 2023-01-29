/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'mote/base/common/uri';
import { generateUuid } from 'mote/base/common/uuid';
import { AbstractLoggerService, ILogger, ILoggerOptions, ILoggerService, LogLevel } from 'mote/platform/log/common/log';
import { SpdLogLogger } from 'mote/platform/log/node/spdlogLog';

export class LoggerService extends AbstractLoggerService implements ILoggerService {

	protected doCreateLogger(resource: URI, logLevel: LogLevel, options?: ILoggerOptions): ILogger {
		return new SpdLogLogger(options?.name || generateUuid(), resource.fsPath, !options?.donotRotate, !!options?.donotUseFormatters, logLevel);
	}
}
