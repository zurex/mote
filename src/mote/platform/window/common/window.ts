import { PerformanceMark } from 'mote/base/common/performance';
import { IPartsSplash } from 'mote/platform/theme/common/themeService';
import { URI, UriComponents, UriDto } from 'mote/base/common/uri';
import { ISandboxConfiguration } from 'mote/base/parts/sandbox/common/sandboxTypes';
import { NativeParsedArgs } from 'mote/platform/environment/common/argv';
import { IEditorOptions } from 'mote/platform/editor/common/editor';
import { FileType } from 'mote/platform/files/common/files';
import { ILoggerResource, LogLevel } from 'mote/platform/log/common/log';
import { IAnyWorkspaceIdentifier, IWorkspaceIdentifier } from 'mote/platform/workspace/common/workspace';

export interface IPathData<T = IEditorOptions> {

	/**
	 * The file path to open within the instance
	 */
	readonly fileUri?: UriComponents;

	/**
	 * Optional editor options to apply in the file
	 */
	readonly options?: T;

	/**
	 * A hint that the file exists. if true, the
	 * file exists, if false it does not. with
	 * `undefined` the state is unknown.
	 */
	readonly exists?: boolean;

	/**
	 * A hint about the file type of this path.
	 * with `undefined` the type is unknown.
	 */
	readonly type?: FileType;

	/**
	 * Specifies if the file should be only be opened
	 * if it exists.
	 */
	readonly openOnlyIfExists?: boolean;
}

export interface IPath<T = IEditorOptions> extends IPathData<T> {

	/**
	 * The file path to open within the instance
	 */
	fileUri?: URI;
}

export interface IWindowConfiguration {

}

export interface IOSConfiguration {
	readonly release: string;
	readonly hostname: string;
}

export interface IColorScheme {
	readonly dark: boolean;
	readonly highContrast: boolean;
}

export interface IOSConfiguration {
	readonly release: string;
	readonly hostname: string;
}

export interface INativeWindowConfiguration extends NativeParsedArgs, ISandboxConfiguration {
	mainPid: number;

	machineId?: string;

	homeDir: string;
	tmpDir: string;
	userDataDir: string;

	partsSplash?: IPartsSplash;

	workspace?: IWorkspaceIdentifier;

	isInitialStartup?: boolean;
	logLevel: LogLevel;
	loggers: UriDto<ILoggerResource>[];

	fullscreen?: boolean;
	maximized?: boolean;
	accessibilitySupport?: boolean;
	colorScheme: IColorScheme;
	autoDetectHighContrast?: boolean;

	perfMarks: PerformanceMark[];

	os: IOSConfiguration;
}

export interface IBaseOpenWindowsOptions {

	/**
	 * Whether to reuse the window or open a new one.
	 */
	readonly forceReuseWindow?: boolean;

	/**
	 * The remote authority to use when windows are opened with either
	 * - no workspace (empty window)
	 * - a workspace that is neither `file://` nor `vscode-remote://`
	 * Use 'null' for a local window.
	 * If not set, defaults to the remote authority of the current window.
	 */
	readonly remoteAuthority?: string | null;
}

export interface IOpenedWindow {
	readonly id: number;
	readonly workspace?: IAnyWorkspaceIdentifier;
	readonly title: string;
	readonly filename?: string;
	readonly dirty: boolean;
}

export interface IOpenEmptyWindowOptions extends IBaseOpenWindowsOptions { }

export interface IOpenWindowOptions extends IBaseOpenWindowsOptions {
	readonly forceNewWindow?: boolean;
	readonly preferNewWindow?: boolean;

	readonly noRecentEntry?: boolean;

	readonly addMode?: boolean;

	readonly diffMode?: boolean;
	readonly mergeMode?: boolean;
	readonly gotoLineMode?: boolean;

	readonly waitMarkerFileURI?: URI;

	readonly forceProfile?: string;
	readonly forceTempProfile?: boolean;
}

export type IWindowOpenable = IWorkspaceToOpen | IFolderToOpen | IFileToOpen;

export interface IBaseWindowOpenable {
	label?: string;
}

export interface IWorkspaceToOpen extends IBaseWindowOpenable {
	readonly workspaceUri: URI;
}

export interface IFolderToOpen extends IBaseWindowOpenable {
	readonly folderUri: URI;
}

export interface IFileToOpen extends IBaseWindowOpenable {
	readonly fileUri: URI;
}

export function isWorkspaceToOpen(uriToOpen: IWindowOpenable): uriToOpen is IWorkspaceToOpen {
	return !!(uriToOpen as IWorkspaceToOpen).workspaceUri;
}

export function isFolderToOpen(uriToOpen: IWindowOpenable): uriToOpen is IFolderToOpen {
	return !!(uriToOpen as IFolderToOpen).folderUri;
}
