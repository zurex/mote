import { RunOnceScheduler } from 'mote/base/common/async';
import { IStringDictionary } from 'mote/base/common/collections';
import { Emitter, Event } from 'mote/base/common/event';
import * as errors from 'mote/base/common/errors';
import { combinedDisposable, Disposable, IDisposable, MutableDisposable } from 'mote/base/common/lifecycle';
import { isEmptyObject, isObject } from 'mote/base/common/types';
import { URI } from 'mote/base/common/uri';
import { ConfigurationModel, ConfigurationModelParser, ConfigurationParseOptions, UserSettings } from 'mote/platform/configuration/common/configurationModels';
import { ConfigurationExtensions, ConfigurationScope, IConfigurationRegistry, OVERRIDE_PROPERTY_REGEX } from 'mote/platform/configuration/common/configurationRegistry';
import { DefaultConfiguration } from 'mote/platform/configuration/common/configurations';
import { FileChangesEvent, FileChangeType, FileOperation, FileOperationError, FileOperationEvent, FileOperationResult, IFileService } from 'mote/platform/files/common/files';
import { ILogService } from 'mote/platform/log/common/log';
import { Registry } from 'mote/platform/registry/common/platform';
import { IUriIdentityService } from 'mote/platform/uriIdentity/common/uriIdentity';
import { ConfigurationKey, IConfigurationCache } from 'mote/workbench/services/configuration/common/workbenchConfiguration';
import { IBrowserWorkbenchEnvironmentService } from 'mote/workbench/services/environment/browser/environmentService';
import { StandaloneConfigurationModelParser } from 'mote/workbench/services/configuration/common/configurationModel';
import { TASKS_CONFIGURATION_KEY } from 'mote/workbench/services/configuration/common/configuration';
import { equals } from 'mote/base/common/objects';

export class WorkbenchDefaultConfiguration extends DefaultConfiguration {

	static readonly DEFAULT_OVERRIDES_CACHE_EXISTS_KEY = 'DefaultOverridesCacheExists';

	private readonly configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
	private cachedConfigurationDefaultsOverrides: IStringDictionary<any> = {};
	private readonly cacheKey: ConfigurationKey = { type: 'defaults', key: 'configurationDefaultsOverrides' };

	private updateCache: boolean = false;

	constructor(
		private readonly configurationCache: IConfigurationCache,
		environmentService: IBrowserWorkbenchEnvironmentService,
	) {
		super();
		if (environmentService.options?.configurationDefaults) {
			this.configurationRegistry.registerDefaultConfigurations([{ overrides: environmentService.options.configurationDefaults }]);
		}
	}

	protected override getConfigurationDefaultOverrides(): IStringDictionary<any> {
		return this.cachedConfigurationDefaultsOverrides;
	}

	override async initialize(): Promise<ConfigurationModel> {
		await this.initializeCachedConfigurationDefaultsOverrides();
		return super.initialize();
	}

	override reload(): ConfigurationModel {
		this.updateCache = true;
		this.cachedConfigurationDefaultsOverrides = {};
		this.updateCachedConfigurationDefaultsOverrides();
		return super.reload();
	}

	hasCachedConfigurationDefaultsOverrides(): boolean {
		return !isEmptyObject(this.cachedConfigurationDefaultsOverrides);
	}

	private initiaizeCachedConfigurationDefaultsOverridesPromise: Promise<void> | undefined;
	private initializeCachedConfigurationDefaultsOverrides(): Promise<void> {
		if (!this.initiaizeCachedConfigurationDefaultsOverridesPromise) {
			this.initiaizeCachedConfigurationDefaultsOverridesPromise = (async () => {
				try {
					// Read only when the cache exists
					if (window.localStorage.getItem(WorkbenchDefaultConfiguration.DEFAULT_OVERRIDES_CACHE_EXISTS_KEY)) {
						const content = await this.configurationCache.read(this.cacheKey);
						if (content) {
							this.cachedConfigurationDefaultsOverrides = JSON.parse(content);
						}
					}
				} catch (error) { /* ignore */ }
				this.cachedConfigurationDefaultsOverrides = isObject(this.cachedConfigurationDefaultsOverrides) ? this.cachedConfigurationDefaultsOverrides : {};
			})();
		}
		return this.initiaizeCachedConfigurationDefaultsOverridesPromise;
	}

	protected override onDidUpdateConfiguration(properties: string[], defaultsOverrides?: boolean): void {
		super.onDidUpdateConfiguration(properties, defaultsOverrides);
		if (defaultsOverrides) {
			this.updateCachedConfigurationDefaultsOverrides();
		}
	}

	private async updateCachedConfigurationDefaultsOverrides(): Promise<void> {
		if (!this.updateCache) {
			return;
		}
		const cachedConfigurationDefaultsOverrides: IStringDictionary<any> = {};
		const configurationDefaultsOverrides = this.configurationRegistry.getConfigurationDefaultsOverrides();
		for (const [key, value] of configurationDefaultsOverrides) {
			if (!OVERRIDE_PROPERTY_REGEX.test(key) && value.value !== undefined) {
				cachedConfigurationDefaultsOverrides[key] = value.value;
			}
		}
		try {
			if (Object.keys(cachedConfigurationDefaultsOverrides).length) {
				window.localStorage.setItem(WorkbenchDefaultConfiguration.DEFAULT_OVERRIDES_CACHE_EXISTS_KEY, 'yes');
				await this.configurationCache.write(this.cacheKey, JSON.stringify(cachedConfigurationDefaultsOverrides));
			} else {
				window.localStorage.removeItem(WorkbenchDefaultConfiguration.DEFAULT_OVERRIDES_CACHE_EXISTS_KEY);
				await this.configurationCache.remove(this.cacheKey);
			}
		} catch (error) {/* Ignore error */ }
	}
}

export class UserConfiguration extends Disposable {

	private readonly _onDidChangeConfiguration: Emitter<ConfigurationModel> = this._register(new Emitter<ConfigurationModel>());
	readonly onDidChangeConfiguration: Event<ConfigurationModel> = this._onDidChangeConfiguration.event;

	private readonly userConfiguration = this._register(new MutableDisposable<UserSettings | FileServiceBasedConfiguration>());
	private readonly userConfigurationChangeDisposable = this._register(new MutableDisposable<IDisposable>());
	private readonly reloadConfigurationScheduler: RunOnceScheduler;

	private configurationParseOptions: ConfigurationParseOptions;

	get hasTasksLoaded(): boolean { return this.userConfiguration.value instanceof FileServiceBasedConfiguration; }

	constructor(
		private settingsResource: URI,
		private tasksResource: URI | undefined,
		scopes: ConfigurationScope[] | undefined,
		private readonly fileService: IFileService,
		private readonly uriIdentityService: IUriIdentityService,
		private readonly logService: ILogService,
	) {
		super();
		this.configurationParseOptions = { scopes, skipRestricted: false };
		this.userConfiguration.value = new UserSettings(settingsResource, scopes, uriIdentityService.extUri, this.fileService);
		this.userConfigurationChangeDisposable.value = this.userConfiguration.value.onDidChange(() => this.reloadConfigurationScheduler.schedule());
		this.reloadConfigurationScheduler = this._register(new RunOnceScheduler(() => this.userConfiguration.value!.loadConfiguration().then(configurationModel => this._onDidChangeConfiguration.fire(configurationModel)), 50));
	}

	async reset(settingsResource: URI, tasksResource: URI | undefined, scopes: ConfigurationScope[] | undefined): Promise<ConfigurationModel> {
		this.settingsResource = settingsResource;
		this.tasksResource = tasksResource;
		this.configurationParseOptions = { scopes, skipRestricted: false };
		const folder = this.uriIdentityService.extUri.dirname(this.settingsResource);
		const standAloneConfigurationResources: [string, URI][] = this.tasksResource ? [[TASKS_CONFIGURATION_KEY, this.tasksResource]] : [];
		const fileServiceBasedConfiguration = new FileServiceBasedConfiguration(folder.toString(), this.settingsResource, standAloneConfigurationResources, this.configurationParseOptions, this.fileService, this.uriIdentityService, this.logService);
		const configurationModel = await fileServiceBasedConfiguration.loadConfiguration();
		this.userConfiguration.value = fileServiceBasedConfiguration;

		// Check for value because userConfiguration might have been disposed.
		if (this.userConfigurationChangeDisposable.value) {
			this.userConfigurationChangeDisposable.value = this.userConfiguration.value.onDidChange(() => this.reloadConfigurationScheduler.schedule());
		}

		return configurationModel;
	}

	async initialize(): Promise<ConfigurationModel> {
		return this.userConfiguration.value!.loadConfiguration();
	}

	async reload(): Promise<ConfigurationModel> {
		if (this.hasTasksLoaded) {
			return this.userConfiguration.value!.loadConfiguration();
		}
		return this.reset(this.settingsResource, this.tasksResource, this.configurationParseOptions.scopes);
	}

	reparse(): ConfigurationModel {
		return this.userConfiguration.value!.reparse(this.configurationParseOptions);
	}

	getRestrictedSettings(): string[] {
		return this.userConfiguration.value!.getRestrictedSettings();
	}
}

class FileServiceBasedConfiguration extends Disposable {

	private readonly allResources: URI[];
	private _folderSettingsModelParser: ConfigurationModelParser;
	private _folderSettingsParseOptions: ConfigurationParseOptions;
	private _standAloneConfigurations: ConfigurationModel[];
	private _cache: ConfigurationModel;

	private readonly _onDidChange: Emitter<void> = this._register(new Emitter<void>());
	readonly onDidChange: Event<void> = this._onDidChange.event;

	constructor(
		name: string,
		private readonly settingsResource: URI,
		private readonly standAloneConfigurationResources: [string, URI][],
		configurationParseOptions: ConfigurationParseOptions,
		private readonly fileService: IFileService,
		private readonly uriIdentityService: IUriIdentityService,
		private readonly logService: ILogService,
	) {
		super();
		this.allResources = [this.settingsResource, ...this.standAloneConfigurationResources.map(([, resource]) => resource)];
		this._register(combinedDisposable(...this.allResources.map(resource => combinedDisposable(
			this.fileService.watch(uriIdentityService.extUri.dirname(resource)),
			// Also listen to the resource incase the resource is a symlink - https://github.com/microsoft/vscode/issues/118134
			this.fileService.watch(resource)
		))));

		this._folderSettingsModelParser = new ConfigurationModelParser(name);
		this._folderSettingsParseOptions = configurationParseOptions;
		this._standAloneConfigurations = [];
		this._cache = new ConfigurationModel();

		this._register(Event.debounce(
			Event.any(
				Event.filter(this.fileService.onDidFilesChange, e => this.handleFileChangesEvent(e)),
				Event.filter(this.fileService.onDidRunOperation, e => this.handleFileOperationEvent(e))
			), () => undefined, 100)(() => this._onDidChange.fire()));
	}

	async resolveContents(): Promise<[string | undefined, [string, string | undefined][]]> {

		const resolveContents = async (resources: URI[]): Promise<(string | undefined)[]> => {
			return Promise.all(resources.map(async resource => {
				try {
					const content = (await this.fileService.readFile(resource)).value.toString();
					return content;
				} catch (error) {
					this.logService.trace(`Error while resolving configuration file '${resource.toString()}': ${errors.getErrorMessage(error)}`);
					if ((<FileOperationError>error).fileOperationResult !== FileOperationResult.FILE_NOT_FOUND
						&& (<FileOperationError>error).fileOperationResult !== FileOperationResult.FILE_NOT_DIRECTORY) {
						this.logService.error(error);
					}
				}
				return '{}';
			}));
		};

		const [[settingsContent], standAloneConfigurationContents] = await Promise.all([
			resolveContents([this.settingsResource]),
			resolveContents(this.standAloneConfigurationResources.map(([, resource]) => resource)),
		]);

		return [settingsContent, standAloneConfigurationContents.map((content, index) => ([this.standAloneConfigurationResources[index][0], content]))];
	}

	async loadConfiguration(): Promise<ConfigurationModel> {

		const [settingsContent, standAloneConfigurationContents] = await this.resolveContents();

		// reset
		this._standAloneConfigurations = [];
		this._folderSettingsModelParser.parse('', this._folderSettingsParseOptions);

		// parse
		if (settingsContent !== undefined) {
			this._folderSettingsModelParser.parse(settingsContent, this._folderSettingsParseOptions);
		}
		for (let index = 0; index < standAloneConfigurationContents.length; index++) {
			const contents = standAloneConfigurationContents[index][1];
			if (contents !== undefined) {
				const standAloneConfigurationModelParser = new StandaloneConfigurationModelParser(this.standAloneConfigurationResources[index][1].toString(), this.standAloneConfigurationResources[index][0]);
				standAloneConfigurationModelParser.parse(contents);
				this._standAloneConfigurations.push(standAloneConfigurationModelParser.configurationModel);
			}
		}

		// Consolidate (support *.json files in the workspace settings folder)
		this.consolidate();

		return this._cache;
	}

	getRestrictedSettings(): string[] {
		return this._folderSettingsModelParser.restrictedConfigurations;
	}

	reparse(configurationParseOptions: ConfigurationParseOptions): ConfigurationModel {
		const oldContents = this._folderSettingsModelParser.configurationModel.contents;
		this._folderSettingsParseOptions = configurationParseOptions;
		this._folderSettingsModelParser.reparse(this._folderSettingsParseOptions);
		if (!equals(oldContents, this._folderSettingsModelParser.configurationModel.contents)) {
			this.consolidate();
		}
		return this._cache;
	}

	private consolidate(): void {
		this._cache = this._folderSettingsModelParser.configurationModel.merge(...this._standAloneConfigurations);
	}

	private handleFileChangesEvent(event: FileChangesEvent): boolean {
		// One of the resources has changed
		if (this.allResources.some(resource => event.contains(resource))) {
			return true;
		}
		// One of the resource's parent got deleted
		if (this.allResources.some(resource => event.contains(this.uriIdentityService.extUri.dirname(resource), FileChangeType.DELETED))) {
			return true;
		}
		return false;
	}

	private handleFileOperationEvent(event: FileOperationEvent): boolean {
		// One of the resources has changed
		if ((event.isOperation(FileOperation.CREATE) || event.isOperation(FileOperation.COPY) || event.isOperation(FileOperation.DELETE) || event.isOperation(FileOperation.WRITE))
			&& this.allResources.some(resource => this.uriIdentityService.extUri.isEqual(event.resource, resource))) {
			return true;
		}
		// One of the resource's parent got deleted
		if (event.isOperation(FileOperation.DELETE) && this.allResources.some(resource => this.uriIdentityService.extUri.isEqual(event.resource, this.uriIdentityService.extUri.dirname(resource)))) {
			return true;
		}
		return false;
	}

}
