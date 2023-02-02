/* eslint-disable code-no-unexternalized-strings */
import { app } from "electron";
import { Schemas } from "mote/base/common/network";
import { ILifecycleMainService, LifecycleMainService } from "mote/platform/lifecycle/electron-main/lifecycleMainService";
import { IProtocolMainService } from "mote/platform/protocol/electron-main/protocol";
import { ProtocolMainService } from "mote/platform/protocol/electron-main/protocolMainService";
import { IRequestService } from 'mote/platform/request/common/request';
import { IThemeMainService, ThemeMainService } from "mote/platform/theme/electron-main/themeMainService";
import { coalesce, distinct } from "mote/base/common/arrays";
import { IPathWithLineAndColumn, isValidBasename, parseLineAndColumnAware, sanitizeFilePath } from "mote/base/common/extpath";
import { basename, resolve } from "mote/base/common/path";
import { IProcessEnvironment, isMacintosh, isWindows } from "mote/base/common/platform";
import { cwd } from "mote/base/common/process";
import { rtrim, trim } from "mote/base/common/strings";
import { NativeParsedArgs } from "mote/platform/environment/common/argv";
import { EnvironmentMainService, IEnvironmentMainService } from "mote/platform/environment/electron-main/environmentMainService";
import { addArg, parseMainProcessArgv } from "mote/platform/environment/node/argvHelper";
import { createWaitMarkerFileSync } from "mote/platform/environment/node/wait";
import { IFileService } from "mote/platform/files/common/files";
import { FileService } from "mote/platform/files/common/fileService";
import { DiskFileSystemProvider } from "mote/platform/files/node/diskFileSystemProvider";
import { SyncDescriptor } from "mote/platform/instantiation/common/descriptors";
import { IInstantiationService } from 'mote/platform/instantiation/common/instantiation';
import { InstantiationService } from "mote/platform/instantiation/common/instantiationService";
import { ServiceCollection } from "mote/platform/instantiation/common/serviceCollection";
import { ConsoleMainLogger, getLogLevel, ILoggerService, ILogService, LogLevel } from "mote/platform/log/common/log";
import product from "mote/platform/product/common/product";
import { IProductService } from "mote/platform/product/common/productService";
import { RequestMainService } from 'mote/platform/request/electron-main/requestMainService';
import { IStateMainService } from "mote/platform/state/electron-main/state";
import { StateMainService } from "mote/platform/state/electron-main/stateMainService";
import { MoteApplication } from "mote/app/electron-main/app";
import { IConfigurationService } from 'mote/platform/configuration/common/configuration';
import { ConfigurationService } from 'mote/platform/configuration/common/configurationService';
import { IPolicyService, NullPolicyService } from 'mote/platform/policy/common/policy';
import { URI } from 'mote/base/common/uri';
import { LogService } from 'mote/platform/log/common/logService';
import { ILoggerMainService, LoggerMainService } from 'mote/platform/log/electron-main/loggerService';
import { BufferLogger } from 'mote/platform/log/common/bufferLog';
import { DisposableStore } from 'mote/base/common/lifecycle';

class MoteMain {

	main(): void {
		try {
			this.startup();
		} catch (error) {
			console.error(error.message);
			app.exit(1);
		}
	}

	private async startup(): Promise<void> {
		const [instantiationService, instanceEnvironment] = this.createServices();

		// Startup
		await instantiationService.invokeFunction(async accessor => {

			const logService = accessor.get(ILogService);
			logService.info("[MoteMain] startup...", instanceEnvironment);

			return instantiationService.createInstance(MoteApplication, instanceEnvironment).startup();
		});
	}

	private createServices(): [IInstantiationService, IProcessEnvironment,] {
		const services = new ServiceCollection();
		const disposables = new DisposableStore();

		// Product
		const productService = { _serviceBrand: undefined, ...product };
		services.set(IProductService, productService);

		// Environment
		const environmentMainService = new EnvironmentMainService(this.resolveArgs(), productService);
		const instanceEnvironment = this.patchEnvironment(environmentMainService); // Patch `process.env` with the instance's environment
		services.set(IEnvironmentMainService, environmentMainService);

		// Logger
		const loggerService = new LoggerMainService(getLogLevel(environmentMainService));
		services.set(ILoggerMainService, loggerService);

		// Log: We need to buffer the spdlog logs until we are sure
		// we are the only instance running, otherwise we'll have concurrent
		// log file access on Windows (https://github.com/microsoft/vscode/issues/41218)
		const bufferLogger = new BufferLogger(loggerService.getLogLevel());
		const logService = disposables.add(new LogService(bufferLogger, [new ConsoleMainLogger(loggerService.getLogLevel())]));
		services.set(ILogService, logService);

		// Files
		const fileService = new FileService(logService);
		services.set(IFileService, fileService);
		const diskFileSystemProvider = new DiskFileSystemProvider(logService);
		fileService.registerProvider(Schemas.file, diskFileSystemProvider);

		// Policy
		const policyService = new NullPolicyService();
		services.set(IPolicyService, policyService);

		// Configuration
		// TODO @zurex use userProfile service
		const configurationService = new ConfigurationService(URI.file('settings.json'), fileService, policyService, logService);
		services.set(IConfigurationService, configurationService);

		// Lifecycle
		services.set(ILifecycleMainService, new SyncDescriptor(LifecycleMainService));

		// Request
		services.set(IRequestService, new SyncDescriptor(RequestMainService));

		// State
		const stateMainService = new StateMainService(environmentMainService, logService, fileService);
		services.set(IStateMainService, stateMainService);

		// Themes
		services.set(IThemeMainService, new SyncDescriptor(ThemeMainService));

		// Protocol
		services.set(IProtocolMainService, new SyncDescriptor(ProtocolMainService));

		return [new InstantiationService(services, true), instanceEnvironment];
	}

	private patchEnvironment(environmentMainService: IEnvironmentMainService): IProcessEnvironment {
		const instanceEnvironment: IProcessEnvironment = {
			MOTE_IPC_HOOK: environmentMainService.mainIPCHandle
		};

		['MOTE_NLS_CONFIG', 'MOTE_PORTABLE'].forEach(key => {
			const value = process.env[key];
			if (typeof value === 'string') {
				instanceEnvironment[key] = value;
			}
		});

		Object.assign(process.env, instanceEnvironment);

		return instanceEnvironment;
	}

	private resolveArgs(): NativeParsedArgs {

		// Parse arguments
		const args = this.validatePaths(parseMainProcessArgv(process.argv));

		// If we are started with --wait create a random temporary file
		// and pass it over to the starting instance. We can use this file
		// to wait for it to be deleted to monitor that the edited file
		// is closed and then exit the waiting process.
		//
		// Note: we are not doing this if the wait marker has been already
		// added as argument. This can happen if Code was started from CLI.
		if (args.wait && !args.waitMarkerFilePath) {
			const waitMarkerFilePath = createWaitMarkerFileSync(args.verbose);
			if (waitMarkerFilePath) {
				addArg(process.argv, '--waitMarkerFilePath', waitMarkerFilePath);
				args.waitMarkerFilePath = waitMarkerFilePath;
			}
		}

		return args;
	}

	private validatePaths(args: NativeParsedArgs): NativeParsedArgs {

		// Track URLs if they're going to be used
		if (args['open-url']) {
			args._urls = args._;
			args._ = [];
		}

		// Normalize paths and watch out for goto line mode
		if (!args['remote']) {
			const paths = this.doValidatePaths(args._, args.goto);
			args._ = paths;
		}

		return args;
	}

	private doValidatePaths(args: string[], gotoLineMode?: boolean): string[] {
		const currentWorkingDir = cwd();
		const result = args.map(arg => {
			let pathCandidate = String(arg);

			let parsedPath: IPathWithLineAndColumn | undefined = undefined;
			if (gotoLineMode) {
				parsedPath = parseLineAndColumnAware(pathCandidate);
				pathCandidate = parsedPath.path;
			}

			if (pathCandidate) {
				pathCandidate = this.preparePath(currentWorkingDir, pathCandidate);
			}

			const sanitizedFilePath = sanitizeFilePath(pathCandidate, currentWorkingDir);

			const filePathBasename = basename(sanitizedFilePath);
			if (filePathBasename /* can be empty if code is opened on root */ && !isValidBasename(filePathBasename)) {
				return null; // do not allow invalid file names
			}

			if (gotoLineMode && parsedPath) {
				parsedPath.path = sanitizedFilePath;

				return this.toPath(parsedPath);
			}

			return sanitizedFilePath;
		});

		const caseInsensitive = isWindows || isMacintosh;
		const distinctPaths = distinct(result, path => path && caseInsensitive ? path.toLowerCase() : (path || ''));

		return coalesce(distinctPaths);
	}

	private preparePath(cwd: string, path: string): string {

		// Trim trailing quotes
		if (isWindows) {
			path = rtrim(path, '"'); // https://github.com/microsoft/vscode/issues/1498
		}

		// Trim whitespaces
		path = trim(trim(path, ' '), '\t');

		if (isWindows) {

			// Resolve the path against cwd if it is relative
			path = resolve(cwd, path);

			// Trim trailing '.' chars on Windows to prevent invalid file names
			path = rtrim(path, '.');
		}

		return path;
	}

	private toPath(pathWithLineAndCol: IPathWithLineAndColumn): string {
		const segments = [pathWithLineAndCol.path];

		if (typeof pathWithLineAndCol.line === 'number') {
			segments.push(String(pathWithLineAndCol.line));
		}

		if (typeof pathWithLineAndCol.column === 'number') {
			segments.push(String(pathWithLineAndCol.column));
		}

		return segments.join(':');
	}

	//#endregion
}

// Main Startup
const mote = new MoteMain();
mote.main();
