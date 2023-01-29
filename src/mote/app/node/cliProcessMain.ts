/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { hostname, release } from 'os';
import { raceTimeout } from 'mote/base/common/async';
import { VSBuffer } from 'mote/base/common/buffer';
import { toErrorMessage } from 'mote/base/common/errorMessage';
import { onUnexpectedError, setUnexpectedErrorHandler } from 'mote/base/common/errors';
import { Disposable } from 'mote/base/common/lifecycle';
import { Schemas } from 'mote/base/common/network';
import { isAbsolute, join } from 'mote/base/common/path';
import { isWindows } from 'mote/base/common/platform';
import { cwd } from 'mote/base/common/process';
import { URI } from 'mote/base/common/uri';
import { Promises } from 'mote/base/node/pfs';
import { IConfigurationService } from 'mote/platform/configuration/common/configuration';
import { ConfigurationService } from 'mote/platform/configuration/common/configurationService';
import { IDownloadService } from 'mote/platform/download/common/download';
import { DownloadService } from 'mote/platform/download/common/downloadService';
import { NativeParsedArgs } from 'mote/platform/environment/common/argv';
import { INativeEnvironmentService } from 'mote/platform/environment/common/environment';
import { NativeEnvironmentService } from 'mote/platform/environment/node/environmentService';
import { ExtensionGalleryServiceWithNoStorageService } from 'mote/platform/extensionManagement/common/extensionGalleryService';
import { IExtensionGalleryService, InstallOptions } from 'mote/platform/extensionManagement/common/extensionManagement';
import { ExtensionSignatureVerificationService, IExtensionSignatureVerificationService } from 'mote/platform/extensionManagement/node/extensionSignatureVerificationService';
import { ExtensionManagementCLI } from 'mote/platform/extensionManagement/common/extensionManagementCLI';
import { IExtensionsProfileScannerService } from 'mote/platform/extensionManagement/common/extensionsProfileScannerService';
import { IExtensionsScannerService } from 'mote/platform/extensionManagement/common/extensionsScannerService';
import { ExtensionManagementService, INativeServerExtensionManagementService } from 'mote/platform/extensionManagement/node/extensionManagementService';
import { ExtensionsScannerService } from 'mote/platform/extensionManagement/node/extensionsScannerService';
import { IFileService } from 'mote/platform/files/common/files';
import { FileService } from 'mote/platform/files/common/fileService';
import { DiskFileSystemProvider } from 'mote/platform/files/node/diskFileSystemProvider';
import { SyncDescriptor } from 'mote/platform/instantiation/common/descriptors';
import { IInstantiationService } from 'mote/platform/instantiation/common/instantiation';
import { InstantiationService } from 'mote/platform/instantiation/common/instantiationService';
import { ServiceCollection } from 'mote/platform/instantiation/common/serviceCollection';
import { ILanguagePackService } from 'mote/platform/languagePacks/common/languagePacks';
import { NativeLanguagePackService } from 'mote/platform/languagePacks/node/languagePacks';
import { ConsoleLogger, getLogLevel, ILogger, ILogService, LogLevel } from 'mote/platform/log/common/log';
import { SpdLogLogger } from 'mote/platform/log/node/spdlogLog';
import { FilePolicyService } from 'mote/platform/policy/common/filePolicyService';
import { IPolicyService, NullPolicyService } from 'mote/platform/policy/common/policy';
import { NativePolicyService } from 'mote/platform/policy/node/nativePolicyService';
import product from 'mote/platform/product/common/product';
import { IProductService } from 'mote/platform/product/common/productService';
import { IRequestService } from 'mote/platform/request/common/request';
import { RequestService } from 'mote/platform/request/node/requestService';
import { IStateService } from 'mote/platform/state/node/state';
import { StateService } from 'mote/platform/state/node/stateService';
import { resolveCommonProperties } from 'mote/platform/telemetry/common/commonProperties';
import { ITelemetryService } from 'mote/platform/telemetry/common/telemetry';
import { ITelemetryServiceConfig, TelemetryService } from 'mote/platform/telemetry/common/telemetryService';
import { supportsTelemetry, NullTelemetryService, getPiiPathsFromEnvironment, isInternalTelemetry, ITelemetryAppender } from 'mote/platform/telemetry/common/telemetryUtils';
import { OneDataSystemAppender } from 'mote/platform/telemetry/node/1dsAppender';
import { buildTelemetryMessage } from 'mote/platform/telemetry/node/telemetry';
import { IUriIdentityService } from 'mote/platform/uriIdentity/common/uriIdentity';
import { UriIdentityService } from 'mote/platform/uriIdentity/common/uriIdentityService';
import { IUserDataProfilesService, PROFILES_ENABLEMENT_CONFIG } from 'mote/platform/userDataProfile/common/userDataProfile';
import { UserDataProfilesService } from 'mote/platform/userDataProfile/node/userDataProfile';
import { resolveMachineId } from 'mote/platform/telemetry/node/telemetryUtils';
import { ExtensionsProfileScannerService } from 'mote/platform/extensionManagement/node/extensionsProfileScannerService';
import { LogService } from 'mote/platform/log/common/logService';

class CliMain extends Disposable {

	constructor(
		private argv: NativeParsedArgs
	) {
		super();

		this.registerListeners();
	}

	private registerListeners(): void {

		// Dispose on exit
		process.once('exit', () => this.dispose());
	}

	async run(): Promise<void> {

		// Services
		const [instantiationService, appenders] = await this.initServices();

		return instantiationService.invokeFunction(async accessor => {
			const logService = accessor.get(ILogService);
			const fileService = accessor.get(IFileService);
			const environmentService = accessor.get(INativeEnvironmentService);
			const userDataProfilesService = accessor.get(IUserDataProfilesService);

			// Log info
			logService.info('CLI main', this.argv);

			// Error handler
			this.registerErrorHandler(logService);

			// Run based on argv
			await this.doRun(environmentService, fileService, userDataProfilesService, instantiationService);

			// Flush the remaining data in AI adapter (with 1s timeout)
			await Promise.all(appenders.map(a => {
				raceTimeout(a.flush(), 1000);
			}));
			return;
		});
	}

	private async initServices(): Promise<[IInstantiationService, ITelemetryAppender[]]> {
		const services = new ServiceCollection();

		// Product
		const productService = { _serviceBrand: undefined, ...product };
		services.set(IProductService, productService);

		// Environment
		const environmentService = new NativeEnvironmentService(this.argv, productService);
		services.set(INativeEnvironmentService, environmentService);

		// Init folders
		await Promise.all([
			environmentService.appSettingsHome.fsPath,
			environmentService.extensionsPath
		].map(path => path ? Promises.mkdir(path, { recursive: true }) : undefined));

		// Log
		const logLevel = getLogLevel(environmentService);
		const spdLogLogger = new SpdLogLogger('cli', join(environmentService.logsPath, 'cli.log'), true, false, logLevel);
		const otherLoggers: ILogger[] = [];
		if (logLevel === LogLevel.Trace) {
			otherLoggers.push(new ConsoleLogger(logLevel));
		}

		const logService = this._register(new LogService(spdLogLogger, otherLoggers));
		services.set(ILogService, logService);

		// Files
		const fileService = this._register(new FileService(logService));
		services.set(IFileService, fileService);

		const diskFileSystemProvider = this._register(new DiskFileSystemProvider(logService));
		fileService.registerProvider(Schemas.file, diskFileSystemProvider);

		// State
		const stateService = new StateService(environmentService, logService, fileService);
		services.set(IStateService, stateService);

		// Uri Identity
		const uriIdentityService = new UriIdentityService(fileService);
		services.set(IUriIdentityService, uriIdentityService);

		// User Data Profiles
		const userDataProfilesService = new UserDataProfilesService(stateService, uriIdentityService, environmentService, fileService, logService);
		services.set(IUserDataProfilesService, userDataProfilesService);

		// Policy
		const policyService = isWindows && productService.win32RegValueName ? this._register(new NativePolicyService(logService, productService.win32RegValueName))
			: environmentService.policyFile ? this._register(new FilePolicyService(environmentService.policyFile, fileService, logService))
				: new NullPolicyService();
		services.set(IPolicyService, policyService);

		// Configuration
		const configurationService = this._register(new ConfigurationService(userDataProfilesService.defaultProfile.settingsResource, fileService, policyService, logService));
		services.set(IConfigurationService, configurationService);

		// Initialize
		await Promise.all([
			stateService.init(),
			configurationService.initialize()
		]);

		userDataProfilesService.setEnablement(productService.quality !== 'stable' || configurationService.getValue(PROFILES_ENABLEMENT_CONFIG));

		// URI Identity
		services.set(IUriIdentityService, new UriIdentityService(fileService));

		// Request
		services.set(IRequestService, new SyncDescriptor(RequestService, undefined, true));

		// Download Service
		services.set(IDownloadService, new SyncDescriptor(DownloadService, undefined, true));

		// Extensions
		services.set(IExtensionsProfileScannerService, new SyncDescriptor(ExtensionsProfileScannerService, undefined, true));
		services.set(IExtensionsScannerService, new SyncDescriptor(ExtensionsScannerService, undefined, true));
		services.set(IExtensionSignatureVerificationService, new SyncDescriptor(ExtensionSignatureVerificationService, undefined, true));
		services.set(INativeServerExtensionManagementService, new SyncDescriptor(ExtensionManagementService, undefined, true));
		services.set(IExtensionGalleryService, new SyncDescriptor(ExtensionGalleryServiceWithNoStorageService, undefined, true));

		// Localizations
		services.set(ILanguagePackService, new SyncDescriptor(NativeLanguagePackService, undefined, false));

		// Telemetry
		const appenders: ITelemetryAppender[] = [];
		const isInternal = isInternalTelemetry(productService, configurationService);
		if (supportsTelemetry(productService, environmentService)) {
			if (productService.aiConfig && productService.aiConfig.ariaKey) {
				appenders.push(new OneDataSystemAppender(isInternal, 'monacoworkbench', null, productService.aiConfig.ariaKey));
			}

			const { installSourcePath } = environmentService;

			const config: ITelemetryServiceConfig = {
				appenders,
				sendErrorTelemetry: false,
				commonProperties: (async () => {
					let machineId: string | undefined = undefined;
					try {
						machineId = await resolveMachineId(stateService);
					} catch (error) {
						if (error.code !== 'ENOENT') {
							logService.error(error);
						}
					}

					return resolveCommonProperties(fileService, release(), hostname(), process.arch, productService.commit, productService.version, machineId, isInternal, installSourcePath);
				})(),
				piiPaths: getPiiPathsFromEnvironment(environmentService)
			};

			services.set(ITelemetryService, new SyncDescriptor(TelemetryService, [config], false));

		} else {
			services.set(ITelemetryService, NullTelemetryService);
		}

		return [new InstantiationService(services), appenders];
	}

	private registerErrorHandler(logService: ILogService): void {

		// Install handler for unexpected errors
		setUnexpectedErrorHandler(error => {
			const message = toErrorMessage(error, true);
			if (!message) {
				return;
			}

			logService.error(`[uncaught exception in CLI]: ${message}`);
		});

		// Handle unhandled errors that can occur
		process.on('uncaughtException', err => onUnexpectedError(err));
		process.on('unhandledRejection', (reason: unknown) => onUnexpectedError(reason));
	}

	private async doRun(environmentService: INativeEnvironmentService, fileService: IFileService, userDataProfilesService: IUserDataProfilesService, instantiationService: IInstantiationService): Promise<void> {
		const profileLocation = (environmentService.args.profile ? userDataProfilesService.profiles.find(p => p.name === environmentService.args.profile) ?? userDataProfilesService.defaultProfile : userDataProfilesService.defaultProfile).extensionsResource;

		// Install Source
		if (this.argv['install-source']) {
			return this.setInstallSource(environmentService, fileService, this.argv['install-source']);
		}

		// List Extensions
		if (this.argv['list-extensions']) {
			return instantiationService.createInstance(ExtensionManagementCLI).listExtensions(!!this.argv['show-versions'], this.argv['category'], profileLocation);
		}

		// Install Extension
		else if (this.argv['install-extension'] || this.argv['install-builtin-extension']) {
			const installOptions: InstallOptions = { isMachineScoped: !!this.argv['do-not-sync'], installPreReleaseVersion: !!this.argv['pre-release'], profileLocation };
			return instantiationService.createInstance(ExtensionManagementCLI).installExtensions(this.asExtensionIdOrVSIX(this.argv['install-extension'] || []), this.argv['install-builtin-extension'] || [], installOptions, !!this.argv['force']);
		}

		// Uninstall Extension
		else if (this.argv['uninstall-extension']) {
			return instantiationService.createInstance(ExtensionManagementCLI).uninstallExtensions(this.asExtensionIdOrVSIX(this.argv['uninstall-extension']), !!this.argv['force'], profileLocation);
		}

		// Locate Extension
		else if (this.argv['locate-extension']) {
			return instantiationService.createInstance(ExtensionManagementCLI).locateExtension(this.argv['locate-extension']);
		}

		// Telemetry
		else if (this.argv['telemetry']) {
			console.log(await buildTelemetryMessage(environmentService.appRoot, environmentService.extensionsPath));
		}
	}

	private asExtensionIdOrVSIX(inputs: string[]): (string | URI)[] {
		return inputs.map(input => /\.vsix$/i.test(input) ? URI.file(isAbsolute(input) ? input : join(cwd(), input)) : input);
	}

	private async setInstallSource(environmentService: INativeEnvironmentService, fileService: IFileService, installSource: string): Promise<void> {
		await fileService.writeFile(URI.file(environmentService.installSourcePath), VSBuffer.fromString(installSource.slice(0, 30)));
	}
}

export async function main(argv: NativeParsedArgs): Promise<void> {
	const cliMain = new CliMain(argv);

	try {
		await cliMain.run();
	} finally {
		cliMain.dispose();
	}
}
