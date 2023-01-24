import { ColorExtensions, ColorIdentifier, IColorRegistry } from 'mote/platform/theme/common/colorRegistry';
import { ColorScheme } from 'mote/platform/theme/common/theme';
import { IColorTheme } from 'mote/platform/theme/common/themeService';
import { Color } from 'mote/base/common/color';
import { Registry } from 'mote/platform/registry/common/platform';

const colorRegistry = Registry.as<IColorRegistry>(ColorExtensions.ColorContribution);

export class ColorTheme implements IColorTheme {
	constructor(
		public label: string,
		private colors: { [id: string]: string } = {},
		public type = ColorScheme.DARK,
		public readonly semanticHighlighting = false
	) { }

	getColor(color: ColorIdentifier, useDefault?: boolean): Color | undefined {
		const value = this.colors[color];
		if (value) {
			return Color.fromHex(value);
		}
		if (useDefault) {
			return colorRegistry.resolveDefaultColor(color, this);
		}
		return undefined;
	}

	defines(color: ColorIdentifier): boolean {
		return undefined !== this.colors[color];
	}
}

export const DEFAULT_DARK_THEME: ColorTheme = new ColorTheme(
	'default',
	{}
);
