import { IStringDictionary } from 'mote/base/common/collections';
import { isEmptyObject, isObject } from 'mote/base/common/types';
import { ConfigurationModel } from 'mote/platform/configuration/common/configurationModels';
import { ConfigurationExtensions, IConfigurationRegistry, OVERRIDE_PROPERTY_REGEX } from 'mote/platform/configuration/common/configurationRegistry';
import { DefaultConfiguration } from 'mote/platform/configuration/common/configurations';
import { Registry } from 'mote/platform/registry/common/platform';
import { ConfigurationKey, IConfigurationCache } from 'mote/workbench/services/configuration/common/workbenchConfiguration';
import { IBrowserWorkbenchEnvironmentService } from 'mote/workbench/services/environment/browser/environmentService';

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
