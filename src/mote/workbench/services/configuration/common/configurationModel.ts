import { IConfigurationModel, toValuesTree } from 'mote/platform/configuration/common/configuration';
import { ConfigurationModelParser, ConfigurationParseOptions } from 'mote/platform/configuration/common/configurationModels';

export class StandaloneConfigurationModelParser extends ConfigurationModelParser {

	constructor(name: string, private readonly scope: string) {
		super(name);
	}

	protected override doParseRaw(raw: any, configurationParseOptions?: ConfigurationParseOptions): IConfigurationModel {
		const contents = toValuesTree(raw, message => console.error(`Conflict in settings file ${this._name}: ${message}`));
		const scopedContents = Object.create(null);
		scopedContents[this.scope] = contents;
		const keys = Object.keys(raw).map(key => `${this.scope}.${key}`);
		return { contents: scopedContents, keys, overrides: [] };
	}

}
