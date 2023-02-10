import * as nls from 'mote/nls';
import { ColorDefaults, ColorIdentifier, darken, getColorRegistry, ifDefinedThenElse, lessProminent, lighten, oneOf, transparent } from 'mote/platform/theme/common/colorRegistry';
import { ThemedColors, ThemedStyles } from 'mote/base/common/themes';
import { Color, RGBA } from 'mote/base/common/color';

const colorRegistry = getColorRegistry();

export function registerColor(id: string, defaults: ColorDefaults | null, description: string, needsTransparency?: boolean, deprecationMessage?: string): ColorIdentifier {
	return colorRegistry.registerColor(id, migrateColorDefaults(defaults)!, description, needsTransparency, deprecationMessage);
}

export const foreground = colorRegistry.registerColor('foreground', { dark: '#CCCCCC', light: '#616161', hcDark: '#FFFFFF', hcLight: '#292929' }, 'Overall foreground color. This color is only used if not overridden by a component.');
export const disabledForeground = registerColor('disabledForeground', { dark: '#CCCCCC80', light: '#61616180', hcDark: '#A5A5A5', hcLight: '#7F7F7F' }, nls.localize('disabledForeground', "Overall foreground for disabled elements. This color is only used if not overridden by a component."));
export const errorForeground = registerColor('errorForeground', { dark: '#F48771', light: '#A1260D', hcDark: '#F48771', hcLight: '#B5200D' }, nls.localize('errorForeground', "Overall foreground color for error messages. This color is only used if not overridden by a component."));

export const regularTextColor = colorRegistry.registerColor('text.regular.color', { dark: '#ffffffcf', light: '#37352f' }, 'regularTextColor');
export const mediumTextColor = colorRegistry.registerColor('text.medium.color', { dark: '#ffffffa6', light: '#37352f80' }, 'mediumTextColor');
export const lightTextColor = colorRegistry.registerColor('text.light.color', { dark: '#ffffff26', light: '#37352f26' }, '');

export const textLinkForeground = registerColor('textLink.foreground', { light: '#006AB1', dark: '#3794FF', hcDark: '#3794FF', hcLight: '#0F4A85' }, nls.localize('textLinkForeground', "Foreground color for links in text."));

export const regularDividerColor = colorRegistry.registerColor('divider.regular.color', { light: '', dark: '' }, '');
export const darkDividerColor = colorRegistry.registerColor('divider.dark.color', { light: '', dark: '' }, '');

export const focusBorder = registerColor('focusBorder', { dark: '#007FD4', light: '#0090F1', hcDark: '#F38518', hcLight: '#006BBD' }, nls.localize('focusBorder', "Overall border color for focused elements. This color is only used if not overridden by a component."));

export const contrastBorder = registerColor('contrastBorder', { light: null, dark: null, hcDark: '#6FC3DF', hcLight: '#0F4A85' }, nls.localize('contrastBorder', "An extra border around elements to separate them from others for greater contrast."));
export const activeContrastBorder = registerColor('contrastActiveBorder', { light: null, dark: null, hcDark: focusBorder, hcLight: focusBorder }, nls.localize('activeContrastBorder', "An extra border around active elements to separate them from others for greater contrast."));

/**
 * Editor foreground color.
 */
export const editorForeground = registerColor('editor.foreground', { light: '#333333', dark: '#BBBBBB', hcDark: Color.white, hcLight: foreground }, nls.localize('editorForeground', "Editor default foreground color."));

export const sidebarBackground = colorRegistry.registerColor('sidebarBackground', { light: '#f7f6f3', dark: '#252526' }, 'sidebarBackground');

export const editorBackground = colorRegistry.registerColor('editor.background', { light: '#fffffe', dark: '#1E1E1E', hcDark: Color.black, hcLight: Color.white }, 'editor.background');

export const contextViewBackground = colorRegistry.registerColor('contextview.background', { light: '#ffffff', dark: '#303031' }, '');

export const selectBackground = registerColor('dropdown.background', { dark: '#3C3C3C', light: Color.white, hcDark: Color.black, hcLight: Color.white }, nls.localize('dropdownBackground', "Dropdown background."));
export const selectListBackground = registerColor('dropdown.listBackground', { dark: null, light: null, hcDark: Color.black, hcLight: Color.white }, nls.localize('dropdownListBackground', "Dropdown list background."));
export const selectForeground = registerColor('dropdown.foreground', { dark: '#F0F0F0', light: foreground, hcDark: Color.white, hcLight: foreground }, nls.localize('dropdownForeground', "Dropdown foreground."));
export const selectBorder = registerColor('dropdown.border', { dark: selectBackground, light: '#CECECE', hcDark: contrastBorder, hcLight: contrastBorder }, nls.localize('dropdownBorder', "Dropdown border."));

export const buttonForeground = registerColor('button.foreground', { dark: Color.white, light: Color.white, hcDark: Color.white, hcLight: Color.white }, nls.localize('buttonForeground', "Button foreground color."));
export const buttonSeparator = registerColor('button.separator', { dark: transparent(buttonForeground, .4), light: transparent(buttonForeground, .4), hcDark: transparent(buttonForeground, .4), hcLight: transparent(buttonForeground, .4) }, nls.localize('buttonSeparator', "Button separator color."));
export const buttonBackground = registerColor('button.background', { dark: '#0E639C', light: '#007ACC', hcDark: null, hcLight: '#0F4A85' }, nls.localize('buttonBackground', "Button background color."));
export const buttonHoverBackground = registerColor('button.hoverBackground', { dark: lighten(buttonBackground, 0.2), light: darken(buttonBackground, 0.2), hcDark: buttonBackground, hcLight: buttonBackground }, nls.localize('buttonHoverBackground', "Button background color when hovering."));
export const buttonBorder = registerColor('button.border', { dark: contrastBorder, light: contrastBorder, hcDark: contrastBorder, hcLight: contrastBorder }, nls.localize('buttonBorder', "Button border color."));

export const buttonSecondaryForeground = registerColor('button.secondaryForeground', { dark: Color.white, light: Color.white, hcDark: Color.white, hcLight: foreground }, nls.localize('buttonSecondaryForeground', "Secondary button foreground color."));
export const buttonSecondaryBackground = registerColor('button.secondaryBackground', { dark: '#3A3D41', light: '#5F6A79', hcDark: null, hcLight: Color.white }, nls.localize('buttonSecondaryBackground', "Secondary button background color."));
export const buttonSecondaryHoverBackground = registerColor('button.secondaryHoverBackground', { dark: lighten(buttonSecondaryBackground, 0.2), light: darken(buttonSecondaryBackground, 0.2), hcDark: null, hcLight: null }, nls.localize('buttonSecondaryHoverBackground', "Secondary button background color when hovering."));

export const buttonShadowColor = colorRegistry.registerColor('button.shadow.color', { dark: '#0F0F0F', light: '#0f0f0f', hcDark: Color.white, hcLight: foreground }, nls.localize('dropdownForeground', "Dropdown foreground."));

export const badgeBackground = registerColor('badge.background', { dark: '#4D4D4D', light: '#C4C4C4', hcDark: Color.black, hcLight: '#0F4A85' }, nls.localize('badgeBackground', "Badge background color. Badges are small information labels, e.g. for search results count."));
export const badgeForeground = registerColor('badge.foreground', { dark: Color.white, light: '#333', hcDark: Color.white, hcLight: Color.white }, nls.localize('badgeForeground', "Badge foreground color. Badges are small information labels, e.g. for search results count."));

export const switcherOnBackground = colorRegistry.registerColor('swicther.on.background', { dark: ThemedColors.blue, light: ThemedColors.blue }, nls.localize('dropdownForeground', "Dropdown foreground."));
export const switcherOffBackground = colorRegistry.registerColor('swicther.off.background', { dark: ThemedColors.blue, light: '#8783784d' }, nls.localize('dropdownForeground', "Dropdown foreground."));

export const progressBarBackground = registerColor('progressBar.background', { dark: Color.fromHex('#0E70C0'), light: Color.fromHex('#0E70C0'), hcDark: contrastBorder, hcLight: contrastBorder }, nls.localize('progressBarBackground', "Background color of the progress bar that can show for long running operations."));

export const editorErrorBackground = registerColor('editorError.background', { dark: null, light: null, hcDark: null, hcLight: null }, nls.localize('editorError.background', 'Background color of error text in the editor. The color must not be opaque so as not to hide underlying decorations.'), true);
export const editorErrorForeground = registerColor('editorError.foreground', { dark: '#F14C4C', light: '#E51400', hcDark: '#F48771', hcLight: '#B5200D' }, nls.localize('editorError.foreground', 'Foreground color of error squigglies in the editor.'));
export const editorErrorBorder = registerColor('editorError.border', { dark: null, light: null, hcDark: Color.fromHex('#E47777').transparent(0.8), hcLight: '#B5200D' }, nls.localize('errorBorder', 'Border color of error boxes in the editor.'));

export const editorWarningBackground = registerColor('editorWarning.background', { dark: null, light: null, hcDark: null, hcLight: null }, nls.localize('editorWarning.background', 'Background color of warning text in the editor. The color must not be opaque so as not to hide underlying decorations.'), true);
export const editorWarningForeground = registerColor('editorWarning.foreground', { dark: '#CCA700', light: '#BF8803', hcDark: '#FFD37', hcLight: '#895503' }, nls.localize('editorWarning.foreground', 'Foreground color of warning squigglies in the editor.'));
export const editorWarningBorder = registerColor('editorWarning.border', { dark: null, light: null, hcDark: Color.fromHex('#FFCC00').transparent(0.8), hcLight: '#' }, nls.localize('warningBorder', 'Border color of warning boxes in the editor.'));

export const editorInfoBackground = registerColor('editorInfo.background', { dark: null, light: null, hcDark: null, hcLight: null }, nls.localize('editorInfo.background', 'Background color of info text in the editor. The color must not be opaque so as not to hide underlying decorations.'), true);
export const editorInfoForeground = registerColor('editorInfo.foreground', { dark: '#3794FF', light: '#1a85ff', hcDark: '#3794FF', hcLight: '#1a85ff' }, nls.localize('editorInfo.foreground', 'Foreground color of info squigglies in the editor.'));
export const editorInfoBorder = registerColor('editorInfo.border', { dark: null, light: null, hcDark: Color.fromHex('#3794FF').transparent(0.8), hcLight: '#292929' }, nls.localize('infoBorder', 'Border color of info boxes in the editor.'));

export const editorHintForeground = registerColor('editorHint.foreground', { dark: Color.fromHex('#eeeeee').transparent(0.7), light: '#6c6c6c', hcDark: null, hcLight: null }, nls.localize('editorHint.foreground', 'Foreground color of hint squigglies in the editor.'));
export const editorHintBorder = registerColor('editorHint.border', { dark: null, light: null, hcDark: Color.fromHex('#eeeeee').transparent(0.8), hcLight: '#292929' }, nls.localize('hintBorder', 'Border color of hint boxes in the editor.'));

export const sashHoverBorder = registerColor('sash.hoverBorder', { dark: focusBorder, light: focusBorder, hcDark: focusBorder, hcLight: focusBorder }, nls.localize('sashActiveBorder', "Border color of active sashes."));


//#region widget

export const widgetShadow = registerColor('widget.shadow', { dark: transparent(Color.black, .36), light: transparent(Color.black, .16), hcDark: null, hcLight: null }, nls.localize('widgetShadow', 'Shadow color of widgets such as find/replace inside the editor.'));
export const widgetBorder = registerColor('widget.border', { dark: null, light: null, hcDark: contrastBorder, hcLight: contrastBorder }, nls.localize('widgetBorder', 'Border color of widgets such as find/replace inside the editor.'));

export const inputBackground = registerColor('input.background', { dark: '#3C3C3C', light: Color.white, hcDark: Color.black, hcLight: Color.white }, nls.localize('inputBoxBackground', "Input box background."));
export const inputForeground = registerColor('input.foreground', { dark: foreground, light: foreground, hcDark: foreground, hcLight: foreground }, nls.localize('inputBoxForeground', "Input box foreground."));
export const inputBorder = registerColor('input.border', { dark: null, light: null, hcDark: contrastBorder, hcLight: contrastBorder }, nls.localize('inputBoxBorder', "Input box border."));
export const inputActiveOptionBorder = registerColor('inputOption.activeBorder', { dark: '#007ACC', light: '#007ACC', hcDark: contrastBorder, hcLight: contrastBorder }, nls.localize('inputBoxActiveOptionBorder', "Border color of activated options in input fields."));
export const inputActiveOptionHoverBackground = registerColor('inputOption.hoverBackground', { dark: '#5a5d5e80', light: '#b8b8b850', hcDark: null, hcLight: null }, nls.localize('inputOption.hoverBackground', "Background color of activated options in input fields."));
export const inputActiveOptionBackground = registerColor('inputOption.activeBackground', { dark: transparent(focusBorder, 0.4), light: transparent(focusBorder, 0.2), hcDark: Color.transparent, hcLight: Color.transparent }, nls.localize('inputOption.activeBackground', "Background hover color of options in input fields."));
export const inputActiveOptionForeground = registerColor('inputOption.activeForeground', { dark: Color.white, light: Color.black, hcDark: foreground, hcLight: foreground }, nls.localize('inputOption.activeForeground', "Foreground color of activated options in input fields."));
export const inputPlaceholderForeground = registerColor('input.placeholderForeground', { light: transparent(foreground, 0.5), dark: transparent(foreground, 0.5), hcDark: transparent(foreground, 0.7), hcLight: transparent(foreground, 0.7) }, nls.localize('inputPlaceholderForeground', "Input box foreground color for placeholder text."));

export const inputValidationInfoBackground = registerColor('inputValidation.infoBackground', { dark: '#063B49', light: '#D6ECF2', hcDark: Color.black, hcLight: Color.white }, nls.localize('inputValidationInfoBackground', "Input validation background color for information severity."));
export const inputValidationInfoForeground = registerColor('inputValidation.infoForeground', { dark: null, light: null, hcDark: null, hcLight: foreground }, nls.localize('inputValidationInfoForeground', "Input validation foreground color for information severity."));
export const inputValidationInfoBorder = registerColor('inputValidation.infoBorder', { dark: '#007acc', light: '#007acc', hcDark: contrastBorder, hcLight: contrastBorder }, nls.localize('inputValidationInfoBorder', "Input validation border color for information severity."));
export const inputValidationWarningBackground = registerColor('inputValidation.warningBackground', { dark: '#352A05', light: '#F6F5D2', hcDark: Color.black, hcLight: Color.white }, nls.localize('inputValidationWarningBackground', "Input validation background color for warning severity."));
export const inputValidationWarningForeground = registerColor('inputValidation.warningForeground', { dark: null, light: null, hcDark: null, hcLight: foreground }, nls.localize('inputValidationWarningForeground', "Input validation foreground color for warning severity."));
export const inputValidationWarningBorder = registerColor('inputValidation.warningBorder', { dark: '#B89500', light: '#B89500', hcDark: contrastBorder, hcLight: contrastBorder }, nls.localize('inputValidationWarningBorder', "Input validation border color for warning severity."));
export const inputValidationErrorBackground = registerColor('inputValidation.errorBackground', { dark: '#5A1D1D', light: '#F2DEDE', hcDark: Color.black, hcLight: Color.white }, nls.localize('inputValidationErrorBackground', "Input validation background color for error severity."));
export const inputValidationErrorForeground = registerColor('inputValidation.errorForeground', { dark: null, light: null, hcDark: null, hcLight: foreground }, nls.localize('inputValidationErrorForeground', "Input validation foreground color for error severity."));
export const inputValidationErrorBorder = registerColor('inputValidation.errorBorder', { dark: '#BE1100', light: '#BE1100', hcDark: contrastBorder, hcLight: contrastBorder }, nls.localize('inputValidationErrorBorder', "Input validation border color for error severity."));

export const scrollbarShadow = registerColor('scrollbar.shadow', { dark: '#000000', light: '#DDDDDD', hcDark: null, hcLight: null }, nls.localize('scrollbarShadow', "Scrollbar shadow to indicate that the view is scrolled."));
export const scrollbarSliderBackground = registerColor('scrollbarSlider.background', { dark: Color.fromHex('#797979').transparent(0.4), light: Color.fromHex('#646464').transparent(0.4), hcDark: transparent(contrastBorder, 0.6), hcLight: transparent(contrastBorder, 0.4) }, nls.localize('scrollbarSliderBackground', "Scrollbar slider background color."));
export const scrollbarSliderHoverBackground = registerColor('scrollbarSlider.hoverBackground', { dark: Color.fromHex('#646464').transparent(0.7), light: Color.fromHex('#646464').transparent(0.7), hcDark: transparent(contrastBorder, 0.8), hcLight: transparent(contrastBorder, 0.8) }, nls.localize('scrollbarSliderHoverBackground', "Scrollbar slider background color when hovering."));
export const scrollbarSliderActiveBackground = registerColor('scrollbarSlider.activeBackground', { dark: Color.fromHex('#BFBFBF').transparent(0.4), light: Color.fromHex('#000000').transparent(0.6), hcDark: contrastBorder, hcLight: contrastBorder }, nls.localize('scrollbarSliderActiveBackground', "Scrollbar slider background color when clicked on."));


//#endregion

/**
 * Toolbar colors
 */
export const toolbarHoverBackground = registerColor('toolbar.hoverBackground', { dark: '#5a5d5e50', light: '#b8b8b850', hcDark: null, hcLight: null }, nls.localize('toolbarHoverBackground', "Toolbar background when hovering over actions using the mouse"));
export const toolbarHoverOutline = registerColor('toolbar.hoverOutline', { dark: null, light: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder }, nls.localize('toolbarHoverOutline', "Toolbar outline when hovering over actions using the mouse"));
export const toolbarActiveBackground = registerColor('toolbar.activeBackground', { dark: lighten(toolbarHoverBackground, 0.1), light: darken(toolbarHoverBackground, 0.1), hcDark: null, hcLight: null }, nls.localize('toolbarActiveBackground', "Toolbar background when holding the mouse over actions"));


export const mediumIconColor = colorRegistry.registerColor('icon.medium.color', { light: '#37352f73', dark: '#ffffff71' }, 'mediumIconColor');
export const iconBackground = colorRegistry.registerColor('icon.background', { light: '#d0d0cf', dark: '#898989' }, '');

export const buttonHoverBuleBackground = colorRegistry.registerColor('button.hoverBackgroundWithBule', { ...ThemedStyles.buttonHoveredBackground, light: '#2eaadc35' }, 'buttonHoverBackground');
export const outlineButtonBorder = colorRegistry.registerColor('button.outline.border', { light: '#37352f29', dark: '' }, '');

/**
 * Editor widgets
 */
export const editorWidgetBackground = registerColor('editorWidget.background', { dark: '#252526', light: '#F3F3F3', hcDark: '#0C141F', hcLight: Color.white }, nls.localize('editorWidgetBackground', 'Background color of editor widgets, such as find/replace.'));
export const editorWidgetForeground = registerColor('editorWidget.foreground', { dark: foreground, light: foreground, hcDark: foreground, hcLight: foreground }, nls.localize('editorWidgetForeground', 'Foreground color of editor widgets, such as find/replace.'));
export const editorWidgetBorder = registerColor('editorWidget.border', { dark: '#454545', light: '#C8C8C8', hcDark: contrastBorder, hcLight: contrastBorder }, nls.localize('editorWidgetBorder', 'Border color of editor widgets. The color is only used if the widget chooses to have a border and if the color is not overridden by a widget.'));
export const editorWidgetResizeBorder = registerColor('editorWidget.resizeBorder', { light: null, dark: null, hcDark: null, hcLight: null }, nls.localize('editorWidgetResizeBorder', "Border color of the resize bar of editor widgets. The color is only used if the widget chooses to have a resize border and if the color is not overridden by a widget."));

/**
 * Quick pick widget
 */
export const quickInputBackground = registerColor('quickInput.background', { dark: editorWidgetBackground, light: editorWidgetBackground, hcDark: editorWidgetBackground, hcLight: editorWidgetBackground }, nls.localize('pickerBackground', "Quick picker background color. The quick picker widget is the container for pickers like the command palette."));
export const quickInputForeground = registerColor('quickInput.foreground', { dark: editorWidgetForeground, light: editorWidgetForeground, hcDark: editorWidgetForeground, hcLight: editorWidgetForeground }, nls.localize('pickerForeground', "Quick picker foreground color. The quick picker widget is the container for pickers like the command palette."));
export const quickInputTitleBackground = registerColor('quickInputTitle.background', { dark: new Color(new RGBA(255, 255, 255, 0.105)), light: new Color(new RGBA(0, 0, 0, 0.06)), hcDark: '#000000', hcLight: Color.white }, nls.localize('pickerTitleBackground', "Quick picker title background color. The quick picker widget is the container for pickers like the command palette."));
export const pickerGroupForeground = registerColor('pickerGroup.foreground', { dark: '#3794FF', light: '#0066BF', hcDark: Color.white, hcLight: '#0F4A85' }, nls.localize('pickerGroupForeground', "Quick picker color for grouping labels."));
export const pickerGroupBorder = registerColor('pickerGroup.border', { dark: '#3F3F46', light: '#CCCEDB', hcDark: Color.white, hcLight: '#0F4A85' }, nls.localize('pickerGroupBorder', "Quick picker color for grouping borders."));

/**
 * Keybinding label
 */
export const keybindingLabelBackground = registerColor('keybindingLabel.background', { dark: new Color(new RGBA(128, 128, 128, 0.17)), light: new Color(new RGBA(221, 221, 221, 0.4)), hcDark: Color.transparent, hcLight: Color.transparent }, nls.localize('keybindingLabelBackground', "Keybinding label background color. The keybinding label is used to represent a keyboard shortcut."));
export const keybindingLabelForeground = registerColor('keybindingLabel.foreground', { dark: Color.fromHex('#CCCCCC'), light: Color.fromHex('#555555'), hcDark: Color.white, hcLight: foreground }, nls.localize('keybindingLabelForeground', "Keybinding label foreground color. The keybinding label is used to represent a keyboard shortcut."));
export const keybindingLabelBorder = registerColor('keybindingLabel.border', { dark: new Color(new RGBA(51, 51, 51, 0.6)), light: new Color(new RGBA(204, 204, 204, 0.4)), hcDark: new Color(new RGBA(111, 195, 223)), hcLight: contrastBorder }, nls.localize('keybindingLabelBorder', "Keybinding label border color. The keybinding label is used to represent a keyboard shortcut."));
export const keybindingLabelBottomBorder = registerColor('keybindingLabel.bottomBorder', { dark: new Color(new RGBA(68, 68, 68, 0.6)), light: new Color(new RGBA(187, 187, 187, 0.4)), hcDark: new Color(new RGBA(111, 195, 223)), hcLight: foreground }, nls.localize('keybindingLabelBottomBorder', "Keybinding label border bottom color. The keybinding label is used to represent a keyboard shortcut."));


/**
 * Editor selection colors.
 */
export const editorSelectionBackground = registerColor('editor.selectionBackground', { light: '#ADD6FF', dark: '#264F78', hcDark: '#f3f518', hcLight: '#0F4A85' }, nls.localize('editorSelectionBackground', "Color of the editor selection."));
export const editorSelectionForeground = registerColor('editor.selectionForeground', { light: null, dark: null, hcDark: '#000000', hcLight: Color.white }, nls.localize('editorSelectionForeground', "Color of the selected text for high contrast."));
export const editorInactiveSelection = registerColor('editor.inactiveSelectionBackground', { light: transparent(editorSelectionBackground, 0.5), dark: transparent(editorSelectionBackground, 0.5), hcDark: transparent(editorSelectionBackground, 0.7), hcLight: transparent(editorSelectionBackground, 0.5) }, nls.localize('editorInactiveSelection', "Color of the selection in an inactive editor. The color must not be opaque so as not to hide underlying decorations."), true);
export const editorSelectionHighlight = registerColor('editor.selectionHighlightBackground', { light: lessProminent(editorSelectionBackground, editorBackground, 0.3, 0.6), dark: lessProminent(editorSelectionBackground, editorBackground, 0.3, 0.6), hcDark: null, hcLight: null }, nls.localize('editorSelectionHighlight', 'Color for regions with the same content as the selection. The color must not be opaque so as not to hide underlying decorations.'), true);
export const editorSelectionHighlightBorder = registerColor('editor.selectionHighlightBorder', { light: null, dark: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder }, nls.localize('editorSelectionHighlightBorder', "Border color for regions with the same content as the selection."));


/**
 * Editor find match colors.
 */
export const editorFindMatch = registerColor('editor.findMatchBackground', { light: '#A8AC94', dark: '#515C6A', hcDark: null, hcLight: null }, nls.localize('editorFindMatch', "Color of the current search match."));
export const editorFindMatchHighlight = registerColor('editor.findMatchHighlightBackground', { light: '#EA5C0055', dark: '#EA5C0055', hcDark: null, hcLight: null }, nls.localize('findMatchHighlight', "Color of the other search matches. The color must not be opaque so as not to hide underlying decorations."), true);
export const editorFindRangeHighlight = registerColor('editor.findRangeHighlightBackground', { dark: '#3a3d4166', light: '#b4b4b44d', hcDark: null, hcLight: null }, nls.localize('findRangeHighlight', "Color of the range limiting the search. The color must not be opaque so as not to hide underlying decorations."), true);
export const editorFindMatchBorder = registerColor('editor.findMatchBorder', { light: null, dark: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder }, nls.localize('editorFindMatchBorder', "Border color of the current search match."));
export const editorFindMatchHighlightBorder = registerColor('editor.findMatchHighlightBorder', { light: null, dark: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder }, nls.localize('findMatchHighlightBorder', "Border color of the other search matches."));
export const editorFindRangeHighlightBorder = registerColor('editor.findRangeHighlightBorder', { dark: null, light: null, hcDark: transparent(activeContrastBorder, 0.4), hcLight: transparent(activeContrastBorder, 0.4) }, nls.localize('findRangeHighlightBorder', "Border color of the range limiting the search. The color must not be opaque so as not to hide underlying decorations."), true);


//#region editorHover

export const editorHoverBackground = registerColor('editorHoverWidget.background', { light: editorWidgetBackground, dark: editorWidgetBackground, hcDark: editorWidgetBackground, hcLight: editorWidgetBackground }, nls.localize('hoverBackground', 'Background color of the editor hover.'));

export const codeBlockBackground = registerColor('codeBlock.background', { dark: '#3f4447', light: '#f7f6f2', hcDark: '#0C141F', hcLight: Color.white }, nls.localize('editorWidgetBackground', 'Background color of editor widgets, such as find/replace.'));
export const imageBlockBackground = registerColor('imageBlock.background', { dark: codeBlockBackground, light: codeBlockBackground, hcDark: '#0C141F', hcLight: Color.white }, nls.localize('editorWidgetBackground', 'Background color of editor widgets, such as find/replace.'));

//#endregion


//#region List and tree colors

export const listFocusBackground = registerColor('list.focusBackground', { dark: null, light: null, hcDark: null, hcLight: null }, nls.localize('listFocusBackground', "List/Tree background color for the focused item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not."));
export const listFocusForeground = registerColor('list.focusForeground', { dark: null, light: null, hcDark: null, hcLight: null }, nls.localize('listFocusForeground', "List/Tree foreground color for the focused item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not."));
export const listFocusOutline = registerColor('list.focusOutline', { dark: focusBorder, light: focusBorder, hcDark: activeContrastBorder, hcLight: activeContrastBorder }, nls.localize('listFocusOutline', "List/Tree outline color for the focused item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not."));
export const listFocusAndSelectionOutline = registerColor('list.focusAndSelectionOutline', { dark: null, light: null, hcDark: null, hcLight: null }, nls.localize('listFocusAndSelectionOutline', "List/Tree outline color for the focused item when the list/tree is active and selected. An active list/tree has keyboard focus, an inactive does not."));
export const listActiveSelectionBackground = registerColor('list.activeSelectionBackground', { dark: '#04395E', light: new Color(new RGBA(0, 0, 0, 0.04)), hcDark: null, hcLight: Color.fromHex('#0F4A85').transparent(0.1) }, nls.localize('listActiveSelectionBackground', "List/Tree background color for the selected item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not."));
export const listActiveSelectionForeground = registerColor('list.activeSelectionForeground', { dark: Color.white, light: Color.white, hcDark: null, hcLight: null }, nls.localize('listActiveSelectionForeground', "List/Tree foreground color for the selected item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not."));
export const listActiveSelectionIconForeground = registerColor('list.activeSelectionIconForeground', { dark: null, light: null, hcDark: null, hcLight: null }, nls.localize('listActiveSelectionIconForeground', "List/Tree icon foreground color for the selected item when the list/tree is active. An active list/tree has keyboard focus, an inactive does not."));
export const listInactiveSelectionBackground = registerColor('list.inactiveSelectionBackground', { dark: '#37373D', light: '#E4E6F1', hcDark: null, hcLight: Color.fromHex('#0F4A85').transparent(0.1) }, nls.localize('listInactiveSelectionBackground', "List/Tree background color for the selected item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not."));
export const listInactiveSelectionForeground = registerColor('list.inactiveSelectionForeground', { dark: null, light: null, hcDark: null, hcLight: null }, nls.localize('listInactiveSelectionForeground', "List/Tree foreground color for the selected item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not."));
export const listInactiveSelectionIconForeground = registerColor('list.inactiveSelectionIconForeground', { dark: null, light: null, hcDark: null, hcLight: null }, nls.localize('listInactiveSelectionIconForeground', "List/Tree icon foreground color for the selected item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not."));
export const listInactiveFocusBackground = registerColor('list.inactiveFocusBackground', { dark: null, light: null, hcDark: null, hcLight: null }, nls.localize('listInactiveFocusBackground', "List/Tree background color for the focused item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not."));
export const listInactiveFocusOutline = registerColor('list.inactiveFocusOutline', { dark: null, light: null, hcDark: null, hcLight: null }, nls.localize('listInactiveFocusOutline', "List/Tree outline color for the focused item when the list/tree is inactive. An active list/tree has keyboard focus, an inactive does not."));
export const listHoverBackground = registerColor('list.hoverBackground', { dark: '#2A2D2E', light: '#F0F0F0', hcDark: null, hcLight: Color.fromHex('#0F4A85').transparent(0.1) }, nls.localize('listHoverBackground', "List/Tree background when hovering over items using the mouse."));
export const listHoverForeground = registerColor('list.hoverForeground', { dark: null, light: null, hcDark: null, hcLight: null }, nls.localize('listHoverForeground', "List/Tree foreground when hovering over items using the mouse."));
export const listDropBackground = registerColor('list.dropBackground', { dark: '#062F4A', light: '#D6EBFF', hcDark: null, hcLight: null }, nls.localize('listDropBackground', "List/Tree drag and drop background when moving items around using the mouse."));
export const listHighlightForeground = registerColor('list.highlightForeground', { dark: '#2AAAFF', light: '#0066BF', hcDark: focusBorder, hcLight: focusBorder }, nls.localize('highlight', 'List/Tree foreground color of the match highlights when searching inside the list/tree.'));
export const listFocusHighlightForeground = registerColor('list.focusHighlightForeground', { dark: listHighlightForeground, light: ifDefinedThenElse(listActiveSelectionBackground, listHighlightForeground, '#BBE7FF'), hcDark: listHighlightForeground, hcLight: listHighlightForeground }, nls.localize('listFocusHighlightForeground', 'List/Tree foreground color of the match highlights on actively focused items when searching inside the list/tree.'));
export const listInvalidItemForeground = registerColor('list.invalidItemForeground', { dark: '#B89500', light: '#B89500', hcDark: '#B89500', hcLight: '#B5200D' }, nls.localize('invalidItemForeground', 'List/Tree foreground color for invalid items, for example an unresolved root in explorer.'));
export const listErrorForeground = registerColor('list.errorForeground', { dark: '#F88070', light: '#B01011', hcDark: null, hcLight: null }, nls.localize('listErrorForeground', 'Foreground color of list items containing errors.'));
export const listWarningForeground = registerColor('list.warningForeground', { dark: '#CCA700', light: '#855F00', hcDark: null, hcLight: null }, nls.localize('listWarningForeground', 'Foreground color of list items containing warnings.'));
export const listFilterWidgetBackground = registerColor('listFilterWidget.background', { light: darken(editorWidgetBackground, 0), dark: lighten(editorWidgetBackground, 0), hcDark: editorWidgetBackground, hcLight: editorWidgetBackground }, nls.localize('listFilterWidgetBackground', 'Background color of the type filter widget in lists and trees.'));
export const listFilterWidgetOutline = registerColor('listFilterWidget.outline', { dark: Color.transparent, light: Color.transparent, hcDark: '#f38518', hcLight: '#007ACC' }, nls.localize('listFilterWidgetOutline', 'Outline color of the type filter widget in lists and trees.'));
export const listFilterWidgetNoMatchesOutline = registerColor('listFilterWidget.noMatchesOutline', { dark: '#BE1100', light: '#BE1100', hcDark: contrastBorder, hcLight: contrastBorder }, nls.localize('listFilterWidgetNoMatchesOutline', 'Outline color of the type filter widget in lists and trees, when there are no matches.'));
export const listFilterWidgetShadow = registerColor('listFilterWidget.shadow', { dark: widgetShadow, light: widgetShadow, hcDark: widgetShadow, hcLight: widgetShadow }, nls.localize('listFilterWidgetShadow', 'Shadown color of the type filter widget in lists and trees.'));
export const listFilterMatchHighlight = registerColor('list.filterMatchBackground', { dark: editorFindMatchHighlight, light: editorFindMatchHighlight, hcDark: null, hcLight: null }, nls.localize('listFilterMatchHighlight', 'Background color of the filtered match.'));
export const listFilterMatchHighlightBorder = registerColor('list.filterMatchBorder', { dark: editorFindMatchHighlightBorder, light: editorFindMatchHighlightBorder, hcDark: contrastBorder, hcLight: activeContrastBorder }, nls.localize('listFilterMatchHighlightBorder', 'Border color of the filtered match.'));
export const treeIndentGuidesStroke = registerColor('tree.indentGuidesStroke', { dark: '#585858', light: '#a9a9a9', hcDark: '#a9a9a9', hcLight: '#a5a5a5' }, nls.localize('treeIndentGuidesStroke', "Tree stroke color for the indentation guides."));
export const treeInactiveIndentGuidesStroke = registerColor('tree.inactiveIndentGuidesStroke', { dark: transparent(treeIndentGuidesStroke, 0.4), light: transparent(treeIndentGuidesStroke, 0.4), hcDark: transparent(treeIndentGuidesStroke, 0.4), hcLight: transparent(treeIndentGuidesStroke, 0.4) }, nls.localize('treeInactiveIndentGuidesStroke', "Tree stroke color for the indentation guides that are not active."));
export const tableColumnsBorder = registerColor('tree.tableColumnsBorder', { dark: '#CCCCCC20', light: '#61616120', hcDark: null, hcLight: null }, nls.localize('tableColumnsBorder', "Table border color between columns."));
export const tableOddRowsBackgroundColor = registerColor('tree.tableOddRowsBackground', { dark: transparent(foreground, 0.04), light: transparent(foreground, 0.04), hcDark: null, hcLight: null }, nls.localize('tableOddRowsBackgroundColor', "Background color for odd table rows."));
export const listDeemphasizedForeground = registerColor('list.deemphasizedForeground', { dark: '#8C8C8C', light: '#8E8E90', hcDark: '#A7A8A9', hcLight: '#666666' }, nls.localize('listDeemphasizedForeground', "List/Tree foreground color for items that are deemphasized. "));

//#endregion

/**
 * Checkboxes
 */
export const checkboxBackground = registerColor('checkbox.background', { dark: selectBackground, light: selectBackground, hcDark: selectBackground, hcLight: selectBackground }, nls.localize('checkbox.background', "Background color of checkbox widget."));
export const checkboxSelectBackground = registerColor('checkbox.selectBackground', { dark: editorWidgetBackground, light: editorWidgetBackground, hcDark: editorWidgetBackground, hcLight: editorWidgetBackground }, nls.localize('checkbox.select.background', "Background color of checkbox widget when the element it's in is selected."));
export const checkboxForeground = registerColor('checkbox.foreground', { dark: selectForeground, light: selectForeground, hcDark: selectForeground, hcLight: selectForeground }, nls.localize('checkbox.foreground', "Foreground color of checkbox widget."));
export const checkboxBorder = registerColor('checkbox.border', { dark: selectBorder, light: selectBorder, hcDark: selectBorder, hcLight: selectBorder }, nls.localize('checkbox.border', "Border color of checkbox widget."));
export const checkboxSelectBorder = registerColor('checkbox.selectBorder', { dark: editorWidgetBackground, light: editorWidgetBackground, hcDark: editorWidgetBackground, hcLight: editorWidgetBackground }, nls.localize('checkbox.select.border', "Border color of checkbox widget when the element it's in is selected."));


/**
 * Quick pick widget (dependent on List and tree colors)
 */
export const _deprecatedQuickInputListFocusBackground = registerColor('quickInput.list.focusBackground', { dark: null, light: null, hcDark: null, hcLight: null }, '', undefined, nls.localize('quickInput.list.focusBackground deprecation', "Please use quickInputList.focusBackground instead"));
export const quickInputListFocusForeground = registerColor('quickInputList.focusForeground', { dark: listActiveSelectionForeground, light: listActiveSelectionForeground, hcDark: listActiveSelectionForeground, hcLight: listActiveSelectionForeground }, nls.localize('quickInput.listFocusForeground', "Quick picker foreground color for the focused item."));
export const quickInputListFocusIconForeground = registerColor('quickInputList.focusIconForeground', { dark: listActiveSelectionIconForeground, light: listActiveSelectionIconForeground, hcDark: listActiveSelectionIconForeground, hcLight: listActiveSelectionIconForeground }, nls.localize('quickInput.listFocusIconForeground', "Quick picker icon foreground color for the focused item."));
export const quickInputListFocusBackground = registerColor('quickInputList.focusBackground', { dark: oneOf(_deprecatedQuickInputListFocusBackground, listActiveSelectionBackground), light: oneOf(_deprecatedQuickInputListFocusBackground, listActiveSelectionBackground), hcDark: null, hcLight: null }, nls.localize('quickInput.listFocusBackground', "Quick picker background color for the focused item."));

/**
 * Menu colors
 */
export const menuBorder = registerColor('menu.border', { dark: null, light: null, hcDark: contrastBorder, hcLight: contrastBorder }, nls.localize('menuBorder', "Border color of menus."));
export const menuForeground = colorRegistry.registerColor('menu.foreground', { dark: selectForeground, light: foreground, hcDark: selectForeground, hcLight: selectForeground }, nls.localize('menuForeground', "Foreground color of menu items."));
export const menuBackground = colorRegistry.registerColor('menu.background', { dark: selectBackground, light: selectBackground, hcDark: selectBackground, hcLight: selectBackground }, nls.localize('menuBackground', "Background color of menu items."));
export const menuSelectionForeground = registerColor('menu.selectionForeground', { dark: menuForeground, light: menuForeground, hcDark: menuForeground, hcLight: menuForeground }, nls.localize('menuSelectionForeground', "Foreground color of the selected menu item in menus."));
export const menuSelectionBackground = registerColor('menu.selectionBackground', { dark: listActiveSelectionBackground, light: listActiveSelectionBackground, hcDark: listActiveSelectionBackground, hcLight: listActiveSelectionBackground }, nls.localize('menuSelectionBackground', "Background color of the selected menu item in menus."));
export const menuSelectionBorder = registerColor('menu.selectionBorder', { dark: null, light: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder }, nls.localize('menuSelectionBorder', "Border color of the selected menu item in menus."));
export const menuSeparatorBackground = registerColor('menu.separatorBackground', { dark: '#606060', light: '#D4D4D4', hcDark: contrastBorder, hcLight: contrastBorder }, nls.localize('menuSeparatorBackground', "Color of a separator menu item in menus."));

export const problemsErrorIconForeground = registerColor('problemsErrorIcon.foreground', { dark: editorErrorForeground, light: editorErrorForeground, hcDark: editorErrorForeground, hcLight: editorErrorForeground }, nls.localize('problemsErrorIconForeground', "The color used for the problems error icon."));
export const problemsWarningIconForeground = registerColor('problemsWarningIcon.foreground', { dark: editorWarningForeground, light: editorWarningForeground, hcDark: editorWarningForeground, hcLight: editorWarningForeground }, nls.localize('problemsWarningIconForeground', "The color used for the problems warning icon."));
export const problemsInfoIconForeground = registerColor('problemsInfoIcon.foreground', { dark: editorInfoForeground, light: editorInfoForeground, hcDark: editorInfoForeground, hcLight: editorInfoForeground }, nls.localize('problemsInfoIconForeground', "The color used for the problems info icon."));


function migrateColorDefaults(o: any): null | ColorDefaults {
	if (o === null) {
		return o;
	}
	if (typeof o.hcLight === 'undefined') {
		if (o.hcDark === null || typeof o.hcDark === 'string') {
			o.hcLight = o.hcDark;
		} else {
			o.hcLight = o.light;
		}
	}
	return o as ColorDefaults;
}
