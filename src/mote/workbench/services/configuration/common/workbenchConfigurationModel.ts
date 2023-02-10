import { distinct } from 'mote/base/common/arrays';
import { ResourceMap } from 'mote/base/common/map';
import { equals } from 'mote/base/common/objects';
import { URI } from 'mote/base/common/uri';
import { IConfigurationChange, IConfigurationOverrides, IConfigurationValue } from 'mote/platform/configuration/common/configuration';
import { Configuration, ConfigurationModel } from 'mote/platform/configuration/common/configurationModels';
import { Workspace } from 'mote/platform/workspace/common/workspace';

export class WorkbenchConfiguration extends Configuration {

	constructor(
		defaults: ConfigurationModel,
		policy: ConfigurationModel,
		application: ConfigurationModel,
		localUser: ConfigurationModel,
		remoteUser: ConfigurationModel,
		workspaceConfiguration: ConfigurationModel,
		pages: ResourceMap<ConfigurationModel>,
		memoryConfiguration: ConfigurationModel,
		memoryConfigurationByResource: ResourceMap<ConfigurationModel>,
		private readonly _workspace?: Workspace) {
		super(defaults, policy, application, localUser, remoteUser, workspaceConfiguration, pages, memoryConfiguration, memoryConfigurationByResource);
	}

	override getValue(key: string | undefined, overrides: IConfigurationOverrides = {}): any {
		return super.getValue(key, overrides, this._workspace);
	}

	override inspect<C>(key: string, overrides: IConfigurationOverrides = {}): IConfigurationValue<C> {
		return super.inspect(key, overrides, this._workspace);
	}

	override keys(): {
		default: string[];
		user: string[];
		workspace: string[];
		workspaceFolder: string[];
	} {
		return super.keys(this._workspace);
	}

	override compareAndDeleteFolderConfiguration(folder: URI): IConfigurationChange {
		if (this._workspace && this._workspace.pages.length > 0 && this._workspace.pages[0].uri.toString() === folder.toString()) {
			// Do not remove workspace configuration
			return { keys: [], overrides: [] };
		}
		return super.compareAndDeleteFolderConfiguration(folder);
	}

	compare(other: WorkbenchConfiguration): IConfigurationChange {
		const compare = (fromKeys: string[], toKeys: string[], overrideIdentifier?: string): string[] => {
			const keys: string[] = [];
			keys.push(...toKeys.filter(key => fromKeys.indexOf(key) === -1));
			keys.push(...fromKeys.filter(key => toKeys.indexOf(key) === -1));
			keys.push(...fromKeys.filter(key => {
				// Ignore if the key does not exist in both models
				if (toKeys.indexOf(key) === -1) {
					return false;
				}
				// Compare workspace value
				if (!equals(this.getValue(key, { overrideIdentifier }), other.getValue(key, { overrideIdentifier }))) {
					return true;
				}
				// Compare workspace folder value
				return this._workspace && this._workspace.pages.some(page => !equals(this.getValue(key, { resource: page.uri, overrideIdentifier }), other.getValue(key, { resource: page.uri, overrideIdentifier })));
			}));
			return keys;
		};
		const keys = compare(this.allKeys(), other.allKeys());
		const overrides: [string, string[]][] = [];
		const allOverrideIdentifiers = distinct([...this.allOverrideIdentifiers(), ...other.allOverrideIdentifiers()]);
		for (const overrideIdentifier of allOverrideIdentifiers) {
			const keys = compare(this.getAllKeysForOverrideIdentifier(overrideIdentifier), other.getAllKeysForOverrideIdentifier(overrideIdentifier), overrideIdentifier);
			if (keys.length) {
				overrides.push([overrideIdentifier, keys]);
			}
		}
		return { keys, overrides };
	}

}
