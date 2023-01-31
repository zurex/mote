/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConsoleLogger, ILogger, LogLevel } from 'mote/platform/log/common/log';
import { INativeWorkbenchEnvironmentService } from 'mote/workbench/services/environment/electron-sandbox/environmentService';
import { LoggerChannelClient } from 'mote/platform/log/common/logIpc';
import { DisposableStore } from 'mote/base/common/lifecycle';
import { localize } from 'mote/nls';
import { rendererLogId } from 'mote/workbench/common/logConstants';
import { LogService } from 'mote/platform/log/common/logService';

export class NativeLogService extends LogService {

	constructor(logLevel: LogLevel, loggerService: LoggerChannelClient, environmentService: INativeWorkbenchEnvironmentService) {

		const disposables = new DisposableStore();

		const fileLogger = disposables.add(loggerService.createLogger(environmentService.logFile, { id: rendererLogId, name: localize('rendererLog', "Window") }));

		let consoleLogger: ILogger;
		if (environmentService.isExtensionDevelopment && !!environmentService.extensionTestsLocationURI) {
			// Extension development test CLI: forward everything to main side
			consoleLogger = loggerService.createConsoleMainLogger();
		} else {
			// Normal mode: Log to console
			consoleLogger = new ConsoleLogger(logLevel);
		}

		super(fileLogger, [consoleLogger]);

		this._register(disposables);
	}
}
